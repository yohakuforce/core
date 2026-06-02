// ----------------------------------------------------------------------------
// HTML render pipeline
//
// Phase 0: 配管 (--format html を受理して最小ホームを生成)
// Phase 1: Apex の component leaf HTML を生成、--strict で必須セクション enforcement
// Phase 2+: Trigger / LWC / Object / Flow を順次追加
// Phase 3:  ホームの JSON ドリブン化と Mermaid フォールバック
// ----------------------------------------------------------------------------

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildCoverageLookup } from "../coverage/index.js";
import type { KnowledgeGraph } from "../types/graph.js";
import { HOME_CSS_EXTRA, HOME_JS } from "./assets.js";
import { buildBusinessFlows } from "./business-flow-builder.js";
import { extractBusinessMeanings } from "./business-meaning-extractor.js";
import { CMDK_CSS, CMDK_JS } from "./cmdk.js";
import { buildArchitecture, buildDomains, buildHotspots, buildStats } from "./data-builder.js";
import { renderHomeHtml } from "./home.js";
import { buildLegendPage } from "./legend.js";
import { renderComponentPage } from "./page-template.js";
import { preserveAiManagedBlocks } from "./preserve-blocks.js";
import { METHOD_FLOWCHART_JS } from "./render-method-flow.js";
import { TYPE_INDEX_JS, renderTypeIndexPage } from "./render-type-index.js";
import { buildSearchIndex } from "./search-index.js";
import {
  COMPONENT_TYPES,
  SECTION_SCHEMA,
  applicableSectionsFor,
  auditSections,
} from "./sections.js";
import type {
  ComponentType,
  HtmlRenderOptions,
  HtmlRenderResult,
  SectionAuditResult,
} from "./types.js";
import { buildApexViewModel } from "./viewmodel/apex.js";
import { buildFlowViewModel } from "./viewmodel/flow.js";
import { buildLwcViewModel } from "./viewmodel/lwc.js";
import { buildObjectViewModel } from "./viewmodel/object.js";
import { buildTriggerViewModel } from "./viewmodel/trigger.js";

export { buildApexViewModel } from "./viewmodel/apex.js";
export { buildTriggerViewModel } from "./viewmodel/trigger.js";
export { buildLwcViewModel } from "./viewmodel/lwc.js";
export { buildObjectViewModel } from "./viewmodel/object.js";
export { buildFlowViewModel } from "./viewmodel/flow.js";
export { renderComponentPage } from "./page-template.js";
export { escapeHtml, escapeAttr, sanitizeFileName } from "./escape.js";
export { SECTION_SCHEMA, SECTION_IDS, COMPONENT_TYPES, auditSections } from "./sections.js";
export type {
  ComponentType,
  SectionAuditResult,
  SectionDescriptor,
  SectionId,
  SectionRequirement,
} from "./sections.js";
export type {
  ComponentViewModel,
  HtmlRenderOptions,
  HtmlRenderResult,
  SectionViewModel,
} from "./types.js";

const HOME_PHASE_NOTICE =
  "HTML 設計書パイプライン稼働中: 5 タイプの component leaf + JSON ドリブンホーム + Mermaid/HTML フォールバック + domains.yaml 連携。--strict で 12 セクション必須充足を検査。";

export class HtmlAuditFailedError extends Error {
  readonly failures: readonly SectionAuditResult[];
  constructor(failures: readonly SectionAuditResult[]) {
    super(
      `HTML render audit failed: ${failures.length} component(s) missing required sections. Run without --strict to see details.`,
    );
    this.failures = failures;
    this.name = "HtmlAuditFailedError";
  }
}

/**
 * HTML パイプラインのエントリポイント。
 *
 * - <htmlOutDir>/index.html : ホーム (Phase 3 で本実装)
 * - <htmlOutDir>/data/sections-schema.json : 12項目スキーマ
 * - <htmlOutDir>/assets/styles.css : ベース CSS
 * - <htmlOutDir>/component/apex/<ClassName>.html : Apex 各クラス (Phase 1)
 *
 * options.strict が true のとき、必須セクションが欠落したコンポーネントが
 * 1 つでもあれば HtmlAuditFailedError を throw する。
 */
