import type { JsonRpcTransport } from "../../../../src/adapters/context/json-rpc-stdio.js";

interface JsonRpcRequest {
  readonly id?: number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

/** テスト用のインメモリ JSON-RPC トランスポート。
 * responder で各リクエストへの result を返すと、自動で応答を流す。 */
export class FakeTransport implements JsonRpcTransport {
  readonly sent: JsonRpcRequest[] = [];
  responder: ((req: JsonRpcRequest) => unknown | undefined) | undefined;
  #onMessage: (line: string) => void = () => {};
  #onError: (err: Error) => void = () => {};
  closed = false;

  send(message: string): void {
    const req = JSON.parse(message) as JsonRpcRequest;
    this.sent.push(req);
    if (req.id !== undefined && this.responder) {
      const result = this.responder(req);
      if (result !== undefined) {
        queueMicrotask(() => {
          this.#onMessage(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }));
        });
      }
    }
  }

  onMessage(handler: (line: string) => void): void {
    this.#onMessage = handler;
  }

  onError(handler: (err: Error) => void): void {
    this.#onError = handler;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  /** サーバ起点でメッセージを流す（手動制御用）。 */
  emit(message: object): void {
    this.#onMessage(JSON.stringify(message));
  }

  /** トランスポート異常を発火する。 */
  fail(err: Error): void {
    this.#onError(err);
  }
}
