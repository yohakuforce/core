// ----------------------------------------------------------------------------
// リファレンスページ (Phase 3)
//
// 5 つの component leaf タイプ (apex/trigger/lwc/object/flow) とは別に、
// 設定・UI 系メタデータ (PermissionSet / Profile / FlexiPage / VisualforcePage /
// VisualforceComponent / Aura) の「事実シート」ページを生成する。
//
// component-leaf の section 監査 / LLM ブロック / domains 分類は使わず、
// 決定的な内容のみをページシェル (component-page と同じ CSS / ヘッダ) で描画する。
// ComponentType union には手を入れない (配線の波及を避けるため)。
// ----------------------------------------------------------------------------

import type { KnowledgeGraph } from "../types/graph.js";
import { escapeAttr, escapeHtml, sanitizeFileName } from "./escape.js";
import { icon } from "./icons.js";
import {
  type RefSection,
  buildAuraSections,
  buildFlexiPageSections,
  buildPermissionSetSections,
  buildProfileSections,
  buildVfComponentSections,
  buildVfPageSections,
} from "./reference-builders.js";

export interface ReferencePageOutput {
  /** htmlOutDir 起点の相対パス (例: "component/permissionset/FinanceOps.html") */
  readonly relativePath: string;
  readonly html: string;
}

interface RefEntity {
  readonly name: string;
  readonly summary: string;
  readonly sections: readonly RefSection[];
}

interface RefTypeDef {
  readonly key: string;
  readonly label: string;
  readonly entities: (graph: KnowledgeGraph) => readonly RefEntity[];
}

const REF_TYPES: readonly RefTypeDef[] = [
  {
    key: "permissionset",
    label: "権限セット",
    entities: (g) =>
      g.permissionSets.map((ps) => ({
        name: ps.fullyQualifiedName,
        summary: `${ps.label ?? ""}${ps.license ? ` / ${ps.license}` : ""}`.trim() || "権限セット",
        sections: buildPermissionSetSections(ps),
      })),
  },
  {
    key: "profile",
    label: "プロファイル",
    entities: (g) =>
      g.profiles.map((pf) => ({
        name: pf.fullyQualifiedName,
        summary: pf.userLicense ?? "プロファイル",
        sections: buildProfileSections(pf),
      })),
  },
  {
    key: "flexipage",
    label: "Lightning ページ",
    entities: (g) =>
      g.flexiPages.map((fp) => ({
        name: fp.fullyQualifiedName,
        summary: `${fp.type ?? "FlexiPage"}${fp.sobjectType ? ` / ${fp.sobjectType}` : ""}`,
        sections: buildFlexiPageSections(fp),
      })),
  },
  {
    key: "vfpage",
    label: "Visualforce ページ",
    entities: (g) =>
      g.visualforcePages.map((vp) => ({
        name: vp.fullyQualifiedName,
        summary: `${vp.controller ?? vp.standardController ?? "—"}${vp.renderAs ? ` / ${vp.renderAs}` : ""}`,
        sections: buildVfPageSections(vp),
      })),
  },
  {
    key: "vfcomponent",
    label: "Visualforce コンポーネント",
    entities: (g) =>
      g.visualforceComponents.map((vc) => ({
        name: vc.fullyQualifiedName,
        summary: vc.controller ?? "—",
        sections: buildVfComponentSections(vc),
      })),
  },
  {
    key: "aura",
    label: "Aura コンポーネント",
    entities: (g) =>
      g.auraBundles.map((ab) => ({
        name: ab.fullyQualifiedName,
        summary: ab.bundleKind,
        sections: buildAuraSections(ab),
      })),
  },
];

/** ホームのサイドバー用: 各リファレンスタイプの (key, label, names) */
export function referenceSidebarGroups(
  graph: KnowledgeGraph,
): readonly { key: string; label: string; names: readonly string[] }[] {
  return REF_TYPES.map((t) => ({
    key: t.key,
    label: t.label,
    names: t
      .entities(graph)
      .map((e) => e.name)
      .toSorted((a, b) => a.localeCompare(b)),
  })).filter((g) => g.names.length > 0);
}

