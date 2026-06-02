// ----------------------------------------------------------------------------
// ホーム HTML (タブ + サイドバーツリー + 検索) のレンダラ
//
// すべての描画は data/*.json を fetch するクライアント側ロジック (assets/home.js)
// で行う。サイドバーのリンクツリーだけはサーバ側で展開する (No-JS でも辿れる)。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import type { KnowledgeGraph } from "../types/graph.js";
import { buildArchitecture, buildDomains, buildHotspots, buildStats } from "./data-builder.js";
import { escapeAttr, escapeHtml, sanitizeFileName } from "./escape.js";
import { icon } from "./icons.js";
import { renderOrgSettingsPanel } from "./org-settings.js";

const TYPE_ICON_NAME: Record<string, "apex" | "trigger" | "lwc" | "object" | "flow"> = {
  apex: "apex",
  trigger: "trigger",
  lwc: "lwc",
  object: "object",
  flow: "flow",
};

interface SidebarGroup {
  readonly type: string;
  readonly label: string;
  readonly items: readonly { readonly name: string }[];
}

export function renderHomeHtml(
  graph: KnowledgeGraph,
  domainsConfig?: DomainsConfig | null,
  searchIndexJson?: string,
  businessFlowsJson?: string,
): string {
  const groups: SidebarGroup[] = [
    {
      type: "apex",
      label: "Apex Classes",
      items: [...graph.apexClasses]
        .sort((a, b) => a.fullyQualifiedName.localeCompare(b.fullyQualifiedName))
        .map((c) => ({ name: c.fullyQualifiedName })),
    },
    {
      type: "trigger",
      label: "Triggers",
      items: [...graph.apexTriggers]
        .sort((a, b) => a.fullyQualifiedName.localeCompare(b.fullyQualifiedName))
        .map((t) => ({ name: t.fullyQualifiedName })),
    },
    {
      type: "lwc",
      label: "LWC",
      items: [...graph.lwcs]
        .sort((a, b) => a.fullyQualifiedName.localeCompare(b.fullyQualifiedName))
        .map((l) => ({ name: l.fullyQualifiedName })),
    },
    {
      type: "object",
      label: "Objects",
      items: [...graph.objects]
        .sort((a, b) => a.fullyQualifiedName.localeCompare(b.fullyQualifiedName))
        .map((o) => ({ name: o.fullyQualifiedName })),
    },
    {
      type: "flow",
      label: "Flows",
      items: [...graph.flows]
        .sort((a, b) => a.fullyQualifiedName.localeCompare(b.fullyQualifiedName))
        .map((f) => ({ name: f.fullyQualifiedName })),
    },
  ];

  // file:// で開いても動くよう、JSON をインライン埋め込みする。
  // fetch('./data/*.json') は file:// → file:// で CORS エラーになるため。
  const statsJson = JSON.stringify(buildStats(graph));
  const archJson = JSON.stringify(buildArchitecture(graph));
  const domainsJson = JSON.stringify(buildDomains(graph, domainsConfig ?? null));
  const hotspotsJson = JSON.stringify(buildHotspots(graph));

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>yohakuforce — Knowledge Hub</title>
  <link rel="stylesheet" href="./assets/styles.css" />
  <link rel="stylesheet" href="./assets/home.css" />
  <link rel="stylesheet" href="./assets/cmdk.css" />
  <script type="application/json" id="yohaku-data-stats">${escapeJsonForScript(statsJson)}</script>
  <script type="application/json" id="yohaku-data-architecture">${escapeJsonForScript(archJson)}</script>
  <script type="application/json" id="yohaku-data-domains">${escapeJsonForScript(domainsJson)}</script>
  <script type="application/json" id="yohaku-data-hotspots">${escapeJsonForScript(hotspotsJson)}</script>
  ${businessFlowsJson !== undefined ? `<script type="application/json" id="yohaku-data-business-flows">${escapeJsonForScript(businessFlowsJson)}</script>` : ""}
  ${searchIndexJson !== undefined ? `<script type="application/json" id="yohaku-search-index">${escapeJsonForScript(searchIndexJson)}</script>` : ""}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" defer></script>
  <script src="./assets/home.js" defer></script>
  <script src="./assets/cmdk.js" defer></script>
</head>
<body data-href-prefix="">
  <header class="global-header">
    <div class="brand">
      <span class="brand-dot">y</span>
      <span class="brand-name">yohakuforce</span>
      <span class="brand-sub">Knowledge Hub</span>
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <div class="search-bar">
        <span class="search-icon">${icon("search", { size: "16" })}</span>
        <input id="global-search" type="search" placeholder="コンポーネント検索" />
      </div>
      ${groups.map(renderSidebarGroup).join("\n      ")}
    </aside>
    <main class="home-main">
      <div class="tabs" role="tablist">
        <button class="tab-button" data-tab="stats" aria-selected="true">統計</button>
        <button class="tab-button" data-tab="business-flows" aria-selected="false">業務フロー</button>
        <button class="tab-button" data-tab="architecture" aria-selected="false">アーキテクチャ</button>
        <button class="tab-button" data-tab="domains" aria-selected="false">ドメインマップ</button>
        <button class="tab-button" data-tab="hotspots" aria-selected="false">ホットスポット</button>
        <button class="tab-button" data-tab="org-settings" aria-selected="false">組織設定</button>
      </div>

      <div class="tab-panel" data-panel="stats" data-active="true">
        <div id="stats-grid" class="stats-grid"></div>
        <p class="notice" style="margin-top:16px;" id="stats-totals"></p>
      </div>

      <div class="tab-panel" data-panel="business-flows" data-active="false">
        <div class="bf-toolbar">
          <div class="bf-scope-switcher" role="tablist">
            <button data-scope="domain" aria-selected="true">ドメイン単位</button>
            <button data-scope="object" aria-selected="false">オブジェクト単位</button>
          </div>
          <input id="bf-filter" type="search" placeholder="フロー名 / 構成要素で絞り込み" />
          <span id="bf-counter" class="muted"></span>
        </div>
        <div id="bf-list" class="bf-list"></div>
      </div>

      <div class="tab-panel" data-panel="architecture" data-active="false">
        <div class="arch-toolbar">
          <div class="diagram-switcher" role="tablist">
            <button data-mode="html" aria-selected="true">${icon("chart-bar", { size: "14" })}グループビュー</button>
            <button data-mode="mermaid" aria-selected="false">${icon("diagram", { size: "14" })}Mermaid グラフ</button>
          </div>
          <span class="fallback-note"></span>
        </div>
        <div id="arch-html" class="arch-canvas"></div>
        <div id="arch-mermaid" class="mermaid-container" style="display:none;"></div>
      </div>

      <div class="tab-panel" data-panel="domains" data-active="false">
        <p class="notice" id="unclassified-count" style="margin-bottom:14px;"></p>
        <ul id="domain-list" class="domain-list"></ul>
      </div>

      <div class="tab-panel" data-panel="hotspots" data-active="false">
        <div id="hotspots-list"></div>
      </div>

      <div class="tab-panel" data-panel="org-settings" data-active="false">
        ${renderOrgSettingsPanel(graph)}
      </div>
    </main>
  </div>
</body>
</html>
`;
}

/**
 * `<script type="application/json">` 内に書く JSON 文字列の安全化。
 * `</script>` で閉じられないよう `<` を `<` に置換する。
 */
function escapeJsonForScript(s: string): string {
  return s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function renderSidebarGroup(g: SidebarGroup): string {
  const iconName = TYPE_ICON_NAME[g.type] ?? "folder";
  // 初期状態: コンポーネントが多いタイプは折り畳む (>15 件)
  const initialCollapsed = g.items.length > 15 ? "true" : "false";
  return `<div class="sidebar-group" data-collapsed="${initialCollapsed}" data-type="${escapeAttr(g.type)}">
        <button class="sidebar-group-header" data-toggle="${escapeAttr(g.type)}">
          <span class="chevron">${icon("chevron-right", { size: "14", className: "icon chevron" })}</span>
          <span class="group-label">
            <span class="group-icon t-${escapeAttr(g.type)}">${icon(iconName, { size: "16" })}</span>
            ${escapeHtml(g.label)}
          </span>
          <span class="count">${g.items.length}</span>
          <a class="group-link" href="./component/${escapeAttr(g.type)}/index.html" title="${escapeHtml(g.label)} 一覧を開く" onclick="event.stopPropagation();">${icon("external", { size: "13" })}</a>
        </button>
        <ul class="type-list">
        ${g.items
          .slice(0, 200)
          .map(
            (it) =>
              `<li><a href="./component/${escapeAttr(g.type)}/${escapeAttr(sanitizeFileName(it.name))}.html">${escapeHtml(it.name)}</a></li>`,
          )
          .join("\n        ")}
          ${g.items.length > 200 ? `<li class="more">…他 ${g.items.length - 200} 件 (検索で絞り込み)</li>` : ""}
        </ul>
      </div>`;
}
