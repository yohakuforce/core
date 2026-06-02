// ----------------------------------------------------------------------------
// Apex ComponentViewModel builder
//
// graph.sqlite から取得した ApexClass を 12 セクションの HTML 断片に変換する。
// 「決定的セクション」は body / dependencies / tags から導出、「LLM セクション」
// は編集マーカー付きの空ブロックを置き、Phase 5 の domains 実行や後段の AI
// パスで埋める前提。
// ----------------------------------------------------------------------------

import type { CoverageEntry } from "../../coverage/types.js";
import { concernsForApex } from "../../render/concerns.js";
import { buildMethodSummaryTable } from "../../render/method-summary-table.js";
import { summaryForApex } from "../../render/summary.js";
import type { ApexClass, ApexMethodInfo, KnowledgeGraph } from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import { renderMethodFlowcharts } from "../render-method-flow.js";
import type { ComponentViewModel, SectionViewModel } from "../types.js";
import { buildProcessingDetailSection } from "./apex-detail.js";
import { buildFieldWritesSection } from "./apex-field-writes.js";
import { changeHistorySection } from "./shared.js";

export function buildApexViewModel(
  cls: ApexClass,
  graph: KnowledgeGraph,
  gitCwd?: string,
  coverage?: CoverageEntry,
  preservedBlocks?: Map<string, string>,
): ComponentViewModel {
  const sections: SectionViewModel[] = [
    {
      id: "one-line-summary",
      title: "一行サマリ",
      htmlContent: `<p>${escapeMaybeMarkdownInline(summaryForApex(cls, graph))}</p>`,
    },
    preservedOrPlaceholder(
      "business-meaning",
      "業務的意味づけ",
      "このクラスが業務的に何を解決しているかを 2〜3 文で記述してください。",
      preservedBlocks?.get("business-meaning"),
    ),
    {
      id: "dependencies",
      title: "依存関係",
      htmlContent: renderDependencies(cls, graph),
    },
    {
      id: "public-interface",
      title: "公開インターフェース",
      htmlContent: renderPublicInterface(cls),
    },
    {
      id: "data-model-touchpoints",
      title: "データモデル接点",
      htmlContent: renderDataModelTouchpoints(cls),
    },
    {
      id: "internal-flow",
      title: "内部処理フロー",
      htmlContent: renderInternalFlowPlaceholder(cls),
    },
    buildProcessingDetailSection({
      methodSummaryTable: buildMethodSummaryTable(cls),
      body: cls.body,
      preservedNarrative: preservedBlocks?.get("processing-detail-narrative"),
    }),
    buildFieldWritesSection({
      componentName: cls.fullyQualifiedName,
      body: cls.body,
      knownObjects: new Set(graph.objects.map((o) => o.fullyQualifiedName)),
      getPreserved: (id) => preservedBlocks?.get(id),
    }),
    {
      id: "io-contract",
      title: "入出力契約",
      htmlContent: renderIoContract(cls),
    },
    {
      id: "test-coverage",
      title: "テスト被覆",
      htmlContent: renderTestCoverage(cls, graph, coverage),
    },
    changeHistorySection(cls.sourcePath, gitCwd),
    {
      id: "impact-hint",
      title: "影響範囲ヒント",
      htmlContent: renderImpactHint(`ApexClass:${cls.fullyQualifiedName}`),
    },
    {
      id: "concerns",
      title: "既知の懸念",
      editableBlockId: "concerns",
      htmlContent: preservedBlocks?.get("concerns") ?? renderConcerns(cls, graph),
    },
    {
      id: "related-domains",
      title: "関連ドメイン",
      htmlContent: renderRelatedDomains(cls, graph),
    },
  ];

  return {
    type: "apex",
    name: cls.fullyQualifiedName,
    sections,
  };
}

// ---------- セクションごとの実装 ----------

