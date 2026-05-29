// 最小 JSON-RPC 2.0 over stdio クライアント。
//
// Context-Hub の MCP サーバは newline 区切りの JSON-RPC 2.0 を stdio で話す
// （手書きプロトコル、公式 MCP SDK 非依存）。core 側も新規依存を足さずに
// node:child_process だけでクライアントを実装し、OSS 純度を保つ。
//
// トランスポートは注入可能（テストでは FakeTransport、本番は子プロセス）。

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

export interface JsonRpcTransport {
  /** 1 メッセージ（JSON 文字列、改行なし）を送る。改行フレーミングは実装側が付与。 */
  send(message: string): void;
  /** 完全な 1 行（JSON 文字列）を受信するたびに呼ばれる。 */
  onMessage(handler: (line: string) => void): void;
  /** トランスポート異常時に呼ばれる。 */
  onError(handler: (err: Error) => void): void;
  close(): Promise<void>;
}

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (err: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export interface JsonRpcClientOptions {
  /** リクエストごとのタイムアウト（ミリ秒）。既定 30 秒。 */
  readonly requestTimeoutMs?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class JsonRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export class JsonRpcClient {
  readonly #transport: JsonRpcTransport;
  readonly #timeoutMs: number;
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 1;
  #closed = false;

  constructor(transport: JsonRpcTransport, options: JsonRpcClientOptions = {}) {
    this.#transport = transport;
    this.#timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.#transport.onMessage((line) => this.#handleLine(line));
    this.#transport.onError((err) => this.#failAll(err));
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.#closed) {
      throw new JsonRpcError("JsonRpcClient is closed");
    }
    const id = this.#nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} });
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new JsonRpcError(`JSON-RPC request timed out: ${method}`));
      }, this.#timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#transport.send(payload);
    });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    if (this.#closed) {
      throw new JsonRpcError("JsonRpcClient is closed");
    }
    this.#transport.send(JSON.stringify({ jsonrpc: "2.0", method, params: params ?? {} }));
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#failAll(new JsonRpcError("JsonRpcClient closed before response"));
    await this.#transport.close();
  }

  #handleLine(line: string): void {
    let msg: { id?: number; result?: unknown; error?: { code?: number; message?: string } };
    try {
      msg = JSON.parse(line);
    } catch {
      return; // 不正な行は無視（サーバの stderr 混入等に対する保険）
    }
    if (typeof msg.id !== "number") {
      return; // 通知やサーバ起点メッセージは現状未対応
    }
    const pending = this.#pending.get(msg.id);
    if (!pending) {
      return;
    }
    this.#pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error) {
      pending.reject(new JsonRpcError(msg.error.message ?? "JSON-RPC error", msg.error.code));
      return;
    }
    pending.resolve(msg.result);
  }

  #failAll(err: Error): void {
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.#pending.clear();
  }
}

/** 子プロセスを spawn し、stdout を行バッファリングして JSON-RPC を運ぶトランスポート。 */
export class ChildProcessStdioTransport implements JsonRpcTransport {
  readonly #proc: ChildProcessWithoutNullStreams;
  #buffer = "";
  #messageHandler: ((line: string) => void) | null = null;
  #errorHandler: ((err: Error) => void) | null = null;

  constructor(
    command: string,
    args: readonly string[] = [],
    env?: Record<string, string>,
    cwd?: string,
  ) {
    this.#proc = spawn(command, [...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
      cwd,
    });
    this.#proc.stdout.setEncoding("utf8");
    this.#proc.stdout.on("data", (chunk: string) => this.#onChunk(chunk));
    this.#proc.on("error", (err) => this.#errorHandler?.(err));
    this.#proc.on("exit", (code) => {
      if (code && code !== 0) {
        this.#errorHandler?.(new JsonRpcError(`MCP process exited with code ${code}`));
      }
    });
  }

  send(message: string): void {
    this.#proc.stdin.write(`${message}\n`);
  }

  onMessage(handler: (line: string) => void): void {
    this.#messageHandler = handler;
  }

  onError(handler: (err: Error) => void): void {
    this.#errorHandler = handler;
  }

  async close(): Promise<void> {
    this.#proc.stdin.end();
    this.#proc.kill();
  }

  #onChunk(chunk: string): void {
    this.#buffer += chunk;
    let idx = this.#buffer.indexOf("\n");
    while (idx >= 0) {
      const line = this.#buffer.slice(0, idx).trim();
      this.#buffer = this.#buffer.slice(idx + 1);
      if (line) {
        this.#messageHandler?.(line);
      }
      idx = this.#buffer.indexOf("\n");
    }
  }
}
