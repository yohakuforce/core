import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStaticServer, type ServeHandle } from "../../../src/serve/index.js";

async function fetchText(url: string): Promise<{ status: number; body: string; contentType?: string }> {
  const res = await fetch(url);
  const body = await res.text();
  const ct = res.headers.get("content-type") ?? undefined;
  return ct === undefined ? { status: res.status, body } : { status: res.status, body, contentType: ct };
}

// テストでランダムポートを取るための簡易ヘルパ
function pickPort(): number {
  return 4100 + Math.floor(Math.random() * 800);
}

describe("createStaticServer", () => {
  let root: string;
  let handle: ServeHandle | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "yohaku-serve-"));
    writeFileSync(join(root, "index.html"), "<h1>Home</h1>", "utf8");
    mkdirSync(join(root, "sub"), { recursive: true });
    writeFileSync(join(root, "sub", "page.html"), "<h1>Sub</h1>", "utf8");
    writeFileSync(join(root, "data.json"), '{"ok":true}', "utf8");
    // dotfile (配信されない想定)
    writeFileSync(join(root, ".secret"), "nope", "utf8");
  });
  afterEach(async () => {
    if (handle !== undefined) await handle.close();
    handle = undefined;
    rmSync(root, { recursive: true, force: true });
  });

  it("ルートで index.html を返す", async () => {
    const port = pickPort();
    handle = createStaticServer({ rootDir: root, port, logRequests: false });
    const r = await fetchText(handle.url);
    expect(r.status).toBe(200);
    expect(r.body).toContain("<h1>Home</h1>");
    expect(r.contentType).toMatch(/text\/html/);
  });

  it("サブディレクトリでも index.html フォールバック", async () => {
    const port = pickPort();
    handle = createStaticServer({ rootDir: root, port, logRequests: false });
    const r = await fetchText(handle.url + "sub/page.html");
    expect(r.status).toBe(200);
    expect(r.body).toContain("<h1>Sub</h1>");
  });

  it("JSON ファイルは application/json で配信", async () => {
    const port = pickPort();
    handle = createStaticServer({ rootDir: root, port, logRequests: false });
    const r = await fetchText(handle.url + "data.json");
    expect(r.status).toBe(200);
    expect(r.contentType).toMatch(/application\/json/);
    expect(JSON.parse(r.body)).toEqual({ ok: true });
  });

  it("dotfile は 404", async () => {
    const port = pickPort();
    handle = createStaticServer({ rootDir: root, port, logRequests: false });
    const r = await fetchText(handle.url + ".secret");
    expect(r.status).toBe(404);
  });

  it("パストラバーサル ('../') は 404", async () => {
    const port = pickPort();
    handle = createStaticServer({ rootDir: root, port, logRequests: false });
    const r = await fetchText(handle.url + "sub/../../etc/passwd");
    // normalize で外に出ようとした場合、404 になる (path-prefix 比較で弾く)
    expect([403, 404]).toContain(r.status);
  });

  it("POST は 405", async () => {
    const port = pickPort();
    handle = createStaticServer({ rootDir: root, port, logRequests: false });
    const r = await fetch(handle.url, { method: "POST" });
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe("GET, HEAD");
  });
});
