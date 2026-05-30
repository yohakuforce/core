// ----------------------------------------------------------------------------
// HTML escape utilities
//
// 全ての動的文字列は escapeHtml/escapeAttr のいずれかを通してから HTML に
// 入れる。Phase 1+ で渡される値はクラス名/メソッド名/SOQL 等、信頼性が低い
// ものも含むため、boundary でのエスケープを徹底する。
// ----------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML 属性値用エスケープ。escapeHtml と同等だが意図を明示する。
 */
export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * ファイル名として安全な形に正規化する。
 * - 英数 / ハイフン / アンダースコア / ドット のみ許可
 * - その他は `_` に置換
 * - 連続する `_` は 1 つに圧縮
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
}
