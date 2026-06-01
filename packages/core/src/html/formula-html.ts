// ----------------------------------------------------------------------------
// 数式 (ValidationRule / 数式項目) の自然語化 → 安全な HTML 断片へ変換するヘルパ
//
// render/formula.ts の formulaToNaturalLanguage は Markdown 風テキスト
// (`**強調**` / `` `コード` `` / `- 箇条書き` / インデント) を返す。
// HTML 設計書ではこれを <pre> + 最小限のインライン装飾で忠実に描画する。
//
// 注意: graph.sqlite に格納された数式は XML 由来で実体参照 (`&gt;` 等) のまま
// 入っていることがあるため、自然語化の前に必ずデコードする。
// ----------------------------------------------------------------------------

import { formulaToNaturalLanguage } from "../render/formula.js";
import { escapeHtml } from "./escape.js";

/** XML/HTML 実体参照を元の文字へ戻す (数式パーサが演算子を認識できるように) */
export function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * 自然語化テキスト (Markdown 風) を <pre> ベースの安全な HTML へ変換する。
 * - 先に HTML エスケープ → 続けて `**強調**` と `` `code` `` のみ復元
 * - 箇条書き / インデントは <pre> の空白保持で表現
 */
function naturalLanguageToHtml(naturalLanguage: string): string {
  const esc = escapeHtml(naturalLanguage)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return `<pre class="formula-nl">${esc}</pre>`;
}

/**
 * 数式文字列を「自然語の算出ロジック (HTML)」へ変換する高水準 API。
 * パース不能な場合は formulaToNaturalLanguage 側が原文フォールバックを返す。
 */
export function formulaToHtml(rawFormula: string): string {
  const decoded = decodeXmlEntities(rawFormula);
  const nl = formulaToNaturalLanguage(decoded);
  return naturalLanguageToHtml(nl);
}

/** 元の数式 (原文) を折りたたみで併記するための <details> 断片 */
export function rawFormulaDetails(rawFormula: string, summaryLabel = "原文 (数式)"): string {
  const decoded = decodeXmlEntities(rawFormula).trim();
  return `<details class="formula-raw">
      <summary>${escapeHtml(summaryLabel)}</summary>
      <pre><code>${escapeHtml(decoded)}</code></pre>
    </details>`;
}
