// ----------------------------------------------------------------------------
// グローバル検索インデックス
//
// Cmd+K で開くコマンドパレットの対象となる全コンポーネントの軽量メタを生成。
// 各ページに `<script type="application/json" id="yohaku-search-index">` で
// 埋め込んで配信する (file:// でも fetch 不要)。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import type { KnowledgeGraph } from "../types/graph.js";
import { labelIfDistinct } from "./display.js";
import type { ComponentType } from "./sections.js";

export interface SearchIndexEntry {
  readonly type: ComponentType;
  readonly name: string;
  /** lowercase 化済の name (ファジー検索用) */
  readonly nameLc: string;
  /** 日本語ラベル (object/flow/lwc)。無ければ undefined。 */
  readonly label?: string;
  /** lowercase 化済の label (日本語入力でのファジー検索用) */
  readonly labelLc?: string;
  readonly domain?: string;
  readonly domainLc?: string;
  /** href は assetsPrefix からの相対 URL。各ページで書き直す */
  readonly href: string;
}

export interface SearchIndex {
  readonly version: 1;
  readonly entries: readonly SearchIndexEntry[];
}

export function buildSearchIndex(
  graph: KnowledgeGraph,
  domainsConfig?: DomainsConfig | null,
): SearchIndex {
  const domainMap = new Map<string, string>();
  if (domainsConfig !== null && domainsConfig !== undefined) {
    for (const d of domainsConfig.domains) {
      for (const m of d.members) domainMap.set(`${m.type}:${m.name}`, d.label);
    }
  }

  const entries: SearchIndexEntry[] = [];
  const push = (type: ComponentType, name: string, rawLabel?: string): void => {
    const key = `${type}:${name}`;
    const domain = domainMap.get(key);
    const safe = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
    const href = `component/${type}/${encodeURIComponent(safe)}.html`;
    const label = labelIfDistinct(rawLabel, name);
    let entry: SearchIndexEntry = { type, name, nameLc: name.toLowerCase(), href };
    if (label !== undefined) entry = { ...entry, label, labelLc: label.toLowerCase() };
    if (domain !== undefined) entry = { ...entry, domain, domainLc: domain.toLowerCase() };
    entries.push(entry);
  };
  for (const c of graph.apexClasses) push("apex", c.fullyQualifiedName);
  for (const t of graph.apexTriggers) push("trigger", t.fullyQualifiedName);
  for (const l of graph.lwcs) push("lwc", l.fullyQualifiedName, l.masterLabel);
  for (const o of graph.objects) push("object", o.fullyQualifiedName, o.label);
  for (const f of graph.flows) push("flow", f.fullyQualifiedName, f.label);

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { version: 1, entries };
}
