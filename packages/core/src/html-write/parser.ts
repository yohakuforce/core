// ----------------------------------------------------------------------------
// HTML AI-managed ブロック操作
//
// 設計書 HTML 内のマーカー:
//   <!-- yohaku:block kind="ai_managed" id="<id>" start -->
//   ...content...
//   <!-- yohaku:block kind="ai_managed" id="<id>" end -->
// を安全に発見・置換する。kind が "ai_managed" 以外 (将来 "human_managed" 等)
// は触らない。同一ファイル内に同 id のブロックが複数あればエラー (仕様逸脱)。
// ----------------------------------------------------------------------------

const MARKER_START_PATTERN = /<!--\s*yohaku:block\s+kind="([^"]+)"\s+id="([^"]+)"\s+start\s*-->/g;
const MARKER_END_PATTERN_FN = (id: string): RegExp =>
  // 同じ id の end マーカーを matching する。
  new RegExp(`<!--\\s*yohaku:block\\s+kind="[^"]+"\\s+id="${escapeRegex(id)}"\\s+end\\s*-->`);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ParsedBlock {
  readonly kind: string;
  readonly id: string;
  /** マーカー含めた範囲 (start 開きから end 閉じまで) */
  readonly startIndex: number;
  readonly endIndex: number;
  /** content 部分 (マーカーを除いた中身) */
  readonly content: string;
  /** content 部分の絶対 index */
  readonly contentStart: number;
  readonly contentEnd: number;
}

export class HtmlBlockParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HtmlBlockParseError";
  }
}

export function parseBlocks(html: string): readonly ParsedBlock[] {
  const out: ParsedBlock[] = [];
  const seen = new Set<string>();
  MARKER_START_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null = MARKER_START_PATTERN.exec(html);
  while (m !== null) {
    const fullStart = m.index;
    const startMarker = m[0];
    const kind = m[1] ?? "";
    const id = m[2] ?? "";
    if (seen.has(id)) {
      throw new HtmlBlockParseError(`duplicate ai_managed block id="${id}"`);
    }
    seen.add(id);
    const contentStart = fullStart + startMarker.length;
    const endRe = MARKER_END_PATTERN_FN(id);
    endRe.lastIndex = contentStart;
    const tail = html.slice(contentStart);
    const endMatch = endRe.exec(tail);
    if (endMatch === null) {
      throw new HtmlBlockParseError(`block id="${id}" has no matching end marker`);
    }
    const endIndexInTail = endMatch.index;
    const endMarkerLen = endMatch[0].length;
    const contentEnd = contentStart + endIndexInTail;
    const fullEnd = contentEnd + endMarkerLen;
    out.push({
      kind,
      id,
      startIndex: fullStart,
      endIndex: fullEnd,
      content: html.slice(contentStart, contentEnd),
      contentStart,
      contentEnd,
    });
    MARKER_START_PATTERN.lastIndex = fullEnd;
    m = MARKER_START_PATTERN.exec(html);
  }
  return out;
}

/**
 * 指定 id のブロックの中身を replacement で置換した HTML を返す。
 * - kind=="ai_managed" 以外のブロックは触らない (rejected として反映しない)
 * - 該当 id が無ければ undefined を返す (呼び側で missing 報告)
 *
 * 呼び側が複数 id を更新したい場合は、updates map を渡せば 1 パスで処理する。
 */
export function applyBlockUpdates(
  html: string,
  updates: Readonly<Record<string, string>>,
): {
  readonly updatedHtml: string;
  readonly updatedIds: readonly string[];
  readonly missingIds: readonly string[];
  readonly rejectedIds: readonly { id: string; reason: string }[];
} {
  const blocks = parseBlocks(html);
  const blockById = new Map<string, ParsedBlock>();
  for (const b of blocks) blockById.set(b.id, b);

  const updatedIds: string[] = [];
  const missingIds: string[] = [];
  const rejectedIds: { id: string; reason: string }[] = [];

  // 範囲の重なりが起きないように、対象ブロックを startIndex で降順ソートして
  // 末尾から置換する。
  const targets: { block: ParsedBlock; replacement: string }[] = [];
  for (const id of Object.keys(updates)) {
    const block = blockById.get(id);
    if (block === undefined) {
      missingIds.push(id);
      continue;
    }
    if (block.kind !== "ai_managed") {
      rejectedIds.push({ id, reason: `kind="${block.kind}" is not writable` });
      continue;
    }
    targets.push({ block, replacement: updates[id] ?? "" });
  }
  targets.sort((a, b) => b.block.startIndex - a.block.startIndex);

  let result = html;
  for (const { block, replacement } of targets) {
    const before = result.slice(0, block.contentStart);
    const after = result.slice(block.contentEnd);
    // 改行 + 4 スペースインデントで整形 (既存生成と同じ見た目に揃える)
    const indented = formatReplacement(replacement);
    result = before + indented + after;
    updatedIds.push(block.id);
  }
  // 更新成功は元の登録順に並び替える (UI 安定性)
  const originalOrder = Object.keys(updates).filter((id) => updatedIds.includes(id));

  return {
    updatedHtml: result,
    updatedIds: originalOrder,
    missingIds,
    rejectedIds,
  };
}

function formatReplacement(replacement: string): string {
  // マーカーの直後にすぐ content が続くと既存出力の整形と少し違う。
  // 既存テンプレは start 直後に改行→任意 content→改行→ end のパターン。
  // 受け取った replacement の前後改行を 1 つに正規化して合わせる。
  const trimmed = replacement.replace(/^\s*\n?/, "\n        ").replace(/\s*$/, "\n        ");
  return trimmed;
}
