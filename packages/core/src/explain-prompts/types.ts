// ----------------------------------------------------------------------------
// yohaku explain-prompts 出力型
//
// LLM が「html-write 用 fill.json」を 1 ショットで返せるようにするための
// 一括プロンプト + コンテキスト。
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";

export type ExplainBlockKind =
  | "business-meaning"
  | "concerns"
  | "processing-detail-narrative";

export interface ExplainPromptItem {
  readonly type: ComponentType;
  readonly name: string;
  readonly blockId: ExplainBlockKind;
  readonly prompt: string;
  /** graph から抜粋した参考情報 (LLM が読みやすい JSON) */
  readonly context: Readonly<Record<string, unknown>>;
}

export interface ExplainPromptsOutput {
  readonly version: 1;
  readonly format: "yohaku-explain-prompts";
  readonly generatedAt: string;
  /** トップレベル指示 (全 items を 1 ショットで埋めるための注意書き) */
  readonly instructions: string;
  /** LLM に「最終的に返すべき JSON 形」を示すテンプレ */
  readonly outputTemplate: {
    readonly version: 1;
    readonly components: readonly { type: string; name: string; blocks: Record<string, string> }[];
  };
  readonly items: readonly ExplainPromptItem[];
}