export function renderHtmlAll(
  graph: KnowledgeGraph,
  htmlOutDir: string,
  options?: HtmlRenderOptions,
): HtmlRenderResult {
  const written: string[] = [];
  const skipped: string[] = [];
  const auditFailures: SectionAuditResult[] = [];
  const warnings: { code: string; message: string }[] = [];

  ensureDir(htmlOutDir);
  ensureDir(join(htmlOutDir, "data"));
  ensureDir(join(htmlOutDir, "assets"));

  const schemaPath = join(htmlOutDir, "data", "sections-schema.json");
  writeFileSync(schemaPath, JSON.stringify(buildSectionSchemaPayload(), null, 2), "utf8");
  written.push(schemaPath);

  // Phase 3: JSON データファイル群を書き出し
  const statsPath = join(htmlOutDir, "data", "stats.json");
  writeFileSync(statsPath, JSON.stringify(buildStats(graph), null, 2), "utf8");
  written.push(statsPath);

  const archPath = join(htmlOutDir, "data", "architecture.json");
  writeFileSync(archPath, JSON.stringify(buildArchitecture(graph), null, 2), "utf8");
  written.push(archPath);

  const domainsPath = join(htmlOutDir, "data", "domains.json");
  writeFileSync(
    domainsPath,
    JSON.stringify(buildDomains(graph, options?.domainsConfig ?? null), null, 2),
    "utf8",
  );
  written.push(domainsPath);

  const hotspotsPath = join(htmlOutDir, "data", "hotspots.json");
  writeFileSync(hotspotsPath, JSON.stringify(buildHotspots(graph), null, 2), "utf8");
  written.push(hotspotsPath);

  const cssPath = join(htmlOutDir, "assets", "styles.css");
  writeFileSync(cssPath, BASE_CSS, "utf8");
  written.push(cssPath);

  const homeCssPath = join(htmlOutDir, "assets", "home.css");
  writeFileSync(homeCssPath, HOME_CSS_EXTRA, "utf8");
  written.push(homeCssPath);

  const homeJsPath = join(htmlOutDir, "assets", "home.js");
  writeFileSync(homeJsPath, HOME_JS, "utf8");
  written.push(homeJsPath);

  const methodFlowJsPath = join(htmlOutDir, "assets", "method-flowchart.js");
  writeFileSync(methodFlowJsPath, METHOD_FLOWCHART_JS, "utf8");
  written.push(methodFlowJsPath);

  const typeIndexJsPath = join(htmlOutDir, "assets", "type-index.js");
  writeFileSync(typeIndexJsPath, TYPE_INDEX_JS, "utf8");
  written.push(typeIndexJsPath);

  // Phase 11: Cmd+K 検索パレット用 asset & インデックス
  const cmdkJsPath = join(htmlOutDir, "assets", "cmdk.js");
  writeFileSync(cmdkJsPath, CMDK_JS, "utf8");
  written.push(cmdkJsPath);
  const cmdkCssPath = join(htmlOutDir, "assets", "cmdk.css");
  writeFileSync(cmdkCssPath, CMDK_CSS, "utf8");
  written.push(cmdkCssPath);
  const searchIndex = buildSearchIndex(graph, options?.domainsConfig ?? null);
  const searchIndexPath = join(htmlOutDir, "data", "search-index.json");
  writeFileSync(searchIndexPath, JSON.stringify(searchIndex), "utf8");
  written.push(searchIndexPath);
  // ページ embed 用に JSON を文字列キャッシュ (renderHomeHtml / renderTypeIndexPage /
  // 各 leaf ページが共通利用するため、外で 1 回 stringify する)
  const searchIndexJson = JSON.stringify(searchIndex);

  const coverageLookup = buildCoverageLookup(options?.coverage ?? null);
  // Phase 15: 前回の build で fill 済の ai_managed ブロックを保全し、
  // 今回の render で placeholder に上書きされないようにする
  const preservedBlocks = preserveAiManagedBlocks(htmlOutDir);
  for (const t of COMPONENT_TYPES) {
    if (!typeIncluded(t, options?.typesFilter)) {
      skipped.push(`${t} (filtered)`);
      continue;
    }
    const r = renderComponentsForType(
      t,
      graph,
      htmlOutDir,
      options?.gitCwd,
      searchIndexJson,
      coverageLookup,
      preservedBlocks,
    );
    written.push(...r.written);
    auditFailures.push(...r.audit);

    // タイプ index ページ (component/<type>/index.html)
    const typeIndexHtml = renderTypeIndexPage(
      t,
      graph,
      options?.domainsConfig ?? null,
      searchIndexJson,
    );
    const typeIndexPath = join(htmlOutDir, "component", t, "index.html");
    writeFileSync(typeIndexPath, typeIndexHtml, "utf8");
    written.push(typeIndexPath);
  }

  // Phase 15: 業務フローデータ生成。component leaf を render し終えた後に
  // 既存 HTML から business-meaning を抽出 (LLM 充填済なら集約画面に出る)。
  const meaningLookup = extractBusinessMeanings(htmlOutDir);
  const businessFlows = buildBusinessFlows(graph, options?.domainsConfig ?? null, meaningLookup);
  const businessFlowsJson = JSON.stringify(businessFlows);
  const businessFlowsPath = join(htmlOutDir, "data", "business-flows.json");
  writeFileSync(businessFlowsPath, JSON.stringify(businessFlows, null, 2), "utf8");
  written.push(businessFlowsPath);

  const indexPath = join(htmlOutDir, "index.html");
  writeFileSync(
    indexPath,
    renderHomeHtml(graph, options?.domainsConfig ?? null, searchIndexJson, businessFlowsJson),
    "utf8",
  );
  written.push(indexPath);

  const legendPath = join(htmlOutDir, "legend.html");
  writeFileSync(
    legendPath,
    buildLegendPage({ indexHref: "index.html", assetsHref: "assets" }),
    "utf8",
  );
  written.push(legendPath);

  warnings.push({ code: "phase_notice", message: HOME_PHASE_NOTICE });

  if (auditFailures.length > 0 && options?.strict === true) {
    throw new HtmlAuditFailedError(auditFailures);
  }

  return { written, skipped, auditFailures, warnings };
}

