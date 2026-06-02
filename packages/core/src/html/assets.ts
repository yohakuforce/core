// ----------------------------------------------------------------------------
// 静的 asset (CSS / JS) を文字列として埋め込む。
//
// 依存最小化のため Mermaid は CDN フォールバック (オプション) + HTML/CSS で
// 同等の図を常に描画できるようにする。Mermaid 読み込みに失敗・崩れ検知時は
// HTML/CSS 描画へ自動切替する。
// ----------------------------------------------------------------------------

export const HOME_CSS_EXTRA = `
/* ===== Icons (inline SVG) ===== */
.icon { display: inline-block; vertical-align: -2px; flex-shrink: 0; }
.with-icon { display: inline-flex; align-items: center; gap: 6px; }

/* ===== Top bar (SLDS-like) ===== */
.global-header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  height: 56px;
  display: flex; align-items: center; gap: 24px;
  box-shadow: var(--shadow-sm);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--fg-strong); }
.brand .brand-dot {
  width: 28px; height: 28px; border-radius: 6px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 700;
}
.brand-name { font-size: 15px; }
.brand-sub { color: var(--muted); font-size: 12px; margin-left: 4px; }

/* ===== Layout (sidebar + main) =====
 * minmax(0, 1fr) で min-content (Mermaid の min-width 等) に列幅が
 * 引きずられるのを防止。これでタブを切替えても main 列の幅は変動しない。
 */
.layout {
  display: grid; grid-template-columns: 260px minmax(0, 1fr);
  min-height: calc(100vh - 56px);
}
.sidebar {
  background: var(--bg-surface); border-right: 1px solid var(--border);
  padding: 16px 12px; overflow-y: auto; max-height: calc(100vh - 56px);
  position: sticky; top: 56px;
}
.search-bar { margin: 0 0 14px; position: relative; }
.search-bar .search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--muted); pointer-events: none;
}
.search-bar input {
  width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border);
  border-radius: var(--radius); font-size: 13px; background: var(--bg-alt);
  font-family: var(--font-sans);
}
.search-bar input:focus { outline: none; border-color: var(--accent); background: #fff; box-shadow: 0 0 0 3px var(--accent-bg); }

/* Collapsible sidebar groups */
.sidebar .sidebar-group { margin-bottom: 4px; border-bottom: 1px solid transparent; }
.sidebar .sidebar-group-header {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: var(--radius); font-size: 12px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--fg-strong); cursor: pointer;
  background: transparent; border: 0; text-align: left;
  font-family: var(--font-sans);
}
.sidebar .sidebar-group-header:hover { background: var(--bg-alt); }
.sidebar .sidebar-group-header .chevron {
  color: var(--muted-soft); transition: transform 0.15s ease, color 0.15s ease;
  width: 16px; height: 16px; stroke-width: 2.4;
}
/* 開いている時: 下向き(▼) + アクセント色 / 閉じている時: 右向き(▸) + グレー で明示 */
.sidebar .sidebar-group[data-collapsed="false"] .chevron { transform: rotate(90deg); color: var(--accent); }
.sidebar .sidebar-group[data-collapsed="false"] .sidebar-group-header { color: var(--accent); }
.sidebar .sidebar-group-header .group-label {
  flex: 1; display: inline-flex; align-items: center; gap: 8px;
}
.sidebar .sidebar-group-header .group-icon {
  width: 16px; height: 16px;
}
.sidebar .sidebar-group-header .group-icon.t-apex    { color: var(--type-apex); }
.sidebar .sidebar-group-header .group-icon.t-trigger { color: var(--type-trigger); }
.sidebar .sidebar-group-header .group-icon.t-lwc     { color: var(--type-lwc); }
.sidebar .sidebar-group-header .group-icon.t-object  { color: var(--type-object); }
.sidebar .sidebar-group-header .group-icon.t-flow    { color: var(--type-flow); }
.sidebar .sidebar-group-header .count {
  color: var(--muted); font-weight: 500;
  background: var(--bg-alt); padding: 1px 8px; border-radius: 999px; font-size: 11px;
}
.sidebar .sidebar-group-header .group-link {
  color: var(--muted); padding: 2px; border-radius: 3px; opacity: 0;
  transition: opacity 0.1s;
}
.sidebar .sidebar-group-header:hover .group-link { opacity: 1; }
.sidebar .sidebar-group-header .group-link:hover { color: var(--accent); background: var(--bg-surface); }

.sidebar .type-list {
  font-size: 13px; list-style: none; padding: 4px 0 6px 0; margin: 0;
  overflow: hidden;
}
.sidebar .sidebar-group[data-collapsed="true"] .type-list { display: none; }
.sidebar .type-list li { margin: 0; }
.sidebar .type-list a {
  display: block; padding: 4px 12px 4px 30px; border-radius: 4px;
  color: var(--fg); font-size: 12.5px; word-break: break-all; line-height: 1.4;
}
.sidebar .type-list a:hover { background: var(--accent-bg); color: var(--accent); text-decoration: none; }
.sidebar .type-list .hidden { display: none; }
.sidebar .more { font-size: 11px; color: var(--muted); padding: 4px 30px; font-style: italic; }

/* ===== Tabs ===== */
.tabs {
  display: flex; gap: 0; border-bottom: 2px solid var(--border);
  margin: 0 0 20px; padding: 0;
}
.tab-button {
  padding: 12px 18px; cursor: pointer; border: 0; background: transparent;
  font-size: 13px; font-weight: 600; color: var(--muted);
  font-family: var(--font-sans); position: relative; bottom: -2px;
  border-bottom: 2px solid transparent;
}
.tab-button:hover { color: var(--fg); }
.tab-button[aria-selected="true"] {
  color: var(--accent); border-bottom-color: var(--accent);
}
.tab-panel { display: none; }
.tab-panel[data-active="true"] { display: block; }

/* ===== Tab: 統計 ===== */
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
.stat-card {
  padding: 16px 18px; background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
  position: relative; overflow: hidden;
}
.stat-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
}
.stat-card.t-apex::before    { background: var(--type-apex); }
.stat-card.t-trigger::before { background: var(--type-trigger); }
.stat-card.t-lwc::before     { background: var(--type-lwc); }
.stat-card.t-object::before  { background: var(--type-object); }
.stat-card.t-flow::before    { background: var(--type-flow); }
.stat-card .stat-type {
  font-size: 11px; text-transform: uppercase; color: var(--muted);
  letter-spacing: 0.06em; font-weight: 600;
}
.stat-card .stat-count { font-size: 32px; font-weight: 700; margin: 6px 0; color: var(--fg-strong); }
.stat-card .stat-meta { font-size: 12px; color: var(--muted); }

/* ===== Tab: アーキテクチャ ===== */
.arch-toolbar {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  margin-bottom: 16px; padding: 10px 14px;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
}
.diagram-switcher { display: inline-flex; gap: 0; background: var(--bg-alt); border-radius: var(--radius); padding: 3px; }
.diagram-switcher button {
  font-size: 12.5px; padding: 6px 14px; border: 0;
  background: transparent; border-radius: 4px; cursor: pointer; color: var(--muted);
  font-family: var(--font-sans); font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px;
}
.diagram-switcher button:hover { color: var(--fg); }
.diagram-switcher button[aria-selected="true"] {
  background: var(--bg-surface); color: var(--accent); box-shadow: var(--shadow-sm);
  font-weight: 600;
}
.arch-toolbar .fallback-note { font-size: 11px; color: var(--muted); margin-left: auto; }

/* HTML group view: 4-lane layout, no overlapping lines */
.arch-canvas {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 0; box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.arch-lanes {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0; border-bottom: 1px solid var(--border);
}
@media (max-width: 1100px) { .arch-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px)  { .arch-lanes { grid-template-columns: 1fr; } }

.arch-lane {
  padding: 16px 14px; min-width: 0; min-height: 220px;
  border-right: 1px solid var(--border); background: var(--bg-alt);
  display: flex; flex-direction: column;
}
.arch-lane:last-child { border-right: 0; }
@media (max-width: 1100px) {
  .arch-lane:nth-child(2n) { border-right: 0; }
  .arch-lane { border-bottom: 1px solid var(--border); }
}
.arch-lane-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.arch-lane-header .lane-icon-wrap {
  width: 28px; height: 28px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
}
.arch-lane-header .lane-icon-wrap .icon { width: 16px; height: 16px; }
.arch-lane-header .lane-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--fg-strong); flex: 1; min-width: 0; }
.arch-lane-header .lane-count {
  background: var(--bg-surface); color: var(--muted);
  font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 999px;
  border: 1px solid var(--border);
}
.arch-lane.l-object  .lane-icon-wrap { background: var(--type-object); }
.arch-lane.l-apex    .lane-icon-wrap { background: var(--type-apex); }
.arch-lane.l-trigger .lane-icon-wrap { background: var(--type-trigger); }
.arch-lane.l-flow    .lane-icon-wrap { background: var(--type-flow); }

.arch-lane-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

.arch-node {
  display: block; background: var(--bg-surface);
  border: 1px solid var(--border); border-left: 3px solid var(--border-strong);
  border-radius: var(--radius); padding: 8px 12px;
  font-size: 12.5px; cursor: pointer; transition: all 0.15s ease;
  text-decoration: none; color: inherit; min-width: 0;
}
.arch-node:hover {
  border-color: var(--accent); border-left-color: var(--accent);
  box-shadow: var(--shadow-md); transform: translateX(2px); text-decoration: none;
}
.arch-lane.l-object  .arch-node { border-left-color: var(--type-object); }
.arch-lane.l-apex    .arch-node { border-left-color: var(--type-apex); }
.arch-lane.l-trigger .arch-node { border-left-color: var(--type-trigger); }
.arch-lane.l-flow    .arch-node { border-left-color: var(--type-flow); }
.arch-node .node-name {
  font-weight: 500; color: var(--fg-strong);
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.arch-empty { color: var(--muted); font-size: 12px; padding: 8px 0; font-style: italic; }

.arch-edges-panel {
  padding: 16px 18px; background: var(--bg-surface);
}
.arch-edges-panel h3 {
  font-size: 11px; text-transform: uppercase; color: var(--muted);
  margin: 0 0 12px; letter-spacing: 0.06em; font-weight: 600;
  display: flex; align-items: center; gap: 6px;
}
.arch-edges-list {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px;
}
.arch-edges-list li {
  font-size: 12px; padding: 8px 12px; background: var(--bg-alt);
  border-radius: var(--radius); border-left: 3px solid var(--muted-soft);
  display: flex; align-items: center; gap: 8px; min-width: 0;
}
.arch-edges-list li .edge-kind {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  padding: 2px 8px; border-radius: 3px; background: var(--bg-surface);
  color: var(--muted); flex-shrink: 0; letter-spacing: 0.04em;
}
.arch-edges-list li code {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.arch-edges-list li .arrow { color: var(--muted-soft); flex-shrink: 0; }
.arch-edges-list li.k-queries  { border-left-color: var(--type-object); }
.arch-edges-list li.k-queries  .edge-kind { color: var(--type-object); }
.arch-edges-list li.k-writes   { border-left-color: var(--type-trigger); }
.arch-edges-list li.k-writes   .edge-kind { color: var(--type-trigger); }
.arch-edges-list li.k-triggers { border-left-color: var(--type-trigger); }
.arch-edges-list li.k-triggers .edge-kind { color: var(--type-trigger); }
.arch-edges-list li.k-uses     { border-left-color: var(--type-apex); }
.arch-edges-list li.k-uses     .edge-kind { color: var(--type-apex); }

/* Mermaid container (arch) — full-bleed, scaled SVG, soft frame */
.mermaid-container {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 24px;
  overflow: auto; min-height: 600px;
  box-shadow: var(--shadow-sm);
  display: flex; align-items: center; justify-content: center;
}
.mermaid-container.error { background: #fff8f8; border-color: var(--severity-high-fg); }
.mermaid-container svg {
  max-width: 100%; height: auto !important;
  min-width: 800px;
}
.mermaid-error-msg { color: var(--severity-high-fg); font-size: 12px; }

/* ===== Mermaid SVG styling (Salesforce-flavored) — applies to all mermaid blocks ===== */
.mermaid-host svg, .mermaid-container svg {
  font-family: var(--font-sans) !important;
}
/* Default node */
.mermaid-host svg .node rect,
.mermaid-host svg .node polygon,
.mermaid-container svg .node rect,
.mermaid-container svg .node polygon {
  fill: var(--bg-surface) !important;
  stroke: var(--border-strong) !important;
  stroke-width: 1.2px !important;
  rx: 6 !important; ry: 6 !important;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.06));
}
/* Start/End (stadium) */
.mermaid-host svg .node.default[id*="n_start"] rect,
.mermaid-host svg .node.default[id*="n_end"] rect,
.mermaid-container svg .node.default[id*="n_start"] rect,
.mermaid-container svg .node.default[id*="n_end"] rect {
  fill: var(--accent-bg) !important;
  stroke: var(--accent) !important;
  stroke-width: 1.4px !important;
}
.mermaid-host svg .nodeLabel, .mermaid-container svg .nodeLabel {
  color: var(--fg-strong) !important; font-weight: 500 !important; font-size: 13px !important;
}
/* Edges */
.mermaid-host svg .edgePath path, .mermaid-container svg .edgePath path,
.mermaid-host svg .flowchart-link, .mermaid-container svg .flowchart-link {
  stroke: var(--muted-soft) !important; stroke-width: 1.4px !important;
  fill: none !important;
}
.mermaid-host svg .arrowMarkerPath, .mermaid-container svg .arrowMarkerPath {
  fill: var(--muted-soft) !important; stroke: var(--muted-soft) !important;
}
.mermaid-host svg .edgeLabel, .mermaid-container svg .edgeLabel {
  background: var(--bg-surface) !important;
  color: var(--muted) !important; font-size: 11px !important; font-weight: 500 !important;
}
.mermaid-host svg .edgeLabel rect, .mermaid-container svg .edgeLabel rect {
  fill: var(--bg-surface) !important; opacity: 0.95 !important;
}
/* Decision (diamond) */
.mermaid-host svg .node polygon, .mermaid-container svg .node polygon {
  fill: var(--type-lwc-bg) !important;
  stroke: var(--type-lwc) !important;
}
/* SOQL/DML parallelogram — fall back as rect with subtle tint */
.mermaid-host svg g.node[class*="trapez"] rect,
.mermaid-container svg g.node[class*="trapez"] rect {
  fill: var(--type-object-bg) !important;
  stroke: var(--type-object) !important;
}

/* ===== Tab: ドメイン ===== */
.domain-list { list-style: none; padding: 0; }
.domain-list li {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 14px 18px; margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
}
.domain-list .domain-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.domain-list .domain-name { font-weight: 600; color: var(--fg-strong); font-size: 15px; }
.domain-list .domain-count {
  background: var(--accent-bg); color: var(--accent);
  padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}
.domain-members { font-size: 12.5px; columns: 3; column-gap: 16px; margin: 0; padding-left: 0; list-style: none; }
@media (max-width: 800px) { .domain-members { columns: 1; } }
.domain-members li {
  border: 0; padding: 2px 0; margin: 0; background: transparent; box-shadow: none;
  break-inside: avoid;
}

/* ===== Tab: 業務フロー (Phase 15) ===== */
.bf-toolbar {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  margin-bottom: 16px; padding: 10px 14px;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
}
.bf-scope-switcher { display: inline-flex; gap: 0; background: var(--bg-alt); border-radius: var(--radius); padding: 3px; }
.bf-scope-switcher button {
  font-size: 12.5px; padding: 6px 14px; border: 0; background: transparent;
  border-radius: 4px; cursor: pointer; color: var(--muted);
  font-family: var(--font-sans); font-weight: 500;
}
.bf-scope-switcher button:hover { color: var(--fg); }
.bf-scope-switcher button[aria-selected="true"] {
  background: var(--bg-surface); color: var(--accent); box-shadow: var(--shadow-sm); font-weight: 600;
}
.bf-toolbar input {
  flex: 1; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--bg-alt);
  font-size: 13px; font-family: var(--font-sans); min-width: 220px;
}
.bf-toolbar input:focus { outline: none; border-color: var(--accent); background: #fff; box-shadow: 0 0 0 3px var(--accent-bg); }

.bf-list { display: flex; flex-direction: column; gap: 14px; }
.bf-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden;
}
.bf-card.hidden { display: none; }
.bf-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
  background: var(--bg-alt);
}
.bf-card-scope {
  display: inline-flex; align-items: center;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  padding: 3px 10px; border-radius: 999px;
  background: var(--accent-bg); color: var(--accent);
}
.bf-card-scope.scope-object { background: var(--type-object-bg); color: var(--type-object); }
.bf-card-title { font-size: 15px; font-weight: 600; color: var(--fg-strong); flex: 1; min-width: 0; }
.bf-card-counts { font-size: 12px; color: var(--muted); display: flex; gap: 12px; }
.bf-card-counts span { display: inline-flex; gap: 4px; align-items: center; }

.bf-meaning { padding: 12px 18px; border-bottom: 1px solid var(--border); background: #fafbfc; font-size: 13.5px; color: var(--fg); }
.bf-meaning .bf-meaning-label { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; font-weight: 600; margin-bottom: 4px; }

.bf-columns {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0; padding: 0;
}
@media (max-width: 1100px) { .bf-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px)  { .bf-columns { grid-template-columns: 1fr; } }
.bf-col {
  padding: 14px 16px; border-right: 1px solid var(--border); min-width: 0;
  display: flex; flex-direction: column;
}
.bf-col:last-child { border-right: 0; }
@media (max-width: 1100px) {
  .bf-col:nth-child(2n) { border-right: 0; }
  .bf-col { border-bottom: 1px solid var(--border); }
}
.bf-col-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  font-size: 11px; text-transform: uppercase; color: var(--muted);
  letter-spacing: 0.06em; font-weight: 600;
  padding-bottom: 6px; border-bottom: 1px solid var(--border);
}
.bf-col-header .bf-col-icon {
  width: 22px; height: 22px; border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff;
}
.bf-col-header .bf-col-icon.role-entry      { background: var(--type-lwc); }
.bf-col-header .bf-col-icon.role-process    { background: var(--type-apex); }
.bf-col-header .bf-col-icon.role-data       { background: var(--type-object); }
.bf-col-header .bf-col-icon.role-downstream { background: var(--type-flow); }
.bf-col-header .bf-col-count { margin-left: auto; color: var(--muted); font-weight: 500; font-size: 11px;
  background: var(--bg-alt); padding: 1px 8px; border-radius: 999px; }

.bf-step {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px; margin-bottom: 6px;
  background: var(--bg-alt); border: 1px solid var(--border);
  border-left: 3px solid var(--muted-soft); border-radius: var(--radius);
  text-decoration: none; color: inherit; font-size: 12.5px;
  transition: all 0.12s;
}
.bf-step:hover { border-color: var(--accent); border-left-color: var(--accent); background: var(--bg-surface); box-shadow: var(--shadow-sm); text-decoration: none; transform: translateX(2px); }
.bf-step.t-apex    { border-left-color: var(--type-apex); }
.bf-step.t-trigger { border-left-color: var(--type-trigger); }
.bf-step.t-lwc     { border-left-color: var(--type-lwc); }
.bf-step.t-object  { border-left-color: var(--type-object); }
.bf-step.t-flow    { border-left-color: var(--type-flow); }
.bf-step .bf-step-name { font-weight: 500; color: var(--fg-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bf-step .bf-step-evidence { font-size: 11px; color: var(--muted); }

.bf-empty { color: var(--muted); font-size: 12px; padding: 8px 0; font-style: italic; }

/* ===== Type-index page (apex / lwc / flow 一覧) ===== */
.type-index-toolbar {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 14px 18px; margin-bottom: 16px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap; box-shadow: var(--shadow-sm);
}
.type-index-toolbar h2 { margin: 0; font-size: 14px; color: var(--muted); }
.type-index-toolbar .filter-input {
  flex: 1; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: var(--radius); font-size: 13px; background: var(--bg-alt); min-width: 200px;
}
.type-index-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.type-index-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: 6px;
  transition: all 0.15s; text-decoration: none; color: inherit;
}
.type-index-card:hover {
  border-color: var(--accent); box-shadow: var(--shadow-md); text-decoration: none;
  transform: translateY(-1px);
}
.type-index-card .card-name { font-weight: 600; color: var(--fg-strong); font-size: 14px; word-break: break-all; }
.type-index-card .card-meta { font-size: 12px; color: var(--muted); display: flex; gap: 10px; flex-wrap: wrap; }
.type-index-card .card-meta span { display: inline-flex; align-items: center; gap: 4px; }
.type-index-card .card-domain { font-size: 11px; color: var(--accent); }
.type-index-card.hidden { display: none; }
`;

