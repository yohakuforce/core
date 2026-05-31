// ----------------------------------------------------------------------------
// Component leaf HTML page template
//
// ComponentViewModel を 1 枚の HTML に組み上げる共通レイアウト。
// 詳細チューニング (タブ/折りたたみ/トップへ戻る等) は Phase 3 で導入予定。
// ----------------------------------------------------------------------------

import { escapeAttr, escapeHtml } from "./escape.js";
import type { ComponentViewModel, SectionViewModel } from "./types.js";

function escapeJsonForScript(s: string): string {
  return s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export interface PageRenderOptions {
  /** index への相対パス (例: "../../index.html") */
  readonly indexHref: string;
  /** assets ディレクトリへの相対パス (例: "../../assets") */
  readonly assetsHref: string;
  /** Phase 11: cmdk が href を解決する基準パス (例: "../../") */
  readonly hrefPrefix?: string;
  /** Phase 11: 埋め込み検索インデックス JSON (string 化済) */
  readonly searchIndexJson?: string;
}

export function renderComponentPage(vm: ComponentViewModel, options: PageRenderOptions): string {
  const title = `${typeLabel(vm.type)}: ${vm.name}`;
  const typeIndexHref = "./index.html"; // 同タイプ index ページは同ディレクトリ内
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — yohakuforce</title>
  <link rel="stylesheet" href="${escapeAttr(options.assetsHref)}/styles.css" />
  <link rel="stylesheet" href="${escapeAttr(options.assetsHref)}/home.css" />
  <link rel="stylesheet" href="${escapeAttr(options.assetsHref)}/cmdk.css" />
  ${options.searchIndexJson !== undefined ? `<script type="application/json" id="yohaku-search-index">${escapeJsonForScript(options.searchIndexJson)}</script>` : ""}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" defer></script>
  <script src="${escapeAttr(options.assetsHref)}/method-flowchart.js" defer></script>
  <script src="${escapeAttr(options.assetsHref)}/cmdk.js" defer></script>
</head>
<body data-href-prefix="${escapeAttr(options.hrefPrefix ?? "")}">
  <header class="global-header">
    <div class="brand">
      <a href="${escapeAttr(options.indexHref)}" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
        <span class="brand-dot">y</span>
        <span class="brand-name">yohakuforce</span>
        <span class="brand-sub">Knowledge Hub</span>
      </a>
    </div>
  </header>
  <header class="component-header">
    <nav class="breadcrumb">
      <a href="${escapeAttr(options.indexHref)}">Home</a>
      <span class="sep">/</span>
      <a href="${escapeAttr(typeIndexHref)}">${escapeHtml(typeLabel(vm.type))}</a>
      <span class="sep">/</span>
      <span class="current">${escapeHtml(vm.name)}</span>
    </nav>
    <h1>
      <span class="type-pill t-${escapeAttr(vm.type)}">${escapeHtml(vm.type)}</span>
      ${escapeHtml(vm.name)}
    </h1>
  </header>
  <main class="component-main">
    <aside class="toc">
      <h2>セクション</h2>
      <ol>
        ${vm.sections
          .map((s) => `<li><a href="#${escapeAttr(s.id)}">${escapeHtml(s.title)}</a></li>`)
          .join("\n        ")}
      </ol>
    </aside>
    <article class="sections">
      ${vm.sections.map(renderSection).join("\n      ")}
    </article>
  </main>
</body>
</html>
`;
}

function renderSection(s: SectionViewModel): string {
  const editableOpen =
    s.editableBlockId !== undefined
      ? `<!-- yohaku:block kind="ai_managed" id="${escapeAttr(s.editableBlockId)}" start -->`
      : "";
  const editableClose =
    s.editableBlockId !== undefined
      ? `<!-- yohaku:block kind="ai_managed" id="${escapeAttr(s.editableBlockId)}" end -->`
      : "";
  const editableAttr =
    s.editableBlockId !== undefined
      ? ` data-yohaku-editable="${escapeAttr(s.editableBlockId)}"`
      : "";
  return `<section id="${escapeAttr(s.id)}" class="yohaku-section yohaku-section--${escapeAttr(s.id)}"${editableAttr}>
        <h2>${escapeHtml(s.title)}</h2>
        ${editableOpen}
        ${s.htmlContent}
        ${editableClose}
      </section>`;
}

function typeLabel(t: ComponentViewModel["type"]): string {
  switch (t) {
    case "apex":
      return "ApexClass";
    case "trigger":
      return "ApexTrigger";
    case "lwc":
      return "LightningWebComponent";
    case "object":
      return "SObject";
    case "flow":
      return "Flow";
  }
}
