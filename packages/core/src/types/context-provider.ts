// ----------------------------------------------------------------------------
// ContextProvider interface
//
// プロジェクト/顧客コンテキスト（会議の決定事項・課題の経緯・顧客とのやり取り）を
// 取り込むための抽象。SourceAdapter（Salesforce メタデータ源）とは別カテゴリ。
//
// 詳細 ADR: .agents/knowledge/decisions/2026-05-29-context-hub-context-provider.md
//
// 設計方針:
// - デフォルトは "none"（外部コンテキスト無し）。OSS 純度を保つ。
// - "context-hub" 実装は opt-in。Context-Hub の MCP サーバ(stdio)経由。
// - core 自身は LLM を呼ばない。本 IF は「決定的に取得した証拠」を返し、
//   外部 AI（explain-writer 等）がそれを材料に AI_MANAGED ブロックを生成する。
// - 取得した顧客コンテキストは実行時メモリ限り。graph.sqlite 等へ永続化しない。
// ----------------------------------------------------------------------------

export type ContextProviderKind = "none" | "context-hub";

/** コンテキストを引きたい Salesforce メタデータ対象。 */
export interface ContextTarget {
  /** メタデータ種別（apexClass / flow / object ...）。 */
  readonly kind: string;
  /** 完全修飾名（AccountBalanceService / Order__c ...）。 */
  readonly fqn: string;
}

/** コンテキスト断片の出所参照。再現性ガバナンス（監査）のために必須。 */
export interface ContextRef {
  readonly kind: "meeting" | "issue" | "document" | "slack";
  readonly id: string;
  readonly title?: string;
}

/** 対象に関連する1件のコンテキスト断片。 */
export interface ContextSnippet {
  readonly text: string;
  readonly ref: ContextRef;
  /** 類似度スコア（あれば）。 */
  readonly score?: number;
}

/** ContextProvider が返す、対象に関連するコンテキストのまとまり。 */
export interface ContextBrief {
  readonly target: ContextTarget;
  readonly snippets: readonly ContextSnippet[];
  /** 外部コンテキストが無い場合 true（例: NoneContextProvider）。 */
  readonly empty: boolean;
}

export interface ContextProvider {
  readonly kind: ContextProviderKind;

  /** 対象 Salesforce メタデータに関連するプロジェクト/顧客コンテキストを取得する。 */
  relatedContext(target: ContextTarget): Promise<ContextBrief>;

  /** spawn した MCP プロセス等のリソースを解放する。 */
  close(): Promise<void>;
}