/**
 * クライアント JS (タブ/検索/Mermaid 描画/HTML フォールバック)。
 * 外部依存は <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"> のみ。
 * オフライン環境ではフォールバックが自動的に動く。
 */
export const HOME_JS = `(() => {
  const DATA_DIR = "./data";

  // 起動: DOMContentLoaded 後に必ず実行 (defer + 既に解析済みの両方をカバー)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  async function init() {
    try {
      initTabs();
      initSearch();
      initSidebarFilter();
      initBusinessFlowsScopeSwitcher();
      await Promise.all([
        loadStats(),
        loadDomains(),
        loadHotspots(),
        loadArchitecture(),
        loadBusinessFlows(),
      ]);
    } catch (err) {
      console.error("[yohaku] home init failed:", err);
      showFatalError(err);
    }
  }

  function showFatalError(err) {
    const el = document.querySelector(".home-main");
    if (!el) return;
    const msg = document.createElement("div");
    msg.className = "notice";
    msg.style.background = "#fff8f8";
    msg.style.borderColor = "#d1242f";
    msg.style.color = "#82071e";
    msg.textContent = "ホーム描画でエラーが発生しました: " + (err && err.message ? err.message : String(err));
    el.prepend(msg);
  }

  /**
   * data の取得は 3 段:
   *   1. <script type="application/json" id="yohaku-data-<name>"> を読む (file:// で確実に動く)
   *   2. それが無ければ fetch('./data/<name>.json') にフォールバック (将来サーバ配信時)
   *   3. どちらも失敗なら null
   */
  async function getData(name) {
    const inline = document.getElementById("yohaku-data-" + name);
    if (inline && inline.textContent && inline.textContent.trim() !== "") {
      try {
        return JSON.parse(inline.textContent);
      } catch (e) {
        console.warn("[yohaku] inline JSON parse failed for " + name + ":", e);
      }
    }
    try {
      const r = await fetch(DATA_DIR + "/" + name + ".json");
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  function initTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.getAttribute("data-tab")));
    });
  }
  function activateTab(name) {
    document.querySelectorAll(".tab-button").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.setAttribute("data-active", p.getAttribute("data-panel") === name ? "true" : "false");
    });
  }

  function initSearch() {
    const input = document.getElementById("global-search");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll(".component-list li").forEach((li) => {
        const text = li.textContent.toLowerCase();
        li.style.display = q === "" || text.includes(q) ? "" : "none";
      });
      document.querySelectorAll(".sidebar .type-list li").forEach((li) => {
        const text = li.textContent.toLowerCase();
        li.classList.toggle("hidden", q !== "" && !text.includes(q));
      });
    });
  }

  function initSidebarFilter() {
    // 折りたたみグループの開閉
    document.querySelectorAll(".sidebar .sidebar-group-header").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const target = ev.target;
        if (target.closest && target.closest("a")) return; // 中の external link はスキップ
        const group = btn.closest(".sidebar-group");
        if (!group) return;
        const collapsed = group.getAttribute("data-collapsed") === "true";
        group.setAttribute("data-collapsed", collapsed ? "false" : "true");
      });
    });
  }

  async function loadStats() {
    const stats = await getData("stats");
    const grid = document.getElementById("stats-grid");
    if (!grid) return;
    if (!stats) {
      grid.innerHTML = '<p class="muted">統計データを読み込めませんでした。</p>';
      return;
    }
    const typeLabels = { apex: "Apex Classes", trigger: "Triggers", lwc: "LWC", object: "Objects", flow: "Flows" };
    grid.innerHTML = stats.byType.map((s) =>
      \`<a class="stat-card t-\${escapeHtml(s.type)}" href="./component/\${encodeURIComponent(s.type)}/index.html" style="text-decoration:none;color:inherit;">
        <div class="stat-type">\${escapeHtml(typeLabels[s.type] || s.type)}</div>
        <div class="stat-count">\${s.count}</div>
        <div class="stat-meta">avg: \${s.avgSize} / max: \${s.maxSize}</div>
      </a>\`
    ).join("");
    const totals = document.getElementById("stats-totals");
    if (totals) totals.textContent = "全コンポーネント: " + stats.totals.components + " 件。カードをクリックすると一覧ページへ遷移します。";
  }

  async function loadDomains() {
    const dom = await getData("domains");
    if (!dom) {
      const list = document.getElementById("domain-list");
      if (list) list.innerHTML = '<p class="muted">ドメインデータを読み込めませんでした。</p>';
      return;
    }
    const list = document.getElementById("domain-list");
    if (!list) return;
    if (!dom.domains || dom.domains.length === 0) {
      list.innerHTML = '<p class="muted">ドメイン未定義です。<code>yohaku domains init</code> を実行してください。</p>';
    } else {
      const TYPE_TO_PATH = { object: 'object', apex: 'apex', trigger: 'trigger', flow: 'flow', lwc: 'lwc' };
      function memberHref(m) {
        const safe = String(m.name).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
        return './component/' + (TYPE_TO_PATH[m.type] || m.type) + '/' + encodeURIComponent(safe) + '.html';
      }
      list.innerHTML = dom.domains.map((d) =>
        \`<li>
          <div class="domain-header">
            <span class="domain-name">\${escapeHtml(d.label)}</span>
            <span class="domain-count">\${d.members.length} 件</span>
          </div>
          <ul class="domain-members">
            \${d.members.map((m) =>
              \`<li><a href="\${memberHref(m)}"><span class="type-pill t-\${escapeHtml(m.type)}" style="font-size:9px;padding:1px 6px;margin-right:6px;">\${escapeHtml(m.type)}</span>\${m.label ? escapeHtml(m.label) + '<span class="api-name-inline">' + escapeHtml(m.name) + '</span>' : escapeHtml(m.name)}</a></li>\`
            ).join("")}
          </ul>
        </li>\`
      ).join("");
    }
    const u = document.getElementById("unclassified-count");
    if (u) u.textContent = "未分類コンポーネント: " + dom.unclassifiedCount + " 件 (domains.yaml に追加すると整理されます)";
  }

  async function loadHotspots() {
    const h = await getData("hotspots");
    const el = document.getElementById("hotspots-list");
    if (!el) return;
    if (!h) {
      el.innerHTML = '<p class="muted">ホットスポットデータを読み込めませんでした。</p>';
      return;
    }
    const note = '<p class="muted hotspots-note">' + escapeHtml(h.note || "") + '</p>';
    if (!h.items || h.items.length === 0) {
      el.innerHTML = note;
      return;
    }
    const TYPE_TO_PATH = { object: 'object', apex: 'apex', trigger: 'trigger', flow: 'flow', lwc: 'lwc' };
    function hotspotHref(it) {
      const safe = String(it.name).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
      return './component/' + (TYPE_TO_PATH[it.type] || it.type) + '/' + encodeURIComponent(safe) + '.html';
    }
    function hotspotName(it) {
      return it.label
        ? escapeHtml(it.label) + '<span class="api-name-inline">' + escapeHtml(it.name) + '</span>'
        : escapeHtml(it.name);
    }
    el.innerHTML = note + '<ol class="hotspots">' + h.items.map((it, i) =>
      '<li class="hotspot-card sev-' + escapeHtml(it.severity) + '">' +
        '<a class="hotspot-head" href="' + hotspotHref(it) + '">' +
          '<span class="hotspot-rank">' + (i + 1) + '</span>' +
          '<span class="type-pill t-' + escapeHtml(it.type) + '">' + escapeHtml(it.type) + '</span>' +
          '<span class="hotspot-name">' + hotspotName(it) + '</span>' +
          '<span class="hotspot-score" title="注目度スコア">' + escapeHtml(String(it.score)) + '</span>' +
        '</a>' +
        '<ul class="hotspot-reasons">' + (it.reasons || []).map((r) =>
          '<li class="sev-' + escapeHtml(r.severity) + '">' +
            '<span class="sev-badge">' + escapeHtml(r.severity) + '</span>' +
            escapeHtml(r.title) +
            (r.detail ? ' <span class="muted">' + escapeHtml(r.detail) + '</span>' : '') +
          '</li>'
        ).join('') + '</ul>' +
      '</li>'
    ).join('') + '</ol>';
  }

  // ===== 業務フロー (Phase 15) =====
  let bfData = null;
  let bfScope = "domain";

  function initBusinessFlowsScopeSwitcher() {
    document.querySelectorAll(".bf-scope-switcher button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = btn.getAttribute("data-scope");
        if (s !== "domain" && s !== "object") return;
        bfScope = s;
        document.querySelectorAll(".bf-scope-switcher button").forEach((b) => {
          b.setAttribute("aria-selected", b.getAttribute("data-scope") === bfScope ? "true" : "false");
        });
        renderBusinessFlows();
      });
    });
    const filter = document.getElementById("bf-filter");
    if (filter) filter.addEventListener("input", applyBusinessFlowFilter);
  }

  async function loadBusinessFlows() {
    bfData = await getData("business-flows");
    renderBusinessFlows();
  }

  function renderBusinessFlows() {
    const list = document.getElementById("bf-list");
    if (!list) return;
    if (!bfData) {
      list.innerHTML = '<p class="muted">業務フローデータを読み込めませんでした。</p>';
      return;
    }
    const flows = bfScope === "domain" ? (bfData.domainFlows || []) : (bfData.objectFlows || []);
    if (flows.length === 0) {
      const hint = bfScope === "domain"
        ? '<code>yohaku domains init</code> で domains.yaml を生成すると、ドメイン単位の業務フローがここに並びます。'
        : '<code>yohaku graph build</code> で SObject を取り込むと、オブジェクト単位の業務フローがここに並びます。';
      list.innerHTML = '<p class="muted">' + hint + '</p>';
      return;
    }
    list.innerHTML = flows.map(renderBusinessFlowCard).join("");
    applyBusinessFlowFilter();
  }

  function renderBusinessFlowCard(flow) {
    const scopeClass = flow.scope === "object" ? "scope-object" : "";
    const meaningHtml = flow.meaning
      ? '<div class="bf-meaning"><div class="bf-meaning-label">業務的意味づけ</div>' + flow.meaning + '</div>'
      : "";
    const counts = [
      ["entry", "入口", flow.entryPoints.length],
      ["process", "処理", flow.processing.length],
      ["data", "影響", flow.affectedData.length],
      ["downstream", "下流", flow.downstream.length],
    ].map((c) => '<span><strong>' + c[2] + '</strong> ' + escapeHtml(c[1]) + '</span>').join("");
    const search = flow.id + " " + flow.label + " " +
      flow.entryPoints.concat(flow.processing, flow.affectedData, flow.downstream)
        .map((s) => s.name + " " + (s.label || "")).join(" ");
    return '<div class="bf-card" data-search="' + escapeHtml(search.toLowerCase()) + '">' +
      '<div class="bf-card-header">' +
        '<span class="bf-card-scope ' + scopeClass + '">' + escapeHtml(flow.scope === "object" ? "オブジェクト" : "ドメイン") + '</span>' +
        '<span class="bf-card-title">' + escapeHtml(flow.label) + '</span>' +
        '<span class="bf-card-counts">' + counts + '</span>' +
      '</div>' +
      meaningHtml +
      '<div class="bf-columns">' +
        renderBfColumn("entry", "入口", flow.entryPoints) +
        renderBfColumn("process", "処理", flow.processing) +
        renderBfColumn("data", "影響データ", flow.affectedData) +
        renderBfColumn("downstream", "下流", flow.downstream) +
      '</div>' +
    '</div>';
  }

  function renderBfColumn(role, label, steps) {
    const headerIcon = bfRoleIcon(role);
    const items = (steps || []).length === 0
      ? '<p class="bf-empty">該当なし</p>'
      : steps.map(bfStep).join("");
    return '<div class="bf-col">' +
      '<div class="bf-col-header">' +
        '<span class="bf-col-icon role-' + role + '">' + headerIcon + '</span>' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<span class="bf-col-count">' + (steps || []).length + '</span>' +
      '</div>' +
      items +
    '</div>';
  }

  const TYPE_PATH = { object: "object", apex: "apex", trigger: "trigger", flow: "flow", lwc: "lwc" };
  function bfStep(s) {
    const safe = String(s.name).replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
    const href = "./component/" + (TYPE_PATH[s.type] || s.type) + "/" + encodeURIComponent(safe) + ".html";
    const nameHtml = s.label
      ? escapeHtml(s.label) + '<span class="api-name-inline">' + escapeHtml(s.name) + '</span>'
      : escapeHtml(s.name);
    return '<a class="bf-step t-' + escapeHtml(s.type) + '" href="' + href + '">' +
      '<span class="bf-step-name">' + nameHtml + '</span>' +
      (s.evidence ? '<span class="bf-step-evidence">' + escapeHtml(s.evidence) + '</span>' : '') +
    '</a>';
  }

  function bfRoleIcon(role) {
    // Simple inline SVG icon set
    if (role === "entry")      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
    if (role === "process")    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .51.32.96.81 1.18a1.65 1.65 0 0 0 1.51 0H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    if (role === "data")       return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>';
  }

  function applyBusinessFlowFilter() {
    const input = document.getElementById("bf-filter");
    const counter = document.getElementById("bf-counter");
    if (!input) return;
    const q = (input.value || "").trim().toLowerCase();
    const cards = Array.prototype.slice.call(document.querySelectorAll("#bf-list .bf-card"));
    let shown = 0;
    cards.forEach((c) => {
      const text = c.getAttribute("data-search") || "";
      const match = q === "" || text.indexOf(q) >= 0;
      c.classList.toggle("hidden", !match);
      if (match) shown++;
    });
    if (counter) counter.textContent = q === "" ? "" : shown + " / " + cards.length + " 件表示中";
  }

  async function loadArchitecture() {
    const arch = await getData("architecture");
    if (!arch) {
      const c = document.getElementById("arch-html");
      if (c) c.innerHTML = '<p class="muted">アーキテクチャデータを読み込めませんでした。</p>';
      return;
    }
    renderArchHtml(arch);
    renderArchMermaid(arch);
    initDiagramSwitcher();
  }

  function renderArchHtml(arch) {
    const canvas = document.getElementById("arch-html");
    if (!canvas) return;
    const byType = { object: [], apex: [], trigger: [], flow: [], lwc: [] };
    for (const n of arch.nodes) (byType[n.type] || (byType[n.type] = [])).push(n);
    const laneOrder = ['object', 'apex', 'trigger', 'flow'];
    // SVG icon definitions (inline, currentColor) — emoji を避ける
    const SVG = (paths) => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">' + paths + '</svg>';
    const laneIcons = {
      object: SVG('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
      apex: SVG('<path d="M8 4c-2 0-3 1-3 3v3c0 1.3-.7 2-2 2 1.3 0 2 .7 2 2v3c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v3c0 1.3.7 2 2 2-1.3 0-2 .7-2 2v3c0 2-1 3-3 3"/>'),
      trigger: SVG('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
      flow: SVG('<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7-3.3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7 3.3"/><path d="m17 3 2 3-3 2"/><path d="M7 21l-2-3 3-2"/>'),
    };
    const laneLabels = { object: 'SObjects', apex: 'Apex Classes', trigger: 'Triggers', flow: 'Flows' };
    const TYPE_TO_PATH = { object: 'object', apex: 'apex', trigger: 'trigger', flow: 'flow', lwc: 'lwc' };
    function nodeHref(n) {
      const fqn = n.id.indexOf(':') >= 0 ? n.id.slice(n.id.indexOf(':') + 1) : n.id;
      const safe = String(fqn).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
      return './component/' + (TYPE_TO_PATH[n.type] || n.type) + '/' + encodeURIComponent(safe) + '.html';
    }
    const lanesHtml = laneOrder.map((k) => {
      const items = byType[k] || [];
      return \`<div class="arch-lane l-\${k}">
        <div class="arch-lane-header">
          <span class="lane-icon-wrap">\${laneIcons[k] || ''}</span>
          <span class="lane-title">\${escapeHtml(laneLabels[k] || k)}</span>
          <span class="lane-count">\${items.length}</span>
        </div>
        <div class="arch-lane-body">
        \${items.length === 0 ? '<p class="arch-empty">該当なし</p>' :
          items.map((n) =>
            \`<a class="arch-node" data-node-id="\${escapeHtml(n.id)}" href="\${nodeHref(n)}">
              <span class="node-name">\${escapeHtml(n.label)}</span>
              \${n.apiName && n.apiName !== n.label ? '<span class="node-api">' + escapeHtml(n.apiName) + '</span>' : ''}
            </a>\`
          ).join("")
        }
        </div>
      </div>\`;
    }).join("");
    const edgesByKind = { queries: [], writes: [], triggers: [], uses: [] };
    for (const e of arch.edges) (edgesByKind[e.kind] || (edgesByKind[e.kind] = [])).push(e);
    const ARROW_SVG = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
    const edgesHtml = arch.edges.slice(0, 300).map((e) => {
      const fromLabel = e.from.split(':').slice(1).join(':') || e.from;
      const toLabel = e.to.split(':').slice(1).join(':') || e.to;
      return \`<li class="k-\${escapeHtml(e.kind)}">
        <span class="edge-kind">\${escapeHtml(e.kind)}</span>
        <code>\${escapeHtml(fromLabel)}</code>
        \${ARROW_SVG}
        <code>\${escapeHtml(toLabel)}</code>
      </li>\`;
    }).join("");
    canvas.innerHTML =
      \`<div class="arch-lanes">\${lanesHtml}</div>
      <div class="arch-edges-panel">
        <h3>依存エッジ <span style="color:var(--muted-soft);font-weight:500;">(\${arch.edges.length})</span></h3>
        <ul class="arch-edges-list">\${edgesHtml}</ul>
        \${arch.edges.length > 300 ? '<p class="muted" style="font-size:12px;margin-top:10px;">先頭 300 件のみ表示</p>' : ''}
      </div>\`;
  }

  function ensureMermaidInit() {
    if (typeof window.mermaid === "undefined") return false;
    if (window.__yohakuMermaidInit) return true;
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: '"Salesforce Sans", -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
        themeVariables: {
          primaryColor: "#eaf5fe",
          primaryTextColor: "#032d60",
          primaryBorderColor: "#0176d3",
          lineColor: "#b0adab",
          secondaryColor: "#f3f3f3",
          tertiaryColor: "#ffffff",
          background: "#ffffff",
          mainBkg: "#ffffff",
          nodeBorder: "#dddbda",
          clusterBkg: "#fafaf9",
          clusterBorder: "#dddbda",
          edgeLabelBackground: "#ffffff"
        },
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: "basis",
          padding: 12,
          nodeSpacing: 50,
          rankSpacing: 60
        }
      });
      window.__yohakuMermaidInit = true;
      return true;
    } catch (e) {
      console.warn("[yohaku] mermaid init failed:", e);
      return false;
    }
  }

  function renderArchMermaid(arch) {
    const container = document.getElementById("arch-mermaid");
    if (!container) return;
    if (!ensureMermaidInit()) {
      container.classList.add("error");
      container.innerHTML = '<p class="mermaid-error-msg">Mermaid が読み込まれませんでした。グループビューに切り替えてください。</p>';
      return;
    }
    try {
      const lines = ["flowchart LR"];
      for (const n of arch.nodes) {
        const safeId = n.id.replace(/[^A-Za-z0-9_]/g, "_");
        lines.push("  " + safeId + "[\\"" + n.label.replace(/"/g, "'") + "\\"]");
      }
      for (const e of arch.edges) {
        const f = e.from.replace(/[^A-Za-z0-9_]/g, "_");
        const t = e.to.replace(/[^A-Za-z0-9_]/g, "_");
        lines.push("  " + f + " -->|" + e.kind + "| " + t);
      }
      const source = lines.join("\\n");
      window.mermaid.render("arch-svg", source).then((res) => {
        container.innerHTML = res.svg;
      }).catch((err) => {
        container.classList.add("error");
        container.innerHTML = '<p class="mermaid-error-msg">Mermaid 描画失敗: ' + escapeHtml(String(err)) + '</p>';
        const note = document.querySelector(".arch-toolbar .fallback-note");
        if (note) note.textContent = "Mermaid 描画に失敗しました。グループビューをご利用ください。";
      });
    } catch (e) {
      container.classList.add("error");
      container.innerHTML = '<p class="mermaid-error-msg">Mermaid 例外: ' + escapeHtml(String(e)) + '</p>';
    }
  }

  function initDiagramSwitcher() {
    document.querySelectorAll(".diagram-switcher button").forEach((btn) => {
      btn.addEventListener("click", () => setDiagramMode(btn.getAttribute("data-mode")));
    });
  }
  function setDiagramMode(mode) {
    document.querySelectorAll(".diagram-switcher button").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-mode") === mode ? "true" : "false");
    });
    const html = document.getElementById("arch-html");
    const mer = document.getElementById("arch-mermaid");
    if (html) html.style.display = mode === "html" ? "" : "none";
    if (mer) mer.style.display = mode === "mermaid" ? "" : "none";
  }
  function autoSwitchToHtml(note) {
    // 既定がグループビュー (html) なので、エラー時の note 表示のみ行う
    const noteEl = document.querySelector(".arch-toolbar .fallback-note");
    if (noteEl && note) noteEl.textContent = note;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
`;
