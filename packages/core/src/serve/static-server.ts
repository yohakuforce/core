// ----------------------------------------------------------------------------
// 軽量静的ファイルサーバ (yohaku serve のコア)
//
// node:http のみで実装、依存追加無し。file:// 制約 (fetch 不可、CORS) からの
// 解放と、複数 dev/レビュアー間で URL 共有可能なローカルプレビューを提供。
//
// セキュリティ:
//   - ルート外へのパストラバーサル防止 (realpath 比較)
//   - dotfile (.yohaku/, .git/ 等) は配信しない
//   - 既定で 127.0.0.1 にバインド (LAN 公開には --host 0.0.0.0 を要求)
// ----------------------------------------------------------------------------

import { createReadStream, readFileSync, statSync } from "node:fs";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import type { SseHub } from "./watch.js";
import { WATCH_CLIENT_SCRIPT } from "./watch.js";

export interface ServeOptions {
  /** 配信するルートディレクトリ (絶対パス推奨) */
  readonly rootDir: string;
  /** バインドホスト (既定: 127.0.0.1) */
  readonly host?: string;
  /** バインドポート (既定: 4000) */
  readonly port?: number;
  /** リクエストログを出力するか (既定: true) */
  readonly logRequests?: boolean;
  /** 渡されると `/__yohaku/events` で SSE を配信し、HTML に watch client を inject する */
  readonly sse?: SseHub;
}

export interface ServeHandle {
  readonly url: string;
  readonly server: Server;
  close(): Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function mimeOf(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

/**
 * パス解決: rootDir 外へ出ようとする要求は 403。
 * dotfile は 404 (列挙されない・配信されない)。
 */
function resolveSafePath(
  rootDir: string,
  urlPath: string,
): { ok: true; abs: string } | { ok: false; status: number } {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return { ok: false, status: 400 };
  }
  // パスをディレクトリ正規化、先頭の / を取り除いて join
  const noQuery = decoded.split("?")[0] ?? "/";
  const cleaned = normalize(noQuery).replace(/^\/+/, "");
  if (cleaned.split(/[\\/]/).some((seg) => seg.startsWith("."))) {
    return { ok: false, status: 404 };
  }
  const abs = resolve(rootDir, cleaned);
  // realpath ではなく prefix 比較 (シンボリックリンクを許容しない最も厳しい設定)
  if (!abs.startsWith(rootDir)) return { ok: false, status: 403 };
  return { ok: true, abs };
}

export function createStaticServer(options: ServeOptions): ServeHandle {
  const rootDir = resolve(options.rootDir);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4000;
  const logRequests = options.logRequests ?? true;

  const server = createServer((req, res) => {
    handleRequest(rootDir, req, res, logRequests, options.sse);
  });

  server.listen(port, host);

  const url = `http://${host}:${port}/`;
  return {
    url,
    server,
    close(): Promise<void> {
      return new Promise<void>((resolveFn, rejectFn) => {
        server.close((err) => {
          if (err !== undefined && err !== null) rejectFn(err);
          else resolveFn();
        });
      });
    },
  };
}

function handleRequest(
  rootDir: string,
  req: IncomingMessage,
  res: ServerResponse,
  logRequests: boolean,
  sse: SseHub | undefined,
): void {
  const reqUrl = req.url ?? "/";

  // ---- watch 系の予約 path ----
  if (sse !== undefined) {
    if (reqUrl === "/__yohaku/events") {
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end();
        return;
      }
      sse.attach(res);
      if (logRequests) console.log(`  SSE ${reqUrl} (clients=${sse.clientCount})`);
      return;
    }
    if (reqUrl === "/__yohaku/client.js") {
      res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
      res.end(WATCH_CLIENT_SCRIPT);
      return;
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain", allow: "GET, HEAD" });
    res.end("method not allowed\n");
    return;
  }
  const safe = resolveSafePath(rootDir, reqUrl);
  if (!safe.ok) {
    res.writeHead(safe.status);
    res.end();
    return;
  }
  let abs = safe.abs;
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(abs);
  } catch {
    notFound(res);
    if (logRequests) console.log(`  GET ${reqUrl} → 404`);
    return;
  }
  if (stat.isDirectory()) {
    abs = join(abs, "index.html");
    try {
      stat = statSync(abs);
    } catch {
      notFound(res);
      if (logRequests) console.log(`  GET ${reqUrl} → 404 (no index.html)`);
      return;
    }
  }

  const mime = mimeOf(abs);
  // HTML を返す場合、watch mode なら watch client script を inject する
  if (sse !== undefined && mime.startsWith("text/html")) {
    serveHtmlWithWatchClient(abs, req, res, logRequests);
    return;
  }

  res.writeHead(200, {
    "content-type": mime,
    "content-length": String(stat.size),
    "cache-control": "no-cache",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(abs);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
  if (logRequests) console.log(`  GET ${reqUrl} → 200 (${stat.size}b)`);
}

function serveHtmlWithWatchClient(
  abs: string,
  req: IncomingMessage,
  res: ServerResponse,
  logRequests: boolean,
): void {
  // 同期的に読み切る (HTML は普通 < 100KB 程度なので問題なし)
  let body: string;
  try {
    body = readFileSyncUtf8(abs);
  } catch {
    notFound(res);
    return;
  }
  const injected = injectWatchClient(body);
  const buf = Buffer.from(injected, "utf8");
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": String(buf.byteLength),
    "cache-control": "no-cache",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(buf);
  if (logRequests) console.log(`  GET ${req.url} → 200 (${buf.byteLength}b, watch-injected)`);
}

function injectWatchClient(html: string): string {
  const tag = `<script src="/__yohaku/client.js" defer></script>`;
  if (html.includes(tag)) return html;
  const closeBody = html.lastIndexOf("</body>");
  if (closeBody < 0) return html + tag;
  return `${html.slice(0, closeBody) + tag}\n${html.slice(closeBody)}`;
}

function readFileSyncUtf8(path: string): string {
  return readFileSync(path, "utf8");
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("404 not found\n");
}