function renderDependencies(cls: ApexClass, graph: KnowledgeGraph): string {
  const outgoing = uniqueClassNames(cls.body?.classReferences ?? []);
  const incoming = graph.apexClasses
    .filter((c) => c.fullyQualifiedName !== cls.fullyQualifiedName)
    .filter((c) =>
      (c.body?.classReferences ?? []).some((r) => r.className === cls.fullyQualifiedName),
    )
    .map((c) => c.fullyQualifiedName);

  return `
    <div class="grid two-col">
      <div>
        <h3>呼び出し先 (${outgoing.length})</h3>
        ${listOrPlaceholder(outgoing, "（呼び出し先は検出されませんでした）")}
      </div>
      <div>
        <h3>呼び出し元 (${incoming.length})</h3>
        ${listOrPlaceholder(incoming, "（呼び出し元は検出されませんでした）")}
      </div>
    </div>`;
}

function renderPublicInterface(cls: ApexClass): string {
  const methods = (cls.body?.methods ?? []).filter(
    (m) => m.visibility === "public" || m.visibility === "global",
  );
  if (methods.length === 0) {
    return `<p class="muted">公開メソッドはありません (interface / private のみ)。</p>`;
  }
  return `
    <table class="data-table">
      <thead><tr><th>可視性</th><th>static</th><th>戻り値</th><th>名前</th><th>引数</th><th>注釈</th></tr></thead>
      <tbody>
        ${methods.map(methodRow).join("\n        ")}
      </tbody>
    </table>`;
}

function methodRow(m: ApexMethodInfo): string {
  return `<tr>
    <td>${escapeHtml(m.visibility)}</td>
    <td>${m.isStatic ? "✓" : ""}</td>
    <td><code>${escapeHtml(m.returnType)}</code></td>
    <td><code>${escapeHtml(m.name)}</code></td>
    <td><code>${escapeHtml(m.parameters || "—")}</code></td>
    <td>${m.annotations.length === 0 ? "—" : m.annotations.map((a) => `<code>@${escapeHtml(a)}</code>`).join(", ")}</td>
  </tr>`;
}

function renderDataModelTouchpoints(cls: ApexClass): string {
  const body = cls.body;
  const soqlObjects = unique(
    (body?.soqlQueries ?? []).map((q) => q.primaryObject).filter((o): o is string => o !== null),
  );
  const dmlTargets = unique((body?.dmlOperations ?? []).map((d) => d.target));
  return `
    <div class="grid two-col">
      <div>
        <h3>SOQL 対象 (${soqlObjects.length})</h3>
        ${listOrPlaceholder(soqlObjects, "（SOQL は検出されませんでした）")}
      </div>
      <div>
        <h3>DML 対象 (${dmlTargets.length})</h3>
        ${listOrPlaceholder(dmlTargets, "（DML は検出されませんでした）")}
      </div>
    </div>`;
}

function renderInternalFlowPlaceholder(cls: ApexClass): string {
  const flows = cls.body?.controlFlows ?? [];
  if (flows.length === 0) {
    return `<p class="muted">制御フロー情報がありません (body 解析対象外、または抽象クラス/インターフェース)。</p>`;
  }
  return `
    <p class="muted">${flows.length} メソッドの制御フローを検出。各メソッドのヘッダをクリックで展開し、Mermaid 図 / ツリーを切替表示できます。</p>
    ${renderMethodFlowcharts(flows)}`;
}