export function collectReferencePages(graph: KnowledgeGraph): readonly ReferencePageOutput[] {
  const out: ReferencePageOutput[] = [];
  for (const t of REF_TYPES) {
    const entities = t.entities(graph);
    if (entities.length === 0) continue;
    for (const e of entities) {
      out.push({
        relativePath: `component/${t.key}/${sanitizeFileName(e.name)}.html`,
        html: renderReferencePage(t, e),
      });
    }
    out.push({
      relativePath: `component/${t.key}/index.html`,
      html: renderReferenceIndex(t, entities),
    });
  }
  return out;
}

// ---------- ページシェル ----------

function pageHead(title: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — yohakuforce</title>
  <link rel="stylesheet" href="../../assets/styles.css" />
  <link rel="stylesheet" href="../../assets/home.css" />
  <link rel="stylesheet" href="../../assets/cmdk.css" />
</head>`;
}

function globalHeader(): string {
  return `  <header class="global-header">
    <div class="brand">
      <a href="../../index.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
        <span class="brand-dot">y</span>
        <span class="brand-name">yohakuforce</span>
        <span class="brand-sub">Knowledge Hub</span>
      </a>
    </div>
    <nav class="global-nav"><a href="../../legend.html" class="legend-link icon-button">${icon("book", { size: "15" })}凡例（読み方）</a></nav>
  </header>`;
}

function renderReferencePage(t: RefTypeDef, e: RefEntity): string {
  return `${pageHead(`${t.label}: ${e.name}`)}
<body>
${globalHeader()}
  <header class="component-header">
    <nav class="breadcrumb">
      <a href="../../index.html">Home</a>
      <span class="sep">/</span>
      <a href="./index.html">${escapeHtml(t.label)}</a>
      <span class="sep">/</span>
      <span class="current">${escapeHtml(e.name)}</span>
    </nav>
    <h1>
      <span class="type-pill">${escapeHtml(t.label)}</span>
      ${escapeHtml(e.name)}
    </h1>
  </header>
  <main class="component-main">
    <aside class="toc">
      <h2>セクション</h2>
      <ol>
        ${e.sections.map((s) => `<li><a href="#${escapeAttr(s.id)}">${escapeHtml(s.title)}</a></li>`).join("\n        ")}
      </ol>
    </aside>
    <article class="sections">
      ${e.sections.map(renderSection).join("\n      ")}
    </article>
  </main>
</body>
</html>
`;
}

function renderSection(s: RefSection): string {
  return `<section id="${escapeAttr(s.id)}" class="yohaku-section">
        <h2>${escapeHtml(s.title)}</h2>
        ${s.html}
      </section>`;
}

function renderReferenceIndex(t: RefTypeDef, entities: readonly RefEntity[]): string {
  const cards = [...entities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (e) =>
        `<a class="type-index-card" href="./${escapeAttr(sanitizeFileName(e.name))}.html">
          <div class="card-name">${escapeHtml(e.name)}</div>
          <div class="card-meta">${escapeHtml(e.summary)}</div>
        </a>`,
    )
    .join("\n        ");
  return `${pageHead(t.label)}
<body>
${globalHeader()}
  <header class="component-header">
    <nav class="breadcrumb">
      <a href="../../index.html">Home</a>
      <span class="sep">/</span>
      <span class="current">${escapeHtml(t.label)}</span>
    </nav>
    <h1><span class="type-pill">${escapeHtml(t.label)}</span> ${escapeHtml(t.label)}
      <span style="font-size:14px;color:var(--muted);font-weight:400;margin-left:8px;">${entities.length} 件</span>
    </h1>
  </header>
  <main class="home-main">
    <div class="type-index-grid">
        ${cards}
    </div>
  </main>
</body>
</html>
`;
}
