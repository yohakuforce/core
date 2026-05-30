// ----------------------------------------------------------------------------
// package.xml manifest 生成
//
// `--source=org` モードで sf CLI に渡す manifest を生成する純粋関数。
// この関数はファイルシステムにも sf CLI にも触らない。
// ----------------------------------------------------------------------------

/**
 * yohaku 内部で扱うコンポーネントタイプから sf project retrieve start の
 * --metadata に渡せる "MetadataType[:members]" 表記に変換するためのマップ。
 *
 * - apex      → ApexClass
 * - trigger   → ApexTrigger
 * - lwc       → LightningComponentBundle
 * - object    → CustomObject
 * - flow      → Flow
 *
 * 上記以外のタイプは、ユーザーが --metadata に直接渡す ("Profile" など) も
 * 許容するため、未知のタイプはそのまま透過する。
 */
const INTERNAL_TO_METADATA: Record<string, string> = {
  apex: "ApexClass",
  trigger: "ApexTrigger",
  lwc: "LightningComponentBundle",
  object: "CustomObject",
  flow: "Flow",
};

/**
 * 「デフォルト一括取得」で必ず含めるメタデータタイプ。
 * Phase 4 では graph builder が解釈できる主要 5 タイプに絞る。Phase 6 以降で
 * Profile / PermissionSet / Layout 等を順次拡張する。
 */
export const DEFAULT_RETRIEVE_TYPES: readonly string[] = [
  "ApexClass",
  "ApexTrigger",
  "LightningComponentBundle",
  "CustomObject",
  "Flow",
];

export interface BuildManifestOptions {
  /** Salesforce API version (例: "62.0") */
  readonly apiVersion: string;
  /**
   * 取得対象。空 / 未指定なら DEFAULT_RETRIEVE_TYPES を全件 wildcard で取得。
   * 値は内部タイプ (apex/trigger/...) または Salesforce のメタデータ名
   * (ApexClass 等) を直接受け付ける。
   */
  readonly types?: readonly string[];
}

export function buildPackageManifest(options: BuildManifestOptions): string {
  const requested = (options.types ?? []).map((t) => INTERNAL_TO_METADATA[t] ?? t);
  const types = requested.length === 0 ? DEFAULT_RETRIEVE_TYPES : unique(requested);
  const blocks = types
    .map(
      (t) => `    <types>
        <members>*</members>
        <name>${escapeXml(t)}</name>
    </types>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
${blocks}
    <version>${escapeXml(options.apiVersion)}</version>
</Package>
`;
}

function unique<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
