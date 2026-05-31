// ----------------------------------------------------------------------------
// Diff View HTML (Phase 13)
//
// computeDiff の結果 (RawDiff) をリリースレビュー用 HTML 1 枚に整形する。
// 既存の styles.css / home.css / cmdk.css を再利用して見た目を統一。
// 各 ChangedFile は可能なら component leaf へリンクする。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import { escapeAttr, escapeHtml, sanitizeFileName } from "../html/escape.js";
import { icon } from "../html/icons.js";
import type { ComponentType } from "../html/sections.js";
import type { KnowledgeGraph } from "../types/graph.js";
import type { ChangeKind, ChangedFile, DiffCategory, RawDiff } from "./types.js";

const METADATA_TO_INTERNAL: Record<string, ComponentType> = {
  ApexClass: "apex",
  ApexTrigger: "trigger",
  CustomObject: "object",
  Flow: "flow",
  LightningComponentBundle: "lwc",
};

const CHANGE_LABEL: Record<ChangeKind, string> = {
  added: "追加",
  modified: "変更",
  removed: "削除",
  renamed: "改名",
};

const CATEGORY_LABEL: Record<DiffCategory, string> = {
  data_model: "データモデル",
  automation: "自動化",
  permission: "権限",
  ui: "UI",
  logic: "ロジック",
  operational: "運用",
  manual: "手動オペ",
  unknown: "未分類",
};

const CATEGORY_ORDER: readonly DiffCategory[] = [
  "data_model",
  "automation",
  "logic",
  "ui",
  "permission",
  "operational",
  "manual",
  "unknown",
];

export interface DiffHtmlOptions {
  /** 既存 graph (component leaf へのリンク解決に使う)。なくても動く */
  readonly graph?: KnowledgeGraph;
  /** domains.yaml (リンク色付け / cmdk 拡張に使う場合)。未使用でも可 */
  readonly domainsConfig?: DomainsConfig | null;
  /** タイトル (既定: "Release Review") */
  readonly title?: string;
}

