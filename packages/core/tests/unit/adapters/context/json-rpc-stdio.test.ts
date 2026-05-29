import { describe, expect, it } from "vitest";
import { JsonRpcClient, JsonRpcError } from "../../../../src/adapters/context/json-rpc-stdio.js";
import { FakeTransport } from "./fake-transport.js";

describe("JsonRpcClient", () => {
  it("request は一致する id の result で解決する", async () => {
    const t = new FakeTransport();
    t.responder = (req) => ({ echoed: req.method });
    const client = new JsonRpcClient(t);
    const result = await client.request("ping", { x: 1 });
    expect(result).toEqual({ echoed: "ping" });
    expect(t.sent[0]).toMatchObject({ jsonrpc: "2.0", id: 1, method: "ping", params: { x: 1 } });
  });

  it("error 応答は JsonRpcError で reject する", async () => {
    const t = new FakeTransport();
    const client = new JsonRpcClient(t);
    const p = client.request("boom");
    // クライアントの id は 1 から採番される（実装の不変条件）
    t.emit({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } });
    await expect(p).rejects.toThrow(JsonRpcError);
    await expect(p).rejects.toThrow(/Method not found/);
  });

  it("タイムアウトで reject する", async () => {
    const t = new FakeTransport(); // responder 未設定 = 応答なし
    const client = new JsonRpcClient(t, { requestTimeoutMs: 20 });
    await expect(client.request("never")).rejects.toThrow(/timed out/);
  });

  it("notify は id を含まず送信する", () => {
    const t = new FakeTransport();
    const client = new JsonRpcClient(t);
    client.notify("notifications/initialized");
    const msg = t.sent.find((m) => m.method === "notifications/initialized");
    expect(msg).toBeDefined();
    expect(msg?.id).toBeUndefined();
  });

  it("無関係な id の応答は無視する", async () => {
    const t = new FakeTransport();
    const client = new JsonRpcClient(t, { requestTimeoutMs: 30 });
    const p = client.request("x");
    t.emit({ jsonrpc: "2.0", id: 999, result: { wrong: true } });
    await expect(p).rejects.toThrow(/timed out/); // 一致 id 来ずタイムアウト
  });

  it("close は未解決 request を reject する", async () => {
    const t = new FakeTransport();
    const client = new JsonRpcClient(t);
    const p = client.request("pending");
    await client.close();
    await expect(p).rejects.toThrow(JsonRpcError);
    expect(t.closed).toBe(true);
  });

  it("トランスポート異常は全 pending を reject する", async () => {
    const t = new FakeTransport();
    const client = new JsonRpcClient(t);
    const p = client.request("pending");
    t.fail(new Error("pipe broke"));
    await expect(p).rejects.toThrow(/pipe broke/);
  });
});
