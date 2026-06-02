// ----------------------------------------------------------------------------
// タイプ別 index ページ
//
// breadcrumb の中段 "Apex" や "Flow" をクリックしたとき、
// `component/<type>/index.html` に遷移する。各タイプの全コンポーネントを
// カードグリッドで一覧表示 + クライアントサイドフィルタを提供。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import { summaryForApex, summaryForApexTrigger } from "../render/summary.js";
import type { KnowledgeGraph } from "../types/graph.js";
import { firstSentencePlain, labelIfDistinct, renderNameStacked } from "./display.js";
import { escapeAttr, escapeHtml, sanitizeFileName } from "./escape.js";
import { icon } from "./icons.js";
import type { ComponentType } from "./sections.js";

function escapeJsonForScript(s: string): string {
  return s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export interface TypeIndexItem {
  readonly name: string;
  /** 日本語ラベル (object/flow/lwc)。無ければ undefined。 */
  readonly label?: string;
  /** 見出し下の短い日本語説明 (apex/trigger)。 */
  readonly subtitle?: string;
  /** 1 行サマリ (簡潔な決定的テキスト) */
  readonly summary: string;
  /** 紐づくドメイン (あれば) */
  readonly domain?: string;
}

const TYPE_LABEL: Record<ComponentType, string> = {
  apex: "Apex Classes",
  trigger: "Apex Triggers",
  lwc: "Lightning Web Components",
  object: "SObjects",
  flow: "Flows",
};

export function renderTypeIndexPage(
  type: ComponentType,
  graph: KnowledgeGraph,
  domainsConfig?: DomainsConfig | null,
  searchIndexJson?: string,
): string {
  const items = collectItems(type, graph);
  const domainMap = buildDomainMap(domainsConfig);
  const enriched = items.map((it) => {
    const key = `${type}:${it.name}`;
    const domain = domainMap.get(key);
    return domain === undefined ? it : { ...it, domain };
  });

  const cards = enriched
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((it) => renderCard(type, it))
    .join("\n        ");

  const label = TYPE_LABEL[type];

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(label)} — yohakuforce</title>
  <link rel="stylesheet" href="../../assets/styles.css" />
  <link rel="stylesheet" href="../../assets/home.css" />
  <link rel="stylesheet" href="../../assets/cmdk.css" />
  ${searchIndexJson !== undefined ? `<script type="application/json" id="yohaku-search-index">${escapeJsonForScript(searchIndexJson)}</script>` : ""}
  <script src="../../assets/type-index.js" defer></script>
  <script src="../../assets/cmdk.js" defer></script>
</head>
<body data-href-prefix="../../">
  <header class="global-header">
    <div class="brand">
      <a href="../../index.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
        <span class="brand-dot">y</span>
        <span class="brand-name">yohakuforce</span>
        <span class="brand-sub">Knowledge Hub</span>
      </a>
    </div>
  </header>
  <header class="component-header">
    <nav class="breadcrumb">
      <a href="../../index.html">Home</a>
      <span class="sep">/</span>
      <span class="current">${escapeHtml(label)}</span>
    </nav>
    <h1>
      <span class="type-pill t-${escapeAttr(type)}">${escapeHtml(type)}</span>
      ${escapeHtml(label)}
      <span style="font-size:14px;color:var(--muted);font-weight:400;margin-left:8px;">${enriched.length} 件</span>
    </h1>
  </header>
  <main class="home-main">
    <div class="type-index-toolbar">
      <h2>絞り込み</h2>
      <input id="filter-input" class="filter-input" type="search" placeholder="名前・ドメインで検索 (例: Account, sales)" />
      <span class="muted" id="filter-counter" style="font-size:12px;"></span>
    </div>
    <div class="type-index-grid" id="type-index-grid">
        ${cards || `<p class="muted">該当する ${escapeHtml(label)} はありません。</p>`}
    </div>
  </main>
</body>
</html>
`;
}

function renderCard(type: ComponentType, it: TypeIndexItem): string {
  const href = `./${sanitizeFileName(it.name)}.html`;
  const domain = it.domain;
  // フィルタはラベルでも当たるよう data-name にラベルを含める。
  const filterText = `${it.label ?? ""} ${it.name}`.toLowerCase();
  const subtitle =
    it.subtitle !== undefined && it.subtitle !== ""
      ? `<div class="card-sub">${escapeHtml(it.subtitle)}</div>`
      : "";
  return `<a class="type-index-card" href="${escapeAttr(href)}" data-name="${escapeAttr(filterText)}" data-domain="${escapeAttr((domain ?? "").toLowerCase())}">
          <div class="card-name">${renderNameStacked(it.label, it.name)}</div>
          ${subtitle}
          <div class="card-meta">${escapeHtml(it.summary)}</div>
          ${domain !== undefined ? `<div class="card-domain">${icon("folder", { size: "11" })} ${escapeHtml(domain)}</div>` : ""}
        </a>`;
}

function collectItems(type: ComponentType, graph: KnowledgeGraph): TypeIndexItem[] {
  if (type === "apex") {
    return graph.apexClasses.map((c) => ({
      name: c.fullyQualifiedName,
      subtitle: firstSentencePlain(summaryForApex(c, graph)),
      summary: apexSummary(c),
    }));
  }
  if (type === "trigger") {
    return graph.apexTriggers.map((t) => ({
      name: t.fullyQualifiedName,
      subtitle: firstSentencePlain(summaryForApexTrigger(t, graph)),
      summary: `${t.object} / ${t.events.length} events`,
    }));
  }
  if (type === "lwc") {
    return graph.lwcs.map((l) => ({
      name: l.fullyQualifiedName,
      label: labelIfDistinct(l.masterLabel, l.fullyQualifiedName),
      summary: `${l.publicProperties.length} props / ${l.customEvents.length} events`,
    }));
  }
  if (type === "object") {
    return graph.objects.map((o) => ({
      name: o.fullyQualifiedName,
      label: labelIfDistinct(o.label, o.fullyQualifiedName),
      summary: `${o.isCustom ? "Custom" : "Standard"} / ${graph.fields.filter((f) => f.object === o.fullyQualifiedName).length} fields`,
    }));
  }
  return graph.flows.map((f) => ({
    name: f.fullyQualifiedName,
    label: labelIfDistinct(f.label, f.fullyQualifiedName),
    summary: `${f.type} / ${f.status} / ${f.body?.elements.length ?? 0} elements`,
  }));
}

function apexSummary(c: import("../types/graph.js").ApexClass): string {
  const methods = c.body?.methods.length ?? 0;
  const soql = c.body?.soqlQueries.length ?? 0;
  const dml = c.body?.dmlOperations.length ?? 0;
  return `${methods} methods${soql > 0 ? ` / SOQL ${soql}` : ""}${dml > 0 ? ` / DML ${dml}` : ""}${c.isTest ? " / Test" : ""}`;
}

function buildDomainMap(config: DomainsConfig | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (config === null || config === undefined) return m;
  for (const d of config.domains) {
    for (const member of d.members) {
      m.set(`${member.type}:${member.name}`, d.label);
    }
  }
  return m;
}

/**
 * type-index ページ用クライアント JS。
 */
export const TYPE_INDEX_JS = `(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("filter-input");
    const grid = document.getElementById("type-index-grid");
    const counter = document.getElementById("filter-counter");
    if (!input || !grid) return;
    const cards = Array.from(grid.querySelectorAll(".type-index-card"));
    function apply() {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      for (const c of cards) {
        const text = (c.getAttribute("data-name") || "") + " " + (c.getAttribute("data-domain") || "");
        const match = q === "" || text.indexOf(q) >= 0;
        c.classList.toggle("hidden", !match);
        if (match) shown++;
      }
      if (counter) counter.textContent = q === "" ? "" : shown + " / " + cards.length + " 件表示中";
    }
    input.addEventListener("input", apply);
  });
})();
`;