function renderIoContract(cls: ApexClass): string {
  const methods = cls.body?.methods ?? [];
  if (methods.length === 0) {
    return `<p class="muted">メソッドは検出されませんでした。</p>`;
  }
  return `
    <table class="data-table">
      <thead><tr><th>メソッド</th><th>引数</th><th>戻り値</th></tr></thead>
      <tbody>
        ${methods
          .map(
            (m) => `<tr>
          <td><code>${escapeHtml(m.name)}</code></td>
          <td><code>${escapeHtml(m.parameters || "—")}</code></td>
          <td><code>${escapeHtml(m.returnType)}</code></td>
        </tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>`;
}

function renderTestCoverage(
  cls: ApexClass,
  graph: KnowledgeGraph,
  coverage?: CoverageEntry,
): string {
  if (cls.isTest) {
    return `<p class="muted">このクラス自身がテストクラスです。</p>`;
  }
  const testFqn = `${cls.fullyQualifiedName}Test`;
  const conventionalTest = graph.apexClasses.find(
    (c) => c.fullyQualifiedName === testFqn && c.isTest,
  );
  const referencingTests = graph.apexClasses
    .filter((c) => c.isTest && c.fullyQualifiedName !== testFqn)
    .filter((c) =>
      (c.body?.classReferences ?? []).some((r) => r.className === cls.fullyQualifiedName),
    );
  const all = [
    ...(conventionalTest !== undefined ? [conventionalTest.fullyQualifiedName] : []),
    ...referencingTests.map((t) => t.fullyQualifiedName),
  ];
  const coverageBlock = coverage !== undefined ? renderCoverageBlock(coverage) : "";
  if (all.length === 0) {
    return `${coverageBlock}<p class="warning">対応するテストクラスが見つかりません。</p>`;
  }
  return `${coverageBlock}<h3>関連テストクラス</h3>${listOrPlaceholder(all, "")}`;
}

function renderCoverageBlock(entry: CoverageEntry): string {
  const pct = entry.coveredPercent;
  const status = pct >= 75 ? "ok" : pct >= 50 ? "warn" : "danger";
  const barWidth = Math.max(2, Math.min(100, pct));
  return `
    <div class="coverage-block coverage-${status}">
      <div class="coverage-row">
        <span class="coverage-pct">${pct}%</span>
        <span class="coverage-meta">covered ${entry.numLinesCovered} / uncovered ${entry.numLinesUncovered} lines</span>
      </div>
      <div class="coverage-bar"><div class="coverage-fill" style="width:${barWidth}%"></div></div>
    </div>`;
}

function renderConcerns(cls: ApexClass, graph: KnowledgeGraph): string {
  const items = concernsForApex(cls, graph);
  if (items.length === 0) {
    return `<p class="muted">既知の懸念は検出されませんでした。</p>`;
  }
  return `
    <ul class="concerns">
      ${items
        .map(
          (c) =>
            `<li class="severity-${escapeHtml(c.severity)}"><span class="severity-badge">${escapeHtml(c.severity)}</span> <strong>${escapeHtml(c.title)}</strong>${c.detail !== undefined ? ` — ${escapeHtml(c.detail)}` : ""}</li>`,
        )
        .join("\n      ")}
    </ul>`;
}

function renderRelatedDomains(cls: ApexClass, graph: KnowledgeGraph): string {
  const domains = graph.tags
    .filter(
      (t) =>
        t.namespace === "domain" &&
        t.entity.kind === "apexClass" &&
        t.entity.fullyQualifiedName === cls.fullyQualifiedName,
    )
    .map((t) => t.value);
  if (domains.length === 0) {
    return `<p class="muted">未分類 (Phase 5 の <code>yohaku domains init</code> 実行後に自動付与されます)。</p>`;
  }
  return `<ul>${domains.map((d) => `<li><code>${escapeHtml(d)}</code></li>`).join("")}</ul>`;
}

function renderImpactHint(entityRef: string): string {
  return `
    <p>このコンポーネントの影響範囲を確認するには:</p>
    <pre><code>yohaku impact ${escapeHtml(entityRef)}</code></pre>`;
}

function preservedOrPlaceholder(
  id: SectionViewModel["id"],
  title: string,
  prompt: string,
  preserved: string | undefined,
): SectionViewModel {
  if (preserved !== undefined && preserved.trim() !== "") {
    return { id, title, editableBlockId: id, htmlContent: `\n        ${preserved}\n        ` };
  }
  return {
    id,
    title,
    editableBlockId: id,
    htmlContent: `
    <div class="llm-placeholder">
      <p class="muted">（このセクションは LLM で生成されます）</p>
      <p class="hint">${escapeHtml(prompt)}</p>
    </div>`,
  };
}

// ---------- helpers ----------

function listOrPlaceholder(items: readonly string[], emptyText: string): string {
  if (items.length === 0) {
    return emptyText === "" ? "" : `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul>${items.map((it) => `<li><code>${escapeHtml(it)}</code></li>`).join("")}</ul>`;
}

function unique<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

function uniqueClassNames(refs: readonly { readonly className: string }[]): string[] {
  return unique(refs.map((r) => r.className));
}

/**
 * summaryForApex は markdown を返す。HTML 用には ** ** と ` ` を最低限変換する。
 * 完全な markdown→HTML は導入しない (依存最小化のため)。
 */
function escapeMaybeMarkdownInline(md: string): string {
  // 先にエスケープ → 続けて bold / code の最低限装飾
  const esc = escapeHtml(md);
  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