export function renderDiffHtml(diff: RawDiff, options?: DiffHtmlOptions): string {
  const title = options?.title ?? "Release Review";
  const fileMap = options?.graph !== undefined ? buildExistsMap(options.graph) : null;

  const filesByCategory = groupBy(diff.files, (f) => f.category);
  const sections = CATEGORY_ORDER.filter((cat) => (filesByCategory.get(cat)?.length ?? 0) > 0)
    .map((cat) => renderCategorySection(cat, filesByCategory.get(cat) ?? [], fileMap))
    .join("\n      ");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — yohakuforce</title>
  <link rel="stylesheet" href="./assets/styles.css" />
  <link rel="stylesheet" href="./assets/home.css" />
  <link rel="stylesheet" href="./assets/diff.css" />
</head>
<body data-href-prefix="">
  <header class="global-header">
    <div class="brand">
      <a href="./index.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
        <span class="brand-dot">y</span>
        <span class="brand-name">yohakuforce</span>
        <span class="brand-sub">${escapeHtml(title)}</span>
      </a>
    </div>
  </header>
  <header class="component-header">
    <nav class="breadcrumb">
      <a href="./index.html">Home</a>
      <span class="sep">/</span>
      <span class="current">${escapeHtml(title)}</span>
    </nav>
    <h1>${escapeHtml(title)}</h1>
    <p class="diff-refs">
      <code>${escapeHtml(diff.fromRef)}</code>
      ${arrowIconHtml()}
      <code>${escapeHtml(diff.toRef)}</code>
      <span class="diff-generated">generated at ${escapeHtml(diff.generatedAt)}</span>
    </p>
  </header>
  <main class="home-main">
    ${renderTotalsBlock(diff)}
    ${diff.truncated ? `<p class="notice" style="border-color: var(--severity-medium-fg); background: var(--severity-medium-bg);">⚠ ファイル件数が上限に達しました。--limit を上げてください。</p>` : ""}
    <div class="diff-toolbar">
      <input id="diff-filter" type="search" placeholder="ファイル / メタデータ名で絞り込み" />
      <span id="diff-filter-counter" class="muted"></span>
    </div>
    <div id="diff-sections">
      ${sections || `<p class="muted">変更はありません。</p>`}
    </div>
  </main>
  <script>
    (function() {
      var input = document.getElementById("diff-filter");
      var counter = document.getElementById("diff-filter-counter");
      if (!input) return;
      var cards = Array.prototype.slice.call(document.querySelectorAll(".diff-card"));
      function apply() {
        var q = (input.value || "").trim().toLowerCase();
        var shown = 0;
        cards.forEach(function(c) {
          var text = c.getAttribute("data-search") || "";
          var match = q === "" || text.indexOf(q) >= 0;
          c.classList.toggle("hidden", !match);
          if (match) shown++;
        });
        if (counter) counter.textContent = q === "" ? "" : shown + " / " + cards.length + " 件表示中";
        // セクション空判定 (タイトルだけ残らないように)
        Array.prototype.slice.call(document.querySelectorAll(".diff-section")).forEach(function(sec) {
          var anyVisible = Array.prototype.slice.call(sec.querySelectorAll(".diff-card")).some(function(c){ return !c.classList.contains("hidden"); });
          sec.style.display = anyVisible ? "" : "none";
        });
      }
      input.addEventListener("input", apply);
    })();
  </script>
</body>
</html>
`;
}

function renderTotalsBlock(diff: RawDiff): string {
  const t = diff.totals;
  return `<div class="diff-totals">
      <div class="diff-totals-card"><div class="diff-totals-num">${t.files}</div><div class="diff-totals-label">files changed</div></div>
      <div class="diff-totals-card diff-totals-add"><div class="diff-totals-num">+${t.addedLines}</div><div class="diff-totals-label">added</div></div>
      <div class="diff-totals-card diff-totals-rem"><div class="diff-totals-num">-${t.removedLines}</div><div class="diff-totals-label">removed</div></div>
    </div>`;
}

function renderCategorySection(
  category: DiffCategory,
  files: readonly ChangedFile[],
  fileMap: Map<string, true> | null,
): string {
  return `<section class="diff-section">
        <h2 class="diff-section-header">
          <span class="diff-cat-pill diff-cat-${escapeAttr(category)}">${escapeHtml(CATEGORY_LABEL[category])}</span>
          <span class="muted">${files.length} 件</span>
        </h2>
        <div class="diff-grid">
          ${files.map((f) => renderFileCard(f, fileMap)).join("\n          ")}
        </div>
      </section>`;
}

function renderFileCard(f: ChangedFile, fileMap: Map<string, true> | null): string {
  const fqn = f.fullyQualifiedName ?? extractFqn(f.path) ?? f.path;
  const internalType = f.metadataType !== null ? METADATA_TO_INTERNAL[f.metadataType] : undefined;
  const link =
    internalType !== undefined &&
    f.fullyQualifiedName !== null &&
    fileMap !== null &&
    fileMap.has(`${internalType}:${f.fullyQualifiedName}`)
      ? `./component/${escapeAttr(internalType)}/${escapeAttr(sanitizeFileName(f.fullyQualifiedName))}.html`
      : null;
  const searchKey = `${fqn} ${f.path} ${f.metadataType ?? ""}`.toLowerCase();
  const typePill =
    internalType !== undefined
      ? `<span class="type-pill t-${escapeAttr(internalType)}">${escapeHtml(internalType)}</span>`
      : f.metadataType !== null
        ? `<span class="type-pill" style="background: var(--bg-alt); color: var(--muted);">${escapeHtml(f.metadataType)}</span>`
        : "";
  return `<div class="diff-card diff-change-${escapeAttr(f.changeKind)}" data-search="${escapeAttr(searchKey)}">
            <div class="diff-card-row">
              <span class="diff-change-pill diff-change-${escapeAttr(f.changeKind)}">${escapeHtml(CHANGE_LABEL[f.changeKind])}</span>
              ${typePill}
              ${
                link !== null
                  ? `<a class="diff-card-name" href="${escapeAttr(link)}">${escapeHtml(fqn)}</a>`
                  : `<span class="diff-card-name muted-link">${escapeHtml(fqn)}</span>`
              }
            </div>
            <div class="diff-card-meta">
              <code class="diff-card-path">${escapeHtml(f.path)}</code>
              <span class="diff-card-lines">
                <span class="diff-added">+${f.addedLines}</span>
                <span class="diff-removed">-${f.removedLines}</span>
              </span>
            </div>
            ${f.oldPath !== undefined ? `<div class="diff-card-meta"><span class="muted">改名元: <code>${escapeHtml(f.oldPath)}</code></span></div>` : ""}
          </div>`;
}

function extractFqn(path: string): string | null {
  // force-app/main/default/<type>/<Name>.* を雑に抽出
  const m = path.match(/\/([^\/]+?)(\.[^.\/]+)?$/);
  if (m === null) return null;
  return m[1] ?? null;
}

function arrowIconHtml(): string {
  return icon("chevron-right", { size: "14", className: "icon" });
}

function buildExistsMap(graph: KnowledgeGraph): Map<string, true> {
  const m = new Map<string, true>();
  for (const c of graph.apexClasses) m.set(`apex:${c.fullyQualifiedName}`, true);
  for (const t of graph.apexTriggers) m.set(`trigger:${t.fullyQualifiedName}`, true);
  for (const l of graph.lwcs) m.set(`lwc:${l.fullyQualifiedName}`, true);
  for (const o of graph.objects) m.set(`object:${o.fullyQualifiedName}`, true);
  for (const f of graph.flows) m.set(`flow:${f.fullyQualifiedName}`, true);
  return m;
}

function groupBy<T, K>(arr: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const a of arr) {
    const k = key(a);
    const list = out.get(k) ?? [];
    list.push(a);
    out.set(k, list);
  }
  return out;
}

/**
 * Diff View 専用の CSS (styles.css/home.css と合わせて読み込まれる)。
 */
export const DIFF_CSS = `
.diff-refs {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--muted); margin: 8px 0 0;
}
.diff-refs code {
  background: var(--bg-alt); border: 1px solid var(--border);
  padding: 2px 8px; border-radius: 4px; font-size: 12px;
}
.diff-refs .icon { color: var(--muted-soft); }
.diff-generated { margin-left: 14px; font-size: 11px; color: var(--muted-soft); }

