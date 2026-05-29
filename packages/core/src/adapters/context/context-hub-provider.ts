// ContextHubProvider — opt-in。Context-Hub の MCP サーバ(stdio)から
// プロジェクト/顧客コンテキストを取得する ContextProvider 実装。
//
// 詳細 ADR: .agents/knowledge/decisions/2026-05-29-context-hub-context-provider.md
//
// データ境界: stdio(localhost) 経由で同一マシン内に閉じる。取得結果は
// 呼び出し側でプロンプト材料として実行時に使うのみ。本クラスは永続化しない。

import type {
  ContextBrief,
  ContextProvider,
  ContextSnippet,
  ContextTarget,
} from "../../types/context-provider.js";
import {
  ChildProcessStdioTransport,
  JsonRpcClient,
  type JsonRpcClientOptions,
  type JsonRpcTransport,
} from "./json-rpc-stdio.js";

const MCP_PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_TOP_K = 5;

export interface ContextHubProviderOptions {
  /** Context-Hub 内部のプロジェクト ID。 */
  readonly projectId: string;
  /** 取得する関連断片の最大件数。 */
  readonly topK?: number;
  /** 注入トランスポート（本番は子プロセス、テストは fake）。 */
  readonly transport: JsonRpcTransport;
  readonly clientOptions?: JsonRpcClientOptions;
}

interface SearchToolResult {
  readonly results?: ReadonlyArray<{
    readonly score?: number;
    readonly title?: string;
    readonly snippet?: string;
    readonly documentId?: string;
  }>;
  readonly error?: string;
}

export class ContextHubProvider implements ContextProvider {
  readonly kind = "context-hub" as const;
  readonly #client: JsonRpcClient;
  readonly #projectId: string;
  readonly #topK: number;
  #initialized = false;

  constructor(options: ContextHubProviderOptions) {
    this.#client = new JsonRpcClient(options.transport, options.clientOptions);
    this.#projectId = options.projectId;
    this.#topK = options.topK ?? DEFAULT_TOP_K;
  }

  async relatedContext(target: ContextTarget): Promise<ContextBrief> {
    await this.#ensureInitialized();

    const query = `${target.kind} ${target.fqn}`.trim();
    const raw = await this.#client.request("tools/call", {
      name: "search_context",
      arguments: { projectId: this.#projectId, query, topK: this.#topK },
    });

    const parsed = this.#parseToolResult(raw);
    if (parsed.error) {
      throw new Error(`Context-Hub search_context failed: ${parsed.error}`);
    }

    const snippets: ContextSnippet[] = (parsed.results ?? [])
      .filter((r) => typeof r.snippet === "string" && r.snippet.length > 0)
      .map((r) => ({
        text: r.snippet as string,
        score: r.score,
        ref: {
          kind: "document" as const,
          id: r.documentId ?? "",
          title: r.title,
        },
      }));

    return { target, snippets, empty: snippets.length === 0 };
  }

  async close(): Promise<void> {
    await this.#client.close();
  }

  async #ensureInitialized(): Promise<void> {
    if (this.#initialized) {
      return;
    }
    await this.#client.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "yohaku-core", version: "0.1.0" },
    });
    // MCP 仕様の作法。Context-Hub は必須としないが互換のため送る。
    this.#client.notify("notifications/initialized");
    this.#initialized = true;
  }

  /** tools/call の result.content[0].text(JSON 文字列) を SearchToolResult に展開する。 */
  #parseToolResult(raw: unknown): SearchToolResult {
    const result = raw as { content?: Array<{ type?: string; text?: string }> } | null;
    const text = result?.content?.[0]?.text;
    if (typeof text !== "string") {
      return { error: "unexpected tool result shape (missing content[0].text)" };
    }
    try {
      return JSON.parse(text) as SearchToolResult;
    } catch {
      return { error: "tool result content was not valid JSON" };
    }
  }
}

export interface ContextHubSpawnConfig {
  /** MCP サーバ起動コマンド（例: "python"）。 */
  readonly command: string;
  /** 引数（例: ["-m", "context_hub.mcp.server"]）。 */
  readonly args?: readonly string[];
  readonly env?: Record<string, string>;
  /** MCP サーバの作業ディレクトリ（相対 DB パス等に影響）。 */
  readonly cwd?: string;
  readonly projectId: string;
  readonly topK?: number;
  readonly clientOptions?: JsonRpcClientOptions;
}

/** 子プロセスを spawn して ContextHubProvider を生成する（opt-in 本番経路）。 */
export function spawnContextHubProvider(config: ContextHubSpawnConfig): ContextHubProvider {
  const transport = new ChildProcessStdioTransport(
    config.command,
    config.args ?? [],
    config.env,
    config.cwd,
  );
  return new ContextHubProvider({
    projectId: config.projectId,
    topK: config.topK,
    transport,
    clientOptions: config.clientOptions,
  });
}
