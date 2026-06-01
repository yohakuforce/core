// ----------------------------------------------------------------------------
// セクション内に埋め込む ai_managed ブロックのマーカー生成ヘルパ
//
// マーカーは html-write / preserve-blocks がファイル全体走査で拾うため、
// 決定的セクションの一部だけを LLM 編集対象にできる。空のときは
// PLACEHOLDER_HINT を含めて preserve 対象外にする (preserve-blocks 側で除外)。
// ----------------------------------------------------------------------------

import { escapeHtml } from "../escape.js";

// preserve-blocks.ts の PLACEHOLDER_HINT と完全一致させること
const PLACEHOLDER_HINT = "（このセクションは LLM で生成されます）";

export interface AiBlockOptions {
  readonly id: string;
  /** 前回 build / html-write で埋まった内容 (あれば再掲) */
  readonly preserved?: string;
  /** 空のとき表示する見出し/プロンプト */
  readonly heading: string;
  readonly prompt: string;
  /** 空プレースホルダに併記する決定的スケルトン (任意。LLM への根拠提示) */
  readonly skeleton?: string;
}

export function aiManagedBlock(opts: AiBlockOptions): string {
  const inner =
    opts.preserved !== undefined && opts.preserved.trim() !== ""
      ? `\n        ${opts.preserved}\n        `
      : `
    <div class="llm-placeholder">
      <p class="muted">${PLACEHOLDER_HINT}</p>
      <p class="hint">${escapeHtml(opts.prompt)}</p>
      ${opts.skeleton ?? ""}
    </div>`;
  return `<!-- yohaku:block kind="ai_managed" id="${opts.id}" start -->${inner}<!-- yohaku:block kind="ai_managed" id="${opts.id}" end -->`;
}