function typeIncluded(type: ComponentType, filter: readonly ComponentType[] | undefined): boolean {
  if (filter === undefined || filter.length === 0) return true;
  return filter.includes(type);
}

function renderComponentsForType(
  type: ComponentType,
  graph: KnowledgeGraph,
  htmlOutDir: string,
  gitCwd?: string,
  searchIndexJson?: string,
  coverageLookup?: Map<string, import("../coverage/types.js").CoverageEntry>,
  preservedBlocks?: import("./preserve-blocks.js").PreservedBlocksMap,
): { written: string[]; audit: SectionAuditResult[] } {
  const written: string[] = [];
  const audit: SectionAuditResult[] = [];
  const outDir = join(htmlOutDir, "component", type);
  ensureDir(outDir);

  const items = collectViewModels(type, graph, gitCwd, coverageLookup, preservedBlocks);
  for (const { name, vm } of items) {
    const auditResult = auditSections(
      type,
      name,
      vm.sections.map((s) => s.id),
    );
    if (auditResult.missing.length > 0) audit.push(auditResult);

    const html = renderComponentPage(vm, {
      indexHref: "../../index.html",
      assetsHref: "../../assets",
      legendHref: "../../legend.html",
      hrefPrefix: "../../",
      ...(searchIndexJson !== undefined ? { searchIndexJson } : {}),
    });
    const filePath = join(outDir, `${safeFile(name)}.html`);
    writeFileSync(filePath, html, "utf8");
    written.push(filePath);
  }
  return { written, audit };
}

interface NamedViewModel {
  readonly name: string;
  readonly vm: ReturnType<typeof buildApexViewModel>;
}

function collectViewModels(
  type: ComponentType,
  graph: KnowledgeGraph,
  gitCwd?: string,
  coverageLookup?: Map<string, import("../coverage/types.js").CoverageEntry>,
  preservedBlocks?: import("./preserve-blocks.js").PreservedBlocksMap,
): readonly NamedViewModel[] {
  const preservedFor = (t: ComponentType, name: string): Map<string, string> | undefined => {
    const safe = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
    return preservedBlocks?.get(`${t}:${safe}`);
  };
  switch (type) {
    case "apex":
      return graph.apexClasses.map((c) => ({
        name: c.fullyQualifiedName,
        vm: buildApexViewModel(
          c,
          graph,
          gitCwd,
          coverageLookup?.get(c.fullyQualifiedName),
          preservedFor("apex", c.fullyQualifiedName),
        ),
      }));
    case "trigger":
      return graph.apexTriggers.map((t) => ({
        name: t.fullyQualifiedName,
        vm: buildTriggerViewModel(
          t,
          graph,
          gitCwd,
          coverageLookup?.get(t.fullyQualifiedName),
          preservedFor("trigger", t.fullyQualifiedName),
        ),
      }));
    case "lwc":
      return graph.lwcs.map((l) => ({
        name: l.fullyQualifiedName,
        vm: buildLwcViewModel(l, graph, gitCwd, preservedFor("lwc", l.fullyQualifiedName)),
      }));
    case "object":
      return graph.objects.map((o) => ({
        name: o.fullyQualifiedName,
        vm: buildObjectViewModel(o, graph, gitCwd, preservedFor("object", o.fullyQualifiedName)),
      }));
    case "flow":
      return graph.flows.map((f) => ({
        name: f.fullyQualifiedName,
        vm: buildFlowViewModel(f, graph, gitCwd, preservedFor("flow", f.fullyQualifiedName)),
      }));
  }
}

