// ----------------------------------------------------------------------------
// Render format
//
// `--format` フラグで md / html / 両方を選択可能にする。Phase 0 時点では
// md がデフォルト (後方互換)。Phase 3 完了後に md,html へデフォルト切替予定。
// ----------------------------------------------------------------------------

export type RenderFormat = "md" | "html";

const ALL_FORMATS: readonly RenderFormat[] = ["md", "html"] as const;

export class InvalidRenderFormatError extends Error {
  readonly invalid: string;
  constructor(invalid: string) {
    super(`Invalid --format value: "${invalid}". Allowed: md, html, md,html`);
    this.invalid = invalid;
    this.name = "InvalidRenderFormatError";
  }
}

/**
 * `--format` 文字列を RenderFormat[] に正規化。
 * - undefined / 空文字 → ["md"] (デフォルト)
 * - "md" / "html" / "md,html" / "html,md" → 重複除去した配列
 * - 不正値 → InvalidRenderFormatError
 */
export function parseRenderFormats(raw: string | undefined): readonly RenderFormat[] {
  if (raw === undefined || raw.trim() === "") return ["md"];
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  const seen = new Set<RenderFormat>();
  for (const part of parts) {
    if (!isRenderFormat(part)) throw new InvalidRenderFormatError(part);
    seen.add(part);
  }
  if (seen.size === 0) return ["md"];
  return ALL_FORMATS.filter((f) => seen.has(f));
}

export function isRenderFormat(value: string): value is RenderFormat {
  return value === "md" || value === "html";
}

/**
 * format に応じた出力ディレクトリを返す。
 * - md: 既存互換のため outRoot 直下 (例: docs/generated/)
 * - html: outRoot/html/ サブディレクトリ (例: docs/generated/html/)
 *
 * Phase 3 完了後、両方を outRoot/md/, outRoot/html/ に揃える破壊的変更を検討する。
 */
export function resolveFormatOutputDir(outRoot: string, format: RenderFormat): string {
  if (format === "md") return outRoot;
  return `${outRoot.replace(/\/+$/, "")}/html`;
}