.diff-totals {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px; margin-bottom: 18px;
}
.diff-totals-card {
  padding: 16px 18px; background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--muted-soft);
}
.diff-totals-card.diff-totals-add { border-left-color: var(--type-object); }
.diff-totals-card.diff-totals-rem { border-left-color: var(--type-trigger); }
.diff-totals-num { font-size: 28px; font-weight: 700; color: var(--fg-strong); }
.diff-totals-label { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.06em; font-weight: 600; }

.diff-toolbar {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 12px 16px; margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
}
.diff-toolbar input {
  flex: 1; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--bg-alt);
  font-size: 13px; font-family: var(--font-sans); min-width: 220px;
}
.diff-toolbar input:focus { outline: none; border-color: var(--accent); background: #fff; box-shadow: 0 0 0 3px var(--accent-bg); }

.diff-section { margin-bottom: 28px; }
.diff-section-header {
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; margin: 0 0 12px; font-weight: 600;
}
.diff-cat-pill {
  display: inline-flex; align-items: center; padding: 4px 12px;
  border-radius: 999px; font-size: 12px; font-weight: 600;
  background: var(--bg-alt); color: var(--fg);
  border: 1px solid var(--border);
}
.diff-cat-data_model  { background: var(--type-object-bg);  color: var(--type-object);  border-color: var(--type-object); }
.diff-cat-automation  { background: var(--type-flow-bg);    color: var(--type-flow);    border-color: var(--type-flow); }
.diff-cat-logic       { background: var(--type-apex-bg);    color: var(--type-apex);    border-color: var(--type-apex); }
.diff-cat-ui          { background: var(--type-lwc-bg);     color: var(--type-lwc);     border-color: var(--type-lwc); }
.diff-cat-permission  { background: var(--type-trigger-bg); color: var(--type-trigger); border-color: var(--type-trigger); }
.diff-cat-operational { background: var(--bg-alt);          color: var(--muted);        border-color: var(--border); }
.diff-cat-manual      { background: var(--bg-alt);          color: var(--muted);        border-color: var(--border); }
.diff-cat-unknown     { background: var(--bg-alt);          color: var(--muted-soft);   border-color: var(--border); }

.diff-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 10px;
}
.diff-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-left: 3px solid var(--muted-soft); border-radius: var(--radius-lg);
  padding: 12px 14px; box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: 6px;
}
.diff-card.diff-change-added    { border-left-color: var(--type-object); }
.diff-card.diff-change-modified { border-left-color: var(--type-lwc); }
.diff-card.diff-change-removed  { border-left-color: var(--type-trigger); }
.diff-card.diff-change-renamed  { border-left-color: var(--type-flow); }
.diff-card.hidden { display: none; }

.diff-card-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.diff-card-name { font-weight: 600; color: var(--fg-strong); flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.diff-card-name.muted-link { color: var(--muted); cursor: default; }

.diff-change-pill {
  display: inline-block; padding: 2px 10px; border-radius: 999px;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  flex-shrink: 0;
}
.diff-change-pill.diff-change-added    { background: var(--type-object-bg);  color: var(--type-object); }
.diff-change-pill.diff-change-modified { background: var(--type-lwc-bg);     color: var(--type-lwc); }
.diff-change-pill.diff-change-removed  { background: var(--type-trigger-bg); color: var(--type-trigger); }
.diff-change-pill.diff-change-renamed  { background: var(--type-flow-bg);    color: var(--type-flow); }

.diff-card-meta {
  display: flex; align-items: center; gap: 12px; min-width: 0;
  font-size: 12px; color: var(--muted);
}
.diff-card-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.diff-card-lines { display: inline-flex; gap: 8px; flex-shrink: 0; font-family: var(--font-mono); }
.diff-added   { color: var(--type-object); font-weight: 600; }
.diff-removed { color: var(--type-trigger); font-weight: 600; }
`;
