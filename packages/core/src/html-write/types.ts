// ----------------------------------------------------------------------------
// yohaku html-write 入力型
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";

/**
 * `yohaku html-write` が受け取る JSON 仕様。
 * 1 件のコンポーネントに対し、上書きしたい AI-managed ブロック id → HTML を
 * map で渡す。htmlContent はそのまま注入されるので、呼び側で安全な HTML を
 * 渡す責任がある (typical: LLM 出力をプロンプトでサニタイズ済の段落 / リスト)。
 */
export interface HtmlWriteComponentEntry {
  readonly type: ComponentType;
  readonly name: string;
  readonly blocks: Readonly<Record<string, string>>;
}

export interface HtmlWriteInput {
  readonly version: 1;
  readonly components: readonly HtmlWriteComponentEntry[];
}

export interface HtmlWriteResult {
  /** 更新が反映された (component, blockId) のペア */
  readonly updated: readonly { componentName: string; blockId: string; path: string }[];
  /** 対象の component が見つからなかった */
  readonly missingComponents: readonly { type: string; name: string }[];
  /** 対象 component の中に該当 blockId が無かった */
  readonly missingBlocks: readonly { componentName: string; blockId: string }[];
  /** kind が "ai_managed" 以外のブロックに書き込もうとして拒否されたもの */
  readonly rejectedBlocks: readonly { componentName: string; blockId: string; reason: string }[];
}

export class HtmlWriteInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HtmlWriteInputError";
  }
}
