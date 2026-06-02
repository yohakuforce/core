// ----------------------------------------------------------------------------
// HTML render types
// ----------------------------------------------------------------------------

import type { ComponentType, SectionAuditResult, SectionId } from "./sections.js";

export type { ComponentType, SectionAuditResult } from "./sections.js";

export interface HtmlRenderOptions {
  /**
   * Phase 1+ で利用: 必須セクションが揃わない場合に throw する
   */
  readonly strict?: boolean;
  /**
   * Phase 1+ で利用: 出力対象タイプの絞り込み (--types フラグ)
   */
  readonly typesFilter?: readonly ComponentType[];
  /**
   * Phase 5+ で利用: 読み込んだ domains.yaml。指定があればドメインタブ/
   * related-domains セクションがこちらを優先参照する。
   */
  readonly domainsConfig?: import("../domains/types.js").DomainsConfig | null;
  /**
   * git log を実行する作業ディレクトリ (= プロジェクト root)。
   * 未指定なら process.cwd()。
   */
  readonly gitCwd?: string;
  /**
   * Phase 14: 取り込み済テストカバレッジ。指定があれば apex/trigger の
   * test-coverage セクションが実 % / 行数を表示。
   */
  readonly coverage?: import("../coverage/types.js").CoverageReport | null;
}

export interface HtmlRenderResult {
  readonly written: readonly string[];
  readonly skipped: readonly string[];
  readonly auditFailures: readonly SectionAuditResult[];
  readonly warnings: readonly { code: string; message: string }[];
}

export interface SectionViewModel {
  readonly id: SectionId;
  readonly title: string;
  /** 既に HTML エスケープ済みの安全な HTML 断片 */
  readonly htmlContent: string;
  /** LLM ブロックの場合に編集マーカー id を入れる */
  readonly editableBlockId?: string;
}

export interface ComponentViewModel {
  readonly type: ComponentType;
  /** API 名 (fullyQualifiedName)。href / ファイル名生成に使う不変の識別子。 */
  readonly name: string;
  /**
   * 日本語ラベル (SObject.label / Flow.label / LWC.masterLabel)。
   * 主表示に使う。API 名と同一・空・apex/trigger の場合は undefined。
   */
  readonly label?: string;
  /**
   * 見出し下に出す短い日本語説明。ラベルを持たない apex/trigger で、
   * 決定的サマリの先頭 1 文を入れて「日本語の手がかり」を与える用途。
   */
  readonly subtitle?: string;
  readonly sections: readonly SectionViewModel[];
}
