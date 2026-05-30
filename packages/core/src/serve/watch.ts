// ----------------------------------------------------------------------------
// `yohaku serve --watch` のコア
//
// 役割:
//   1. force-app/ の変更を fs.watch で検知 (recursive watch、debounce)
//   2. 変更時に rebuild() を呼ぶ (呼び側 = graph build + render html)
//   3. SSE で接続中のブラウザに "reload" イベントを push
//   4. ブラウザ側は `EventSource('/__yohaku/events')` で受信して location.reload()
//
// 依存追加なし (node:fs.watch + node:http のみ)。
// ----------------------------------------------------------------------------

import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import type { ServerResponse } from "node:http";

/** 監視ハンドル (close できれば実体は問わない)。 */
export interface RawWatcher {
  close(): void;
}

/**
 * ディレクトリ監視を生成するファクトリ。
 * `onChange` には変更ファイル名 (recursive watch の相対パス) を渡す。filename 不明時は null。
 * 既定は node:fs.watch だが、テストでは合成イベントを注入するために差し替えられる。
 */
export type WatchFactory = (
  dir: string,
  onChange: (filename: string | null) => void,
) => RawWatcher;

export interface WatchOptions {
  /** 監視対象のディレクトリ (絶対パス) */
  readonly watchDir: string;
  /** 変更検知後に呼ぶ再ビルド関数 */
  readonly rebuild: () => Promise<void> | void;
  /** 連続イベントをまとめる debounce ms (既定: 300ms) */
  readonly debounceMs?: number;
  /** ログ */
  readonly log?: (msg: string) => void;
  /** 監視ファクトリ (既定: node:fs.watch)。テストでの差し替え用。 */
  readonly watchFactory?: WatchFactory;
}

/** 既定の監視ファクトリ: node:fs.watch (recursive) を薄くラップする。 */
const defaultWatchFactory: WatchFactory = (dir, onChange) => {
  const w: FSWatcher = watch(dir, { recursive: true }, (_evt, filename) => {
    onChange(filename === null ? null : String(filename));
  });
  return { close: () => w.close() };
};

export interface WatchHandle {
  readonly sse: SseHub;
  close(): void;
}

/**
 * 監視を開始する。変更があれば rebuild() を呼び、終了後に sse.broadcast("reload") する。
 */
export function startWatch(options: WatchOptions): WatchHandle {
  const watchDir = resolve(options.watchDir);
  const debounceMs = options.debounceMs ?? 300;
  const log = options.log ?? (() => {});
  const sse = new SseHub();

  let pending: NodeJS.Timeout | null = null;
  let building = false;
  let buildAgain = false;

  const trigger = (path: string | null): void => {
    if (path !== null) log(`[yohaku watch] change: ${path}`);
    if (pending !== null) clearTimeout(pending);
    pending = setTimeout(runBuild, debounceMs);
  };

  const runBuild = async (): Promise<void> => {
    if (building) {
      buildAgain = true;
      return;
    }
    building = true;
    pending = null;
    try {
      const t0 = Date.now();
      log("[yohaku watch] rebuilding...");
      await options.rebuild();
      log(`[yohaku watch] rebuild ok (${Date.now() - t0}ms), notifying clients`);
      sse.broadcast("reload", "");
    } catch (err) {
      log(`[yohaku watch] rebuild failed: ${(err as Error).message}`);
      sse.broadcast("error", (err as Error).message);
    } finally {
      building = false;
      if (buildAgain) {
        buildAgain = false;
        trigger(null);
      }
    }
  };

  const onChange = (filename: string | null): void => {
    if (filename === null) return trigger(null);
    const name = filename;
    // ノイズフィルタ: dot ファイル、.swp、~ 末尾、node_modules、.git
    if (name.startsWith(".") || name.startsWith("node_modules/") || name.startsWith(".git/")) return;
    if (name.endsWith("~") || name.endsWith(".swp") || name.endsWith(".swx")) return;
    // 自分自身 (docs/generated/html) の変更は無視 (rebuild が起こした書き込みでループしないように)
    if (name.startsWith("docs/generated/")) return;
    if (name.startsWith(".yohaku/")) return;
    trigger(name);
  };

  const makeWatcher = options.watchFactory ?? defaultWatchFactory;
  let watcher: RawWatcher | null = null;
  try {
    watcher = makeWatcher(watchDir, onChange);
  } catch (err) {
    log(`[yohaku watch] failed to start watcher: ${(err as Error).message}`);
  }

  return {
    sse,
    close(): void {
      if (watcher !== null) watcher.close();
      if (pending !== null) clearTimeout(pending);
      sse.closeAll();
    },
  };
}

// ----------------------------------------------------------------------------
// SSE Hub
// ----------------------------------------------------------------------------

export class SseHub {
  readonly #clients: Set<ServerResponse> = new Set();

  attach(res: ServerResponse): void {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    // 接続維持のために初期 retry hint と welcome イベントを送る
    res.write("retry: 2000\n");
    res.write("event: ready\ndata: {}\n\n");
    this.#clients.add(res);
    const handleClose = (): void => {
      this.#clients.delete(res);
    };
    res.on("close", handleClose);
    res.on("error", handleClose);
  }

  broadcast(event: string, data: string): void {
    const payload = `event: ${event}\ndata: ${data.replace(/\n/g, " ")}\n\n`;
    for (const c of this.#clients) {
      try {
        c.write(payload);
      } catch {
        /* swallow: close handler が片付ける */
      }
    }
  }

  closeAll(): void {
    for (const c of this.#clients) {
      try {
        c.end();
      } catch {
        /* ignore */
      }
    }
    this.#clients.clear();
  }

  get clientCount(): number {
    return this.#clients.size;
  }
}

/**
 * watch クライアント側 (HTML に注入) スクリプト。
 * 全 HTML ページに 1 行で挿入できる小さな snippet。
 */
export const WATCH_CLIENT_SCRIPT = `(() => {
  try {
    const es = new EventSource('/__yohaku/events');
    es.addEventListener('reload', () => {
      console.info('[yohaku watch] reload');
      window.location.reload();
    });
    es.addEventListener('error', (e) => {
      console.warn('[yohaku watch] sse error', e);
    });
  } catch (e) {
    console.warn('[yohaku watch] EventSource not available', e);
  }
})();`;