function safeFile(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
}

function buildSectionSchemaPayload(): unknown {
  return {
    version: 1,
    componentTypes: COMPONENT_TYPES,
    sections: SECTION_SCHEMA.map((s) => ({
      id: s.id,
      label: s.label,
      source: s.source,
      perType: s.perType,
    })),
    applicableByType: Object.fromEntries(COMPONENT_TYPES.map((t) => [t, applicableSectionsFor(t)])),
  };
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

/**
 * 出力先パスから html 出力ディレクトリ (outRoot/html) を解決する。
 * cli から呼ぶ時の共通ヘルパ。
 */
export function resolveHtmlOutDir(outRoot: string): string {
  return resolve(outRoot, "html");
}

// 内部利用: dirname の再エクスポート防止
export const _internal = { dirname };

const BASE_CSS = `:root {
  /* Salesforce Lightning Design System (SLDS) inspired tokens */
  --bg: #f3f3f3;
  --bg-surface: #ffffff;
  --bg-alt: #fafaf9;
  --fg: #181818;
  --fg-strong: #080707;
  --muted: #706e6b;
  --muted-soft: #b0adab;
  --border: #dddbda;
  --border-strong: #c9c7c5;
  --accent: #0176d3;
  --accent-hover: #014486;
  --accent-bg: #eaf5fe;
  --link: #0176d3;

  /* Type color palette (Salesforce-flavored, each コンポーネントタイプに固有色) */
  --type-apex: #032d60;       /* SLDS "Brand Navy" */
  --type-apex-bg: #e8edf3;
  --type-trigger: #c23934;    /* SLDS "Error" */
  --type-trigger-bg: #fde8e7;
  --type-lwc: #0176d3;        /* SLDS "Brand Blue" */
  --type-lwc-bg: #eaf5fe;
  --type-object: #2e844a;     /* SLDS "Success" */
  --type-object-bg: #ebf7ee;
  --type-flow: #b67d11;       /* SLDS "Warning" */
  --type-flow-bg: #fef6e8;

  /* Status colors */
  --warning-bg: #fef6e8;
  --warning-fg: #b67d11;
  --severity-high-bg: #fde8e7;
  --severity-high-fg: #c23934;
  --severity-medium-bg: #fef6e8;
  --severity-medium-fg: #b67d11;
  --severity-info-bg: #eaf5fe;
  --severity-info-fg: #0176d3;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.1);
  --radius: 6px;
  --radius-lg: 8px;

  /* Typography */
  --font-sans: "Salesforce Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-sans);
  color: var(--fg);
  background: var(--bg);
  line-height: 1.55;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: var(--font-mono); font-size: 12.5px; background: var(--bg-alt); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border); }
pre code { display: block; padding: 12px 14px; line-height: 1.5; overflow-x: auto; background: #181818; color: #f3f3f3; border: 0; }
strong { color: var(--fg-strong); }

/* ===== Component header / breadcrumb ===== */
.component-header {
  padding: 18px 32px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}
.component-header h1 {
  font-size: 22px;
  margin: 8px 0 0;
  font-weight: 600;
  color: var(--fg-strong);
  display: flex; align-items: center; gap: 12px;
}
.breadcrumb { font-size: 13px; color: var(--muted); display: flex; align-items: center; flex-wrap: wrap; }
.breadcrumb a { color: var(--link); }
.breadcrumb .sep { margin: 0 8px; color: var(--muted-soft); }
.breadcrumb .current { color: var(--fg); font-weight: 500; }

/* Type pill (used in headers, lists, type-index cards) */
.type-pill {
  display: inline-flex; align-items: center;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  padding: 3px 10px; border-radius: 999px;
}
.type-pill.t-apex    { background: var(--type-apex-bg);    color: var(--type-apex); }
.type-pill.t-trigger { background: var(--type-trigger-bg); color: var(--type-trigger); }
.type-pill.t-lwc     { background: var(--type-lwc-bg);     color: var(--type-lwc); }
.type-pill.t-object  { background: var(--type-object-bg);  color: var(--type-object); }
.type-pill.t-flow    { background: var(--type-flow-bg);    color: var(--type-flow); }

/* ===== Component leaf layout ===== */
.component-main {
  display: grid;
  grid-template-columns: 232px 1fr;
  gap: 28px;
  padding: 24px 32px 64px;
  max-width: 1280px;
  margin: 0 auto;
}
.toc {
  position: sticky; top: 16px; align-self: start;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.toc h2 { font-size: 11px; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; letter-spacing: 0.06em; font-weight: 600; }
.toc ol { list-style: none; padding: 0; margin: 0; font-size: 13px; counter-reset: tocItem; }
.toc li { margin: 0; counter-increment: tocItem; }
.toc a {
  display: block; padding: 5px 8px; border-radius: 4px;
  color: var(--fg); position: relative;
}
.toc a::before {
  content: counter(tocItem) ". "; color: var(--muted-soft); margin-right: 2px;
}
.toc a:hover { background: var(--accent-bg); color: var(--accent); text-decoration: none; }

.sections { min-width: 0; }
.yohaku-section {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 20px 24px;
  margin-bottom: 16px; box-shadow: var(--shadow-sm);
}
.yohaku-section h2 {
  font-size: 16px; margin: 0 0 14px; font-weight: 600; color: var(--fg-strong);
  display: flex; align-items: center; gap: 8px;
}
.yohaku-section h2::before {
  content: ""; display: inline-block; width: 3px; height: 16px; background: var(--accent); border-radius: 2px;
}
.yohaku-section h3 {
  font-size: 12px; margin: 16px 0 6px; color: var(--muted);
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
}
.yohaku-section ul, .yohaku-section ol { padding-left: 20px; margin: 6px 0; }
.yohaku-section li { margin: 3px 0; }
.yohaku-section .muted { color: var(--muted); font-size: 13.5px; }
.yohaku-section .warning {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--warning-fg); background: var(--warning-bg);
  padding: 8px 14px; border-radius: var(--radius); font-size: 13px;
  border: 1px solid #f5d99e;
}
.yohaku-section .warning::before {
  content: ""; display: inline-block; width: 14px; height: 14px;
  background-color: var(--warning-fg); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-position: center; mask-position: center;
  -webkit-mask-size: contain; mask-size: contain;
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/><line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>");
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/><line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>");
}
.yohaku-section p { margin: 8px 0; }

.grid.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 800px) { .grid.two-col { grid-template-columns: 1fr; } }

.data-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
}
.data-table th, .data-table td {
  border-bottom: 1px solid var(--border); padding: 8px 12px; text-align: left;
}
.data-table tbody tr:last-child td { border-bottom: 0; }
.data-table thead { background: var(--bg-alt); }
.data-table th { font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
.data-table tbody tr:hover { background: var(--accent-bg); }

.llm-placeholder {
  border: 1px dashed var(--border-strong); padding: 14px 16px;
  border-radius: var(--radius); background: var(--bg-alt);
}
.llm-placeholder .hint { font-size: 12px; color: var(--muted); margin: 6px 0 0; }

.concerns { list-style: none; padding: 0; }
.concerns li {
  padding: 10px 14px; border-radius: var(--radius); margin: 8px 0; font-size: 13px;
  border-left: 3px solid transparent;
}
.concerns .severity-badge {
  display: inline-block; padding: 2px 8px; border-radius: 3px;
  font-size: 10px; font-weight: 700; margin-right: 10px; letter-spacing: 0.04em; text-transform: uppercase;
}
.concerns .severity-HIGH   { background: var(--severity-high-bg);   color: var(--severity-high-fg);   border-left-color: var(--severity-high-fg); }
.concerns .severity-HIGH .severity-badge   { background: var(--severity-high-fg);   color: #fff; }
.concerns .severity-MEDIUM { background: var(--severity-medium-bg); color: var(--severity-medium-fg); border-left-color: var(--severity-medium-fg); }
.concerns .severity-MEDIUM .severity-badge { background: var(--severity-medium-fg); color: #fff; }
.concerns .severity-INFO   { background: var(--severity-info-bg);   color: var(--severity-info-fg);   border-left-color: var(--severity-info-fg); }
.concerns .severity-INFO .severity-badge   { background: var(--severity-info-fg);   color: #fff; }

/* Coverage block (Phase 14) */
.coverage-block {
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 10px 14px; margin-bottom: 12px; background: var(--bg-alt);
  border-left: 3px solid var(--muted-soft);
}
.coverage-block.coverage-ok     { border-left-color: var(--type-object); }
.coverage-block.coverage-warn   { border-left-color: var(--type-flow); }
.coverage-block.coverage-danger { border-left-color: var(--type-trigger); }
.coverage-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.coverage-pct { font-size: 22px; font-weight: 700; color: var(--fg-strong); font-family: var(--font-mono); }
.coverage-block.coverage-ok     .coverage-pct { color: var(--type-object); }
.coverage-block.coverage-warn   .coverage-pct { color: var(--type-flow); }
.coverage-block.coverage-danger .coverage-pct { color: var(--type-trigger); }
.coverage-meta { font-size: 12px; color: var(--muted); }
.coverage-bar {
  margin-top: 8px; height: 8px; background: var(--border);
  border-radius: 999px; overflow: hidden;
}
.coverage-fill { height: 100%; background: var(--muted-soft); transition: width 0.3s ease; }
.coverage-block.coverage-ok     .coverage-fill { background: var(--type-object); }
.coverage-block.coverage-warn   .coverage-fill { background: var(--type-flow); }
.coverage-block.coverage-danger .coverage-fill { background: var(--type-trigger); }

/* Method-level flowchart blocks (Apex/Trigger internal-flow) */
.method-flow {
  border: 1px solid var(--border); border-radius: var(--radius);
  margin: 12px 0; background: var(--bg-surface); overflow: hidden;
}
.method-flow summary {
  cursor: pointer; padding: 10px 14px; background: var(--bg-alt);
  font-weight: 600; color: var(--fg-strong); display: flex; gap: 10px; align-items: center;
  list-style: none;
}
.method-flow summary::-webkit-details-marker { display: none; }
.method-flow summary::before {
  content: ""; display: inline-block; width: 0; height: 0;
  border-left: 5px solid var(--muted);
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  margin-right: 4px; transition: transform 0.15s;
}
.method-flow[open] summary::before { transform: rotate(90deg); }
.method-flow .meta { color: var(--muted); font-size: 12px; font-weight: 400; margin-left: auto; }
.method-flow .body { padding: 14px; }
.method-flow .mermaid-host { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; overflow-x: auto; }
.method-flow .fallback-tree { background: var(--bg-alt); border-radius: var(--radius); padding: 12px; font-family: var(--font-mono); font-size: 12px; line-height: 1.7; }
.method-flow .fallback-tree ul { list-style: none; padding-left: 18px; border-left: 1px dashed var(--border-strong); margin: 4px 0; }
.method-flow .fallback-tree .node-soql, .method-flow .fallback-tree .node-dml { color: var(--type-trigger); }
.method-flow .fallback-tree .node-if, .method-flow .fallback-tree .node-for, .method-flow .fallback-tree .node-while, .method-flow .fallback-tree .node-try { color: var(--type-lwc); font-weight: 600; }
.method-flow .fallback-tree .node-return, .method-flow .fallback-tree .node-throw { color: var(--type-flow); font-weight: 600; }
.method-flow .switch-buttons { display: flex; gap: 6px; margin-bottom: 10px; }
.method-flow .switch-buttons button { font-size: 11px; padding: 3px 10px; border: 1px solid var(--border); background: #fff; border-radius: 3px; cursor: pointer; color: var(--fg); }
.method-flow .switch-buttons button[aria-selected="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }

/* ===== 詳細設計セクション (processing-detail / field-assignment / calculation-rules) ===== */
/* 数式の自然語化 */
.formula-nl {
  background: var(--bg-alt); border: 1px solid var(--border); border-left: 3px solid var(--accent);
  border-radius: var(--radius); padding: 10px 14px; margin: 6px 0;
  font-family: var(--font-mono); font-size: 12.5px; line-height: 1.8;
  white-space: pre-wrap; word-break: break-word; color: var(--fg-strong);
}
/* base の pre code (白文字・block) を上書きしてフィールド名を可読化 */
.formula-nl code {
  display: inline; background: rgba(1,118,211,0.10); color: var(--accent);
  padding: 0 4px; border-radius: 3px; border: 0; font-size: 12px; line-height: inherit;
}
.formula-raw { margin: 4px 0 0; }
.formula-raw summary { cursor: pointer; font-size: 12px; color: var(--muted); }
.formula-raw pre { background: var(--bg-alt); border-radius: var(--radius); padding: 10px; overflow-x: auto; font-size: 12px; }

/* 計算項目 / 入力規則カード */
.calc-card {
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-surface); padding: 12px 16px; margin: 12px 0; box-shadow: var(--shadow-sm);
}
.calc-card h4 { margin: 0 0 8px; font-size: 14px; color: var(--fg-strong); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.calc-card .calc-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 6px 0 2px; }
.calc-card.calc-vr { border-left: 3px solid var(--type-flow); }
.calc-card .vr-message { font-size: 13px; margin: 4px 0; }
.badge { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); font-weight: 600; }
.badge-vr { background: var(--severity-medium-bg); color: var(--severity-medium-fg); }
.badge-on { background: var(--severity-info-bg); color: var(--severity-info-fg); }
.badge-off { background: var(--bg-alt); color: var(--muted); }

/* 項目値の割り当て表 */
.field-assignment .value-origin {
  display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px;
  border-radius: 4px; background: var(--accent-bg); color: var(--accent);
}

/* 処理詳細: 件数表 + 処理ステップ + LLM 解説 */
.processing-summary .num { text-align: center; font-family: var(--font-mono); }
.processing-summary .num.hot { font-weight: 700; color: var(--type-trigger); }
.method-detail { border: 1px solid var(--border); border-radius: var(--radius); margin: 8px 0; background: var(--bg-surface); overflow: hidden; }
.method-detail summary { cursor: pointer; padding: 9px 14px; background: var(--bg-alt); font-size: 13px; }
.step-list { list-style: none; padding-left: 18px; border-left: 1px dashed var(--border-strong); margin: 8px 0 8px 6px; }
.step-list li { margin: 4px 0; font-size: 13px; line-height: 1.7; }
.step-list .step-else { font-size: 12px; color: var(--muted); margin: 2px 0; }
.step-kind {
  display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px;
  margin-right: 6px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.03em;
}
.step-in { background: var(--bg-alt); color: var(--muted); }
.step-soql, .step-dml { background: var(--severity-high-bg); color: var(--severity-high-fg); }
.step-if, .step-loop, .step-try { background: var(--severity-medium-bg); color: var(--severity-medium-fg); }
.step-return { background: var(--severity-info-bg); color: var(--severity-info-fg); }
.step-throw { background: var(--type-trigger); color: #fff; }
.step-stmt { background: var(--bg-alt); color: var(--fg); }
.step-raw { font-size: 11px; color: var(--muted); }
/* LLM 解説 (processing-detail-narrative) — 決定的部と視覚的に区別 */
.yohaku-section--processing-detail .narrative {
  border: 1px solid var(--accent); border-left: 4px solid var(--accent);
  border-radius: var(--radius); background: var(--accent-bg); padding: 12px 16px; margin: 8px 0 16px;
}
.narrative .method-narrative dt { font-weight: 600; margin-top: 8px; color: var(--fg-strong); }
.narrative .method-narrative dd { margin: 2px 0 6px 0; font-size: 13px; line-height: 1.75; }

/* AI 確認/詳細ブロック (項目割当の詳細 / 計算・入力規則レビュー) — 決定的部と区別 */
.ai-detail {
  border: 1px solid var(--accent); border-left: 4px solid var(--accent);
  border-radius: var(--radius); background: var(--accent-bg); padding: 12px 16px; margin: 12px 0;
}
.ai-detail > .ai-detail-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.ai-detail .ai-tag { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--accent); color: #fff; }
.ai-detail .data-table { background: #fff; }
.ai-review.clean { border-color: var(--type-object); border-left-color: var(--type-object); background: #f0faf3; }
.ai-review.clean .ai-detail-head { color: var(--type-object); }
.ai-review.clean .ai-tag { background: var(--type-object); }

/* オブジェクト別タブ (項目値の割り当て: 1クラス→複数オブジェクト) — JS 不要の radio タブ */
.obj-tabs { margin: 8px 0; }
.obj-tabs > input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
.obj-tabs > .obj-tablist { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 2px solid var(--border); margin-bottom: 0; }
.obj-tabs > .obj-tablist > label {
  cursor: pointer; padding: 7px 14px; font-size: 13px; font-weight: 600; color: var(--muted);
  border: 1px solid transparent; border-bottom: 0; border-radius: 6px 6px 0 0; margin-bottom: -2px;
  display: inline-flex; align-items: center; gap: 6px;
}
.obj-tabs > .obj-tablist > label:hover { color: var(--accent); background: var(--accent-bg); }
.obj-tabs > .obj-tablist > label .tab-count { font-size: 11px; color: var(--muted-soft); font-weight: 500; }
.obj-tabs > .obj-tabpanel { display: none; padding: 14px 2px; }
/* radio:checked → 対応 label を強調 + panel を表示 (隣接の nth で対応付け) */
.obj-tabs > input:nth-of-type(1):checked ~ .obj-tablist > label:nth-of-type(1),
.obj-tabs > input:nth-of-type(2):checked ~ .obj-tablist > label:nth-of-type(2),
.obj-tabs > input:nth-of-type(3):checked ~ .obj-tablist > label:nth-of-type(3),
.obj-tabs > input:nth-of-type(4):checked ~ .obj-tablist > label:nth-of-type(4),
.obj-tabs > input:nth-of-type(5):checked ~ .obj-tablist > label:nth-of-type(5),
.obj-tabs > input:nth-of-type(6):checked ~ .obj-tablist > label:nth-of-type(6),
.obj-tabs > input:nth-of-type(7):checked ~ .obj-tablist > label:nth-of-type(7),
.obj-tabs > input:nth-of-type(8):checked ~ .obj-tablist > label:nth-of-type(8) {
  color: var(--accent); border-color: var(--border); border-bottom-color: #fff; background: #fff;
}
.obj-tabs > input:nth-of-type(1):checked ~ .obj-tabpanel:nth-of-type(1),
.obj-tabs > input:nth-of-type(2):checked ~ .obj-tabpanel:nth-of-type(2),
.obj-tabs > input:nth-of-type(3):checked ~ .obj-tabpanel:nth-of-type(3),
.obj-tabs > input:nth-of-type(4):checked ~ .obj-tabpanel:nth-of-type(4),
.obj-tabs > input:nth-of-type(5):checked ~ .obj-tabpanel:nth-of-type(5),
.obj-tabs > input:nth-of-type(6):checked ~ .obj-tabpanel:nth-of-type(6),
.obj-tabs > input:nth-of-type(7):checked ~ .obj-tabpanel:nth-of-type(7),
.obj-tabs > input:nth-of-type(8):checked ~ .obj-tabpanel:nth-of-type(8) { display: block; }

/* 組織設定パネル (ホーム) */
.org-block { margin: 0 0 28px; }
.org-block h3 { font-size: 14px; margin: 0 0 10px; color: var(--fg-strong); }
.org-block h4 { font-size: 13px; margin: 14px 0 6px; color: var(--muted); }

/* Object 周辺メタ (レイアウト / 承認ステップ) */
.layout-block { border: 1px solid var(--border); border-radius: var(--radius); margin: 8px 0; background: var(--bg-surface); padding: 4px 12px; }
.layout-block > summary { cursor: pointer; padding: 8px 0; font-weight: 600; }
.layout-block h4 { font-size: 13px; margin: 8px 0 4px; color: var(--fg-strong); }
.approval-step { border-left: 3px solid var(--border-strong); padding: 2px 0 2px 12px; margin: 8px 0; }
.approval-step h5 { font-size: 13px; margin: 4px 0; color: var(--fg-strong); }

/* 凡例リンク (component ヘッダ) + 凡例ページの図形スウォッチ */
.global-nav { margin-left: auto; }
.global-nav .legend-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--accent); text-decoration: none; padding: 6px 12px;
  border: 1px solid var(--border); border-radius: 6px; background: #fff; white-space: nowrap;
}
.global-nav .legend-link .icon { width: 15px; height: 15px; }
.global-nav .legend-link:hover { background: var(--accent-bg); border-color: var(--accent); }
.legend-table td:first-child { white-space: nowrap; text-align: center; width: 70px; }
.lg-swatch { display: inline-block; width: 38px; height: 22px; vertical-align: middle; background: var(--muted-soft); }
.lg-stadium { border-radius: 999px; background: var(--muted-soft); }
.lg-data { background: var(--type-trigger); }
.lg-cond { background: var(--type-lwc); }
.lg-exit { background: var(--type-flow); }
.lg-paral { clip-path: polygon(16% 0, 100% 0, 84% 100%, 0 100%); }
.lg-diamond { width: 24px; height: 24px; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.lg-rect { border-radius: 4px; }
.lg-circle { width: 24px; height: 24px; border-radius: 999px; }
.lg-double { box-shadow: inset 4px 0 0 #fff, inset -4px 0 0 #fff; }

/* ===== Home / type-index shared =====
 * width:100% + max-width で「viewport が広ければ 1280px に固定、
 * 狭ければ親列幅に追随」させる。min-width:0 で子要素 (Mermaid SVG 等) の
 * intrinsic width が main の幅に影響しないようにする。
 */
.home-main {
  width: 100%;
  max-width: 1280px;
  min-width: 0;
  margin: 0 auto;
  padding: 24px 32px 64px;
  box-sizing: border-box;
}
.home-main > * { min-width: 0; }
.tab-panel { min-width: 0; }
.home-main h2 {
  font-size: 14px; margin: 28px 0 12px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.home-main .notice {
  padding: 12px 16px; border: 1px solid var(--border); background: var(--bg-surface);
  border-radius: var(--radius); color: var(--muted); font-size: 13px;
  box-shadow: var(--shadow-sm);
}
`;
