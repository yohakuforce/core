import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SseHub, startWatch, type WatchFactory } from "../../../src/serve/watch.js";

// 実 fs.watch のイベント配送タイミングに依存せず、変更イベントを合成注入する
// フェイク watcher。並列実行時の CPU starvation による flaky を構造的に排除する。
function makeFakeWatcher(): {
  factory: WatchFactory;
  emit: (filename: string | null) => void;
} {
  let cb: ((filename: string | null) => void) | null = null;
  const factory: WatchFactory = (_dir, onChange) => {
    cb = onChange;
    return {
      close: () => {
        cb = null;
      },
    };
  };
  return { factory, emit: (filename) => cb?.(filename) };
}

// 固定 setTimeout ではなく条件成立を polling で待つ。並列実行時に fs.watch の
// イベント配送が一時的に遅延しても、本当に成立するまで待つので race で落ちない。
async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 20,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: 条件が timeout 内に成立しませんでした");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function makeFakeRes(): ServerResponse & EventEmitter {
  const e = new EventEmitter() as ServerResponse & EventEmitter;
  // ServerResponse の最小限の代用品 (テスト専用)
  (e as unknown as { writeHead: ReturnType<typeof vi.fn> }).writeHead = vi.fn();
  (e as unknown as { write: ReturnType<typeof vi.fn> }).write = vi.fn().mockReturnValue(true);
  (e as unknown as { end: ReturnType<typeof vi.fn> }).end = vi.fn();
  return e;
}

describe("SseHub", () => {
  it("attach で welcome イベントを書き込む", () => {
    const hub = new SseHub();
    const res = makeFakeRes();
    hub.attach(res);
    expect((res.writeHead as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(200);
    expect(hub.clientCount).toBe(1);
  });

  it("broadcast は全クライアントに event/data を送る", () => {
    const hub = new SseHub();
    const a = makeFakeRes();
    const b = makeFakeRes();
    hub.attach(a);
    hub.attach(b);
    hub.broadcast("reload", "");
    const aWrites = (a.write as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    const bWrites = (b.write as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(aWrites.some((s: unknown) => typeof s === "string" && s.includes("event: reload"))).toBe(true);
    expect(bWrites.some((s: unknown) => typeof s === "string" && s.includes("event: reload"))).toBe(true);
  });

  it("close 時にクライアントが解除される", () => {
    const hub = new SseHub();
    const a = makeFakeRes();
    hub.attach(a);
    expect(hub.clientCount).toBe(1);
    a.emit("close");
    expect(hub.clientCount).toBe(0);
  });

  it("closeAll で全 res.end が呼ばれて空になる", () => {
    const hub = new SseHub();
    const a = makeFakeRes();
    const b = makeFakeRes();
    hub.attach(a);
    hub.attach(b);
    hub.closeAll();
    expect(hub.clientCount).toBe(0);
    expect(a.end).toHaveBeenCalled();
    expect(b.end).toHaveBeenCalled();
  });
});

describe("startWatch", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "yohaku-watch-"));
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "a.txt"), "v1", "utf8");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("ファイル変更で rebuild が呼ばれ、SSE で reload が出る", async () => {
    const rebuild = vi.fn().mockResolvedValue(undefined);
    const fake = makeFakeWatcher();
    const handle = startWatch({
      watchDir: dir,
      rebuild,
      debounceMs: 20,
      log: () => {},
      watchFactory: fake.factory,
    });
    const res = makeFakeRes();
    handle.sse.attach(res);

    // 変更イベントを合成注入 (実 fs.watch 非依存)
    fake.emit("a.txt");

    // debounce + rebuild + broadcast を polling で待つ
    const reloadSent = () =>
      (res.write as unknown as ReturnType<typeof vi.fn>).mock.calls
        .map((c) => c[0])
        .some((s: unknown) => typeof s === "string" && s.includes("event: reload"));
    await waitFor(() => rebuild.mock.calls.length > 0 && reloadSent());

    expect(rebuild).toHaveBeenCalled();
    expect(reloadSent()).toBe(true);

    handle.close();
  });

  it("rebuild 中に来た変更は queueing されて 1 回だけ追加実行", async () => {
    let inFlight = false;
    let concurrentObserved = false;
    const rebuild = vi.fn(async () => {
      if (inFlight) concurrentObserved = true;
      inFlight = true;
      await new Promise((r) => setTimeout(r, 80));
      inFlight = false;
    });
    const fake = makeFakeWatcher();
    const handle = startWatch({
      watchDir: dir,
      rebuild,
      debounceMs: 20,
      log: () => {},
      watchFactory: fake.factory,
    });

    // 1 回目の変更 → rebuild #1 が「実際に開始」されるまで待つ
    fake.emit("a.txt");
    await waitFor(() => inFlight === true);

    // rebuild #1 進行中に来た複数変更は 1 回だけ queueing されるべき
    fake.emit("a.txt");
    fake.emit("a.txt");

    // 2 回目の rebuild が走り、最終的に in-flight が捌けるまで polling で待つ
    await waitFor(() => rebuild.mock.calls.length >= 2);
    await waitFor(() => inFlight === false);

    expect(concurrentObserved).toBe(false);
    // 1 回目 + queue された 1 回 = ちょうど 2 回
    expect(rebuild.mock.calls.length).toBe(2);
    handle.close();
  });
});
