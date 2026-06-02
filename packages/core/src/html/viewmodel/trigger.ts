// ----------------------------------------------------------------------------
// Trigger ComponentViewModel builder
// ----------------------------------------------------------------------------

import type { CoverageEntry } from "../../coverage/types.js";
import { concernsForTrigger } from "../../render/concerns.js";
import { buildMethodSummaryTable } from "../../render/method-summary-table.js";
import { summaryForApexTrigger } from "../../render/summary.js";
import type { ApexTrigger, KnowledgeGraph } from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import { renderMethodFlowcharts } from "../render-method-flow.js";
import type { ComponentViewModel, SectionViewModel } from "../types.js";
import { buildProcessingDetailSection } from "./apex-detail.js";
import { buildFieldWritesSection } from "./apex-field-writes.js";
import {
  changeHistorySection,
  emptyLlmPlaceholderSection,
  impactHintSection,
  listOrPlaceholderHtml,
  relatedDomainsSection,
  unique,
} from "./shared.js";

export function buildTriggerViewModel(
  trg: ApexTrigger,
  graph: KnowledgeGraph,
  gitCwd?: string,
  coverage?: CoverageEntry,
  preservedBlocks?: Map<string, string>,
): ComponentViewModel {
  const sections: SectionViewModel[] = [
    {
      id: "one-line-summary",
      title: "一行サマリ",
      htmlContent: `<p>${escapeMaybeMd(summaryForApexTrigger(trg, graph))}</p>`,
    },
    emptyLlmPlaceholderSection(
      "business-meaning",
      "業務的意味づけ",
      "このトリガが業務的にどんなイベントを処理しているかを 2〜3 文で記述してください。",
      "business-meaning",
      preservedBlocks?.get("business-meaning"),
    ),
    dependenciesSection(trg),
    dataModelTouchpointsSection(trg),
    internalFlowSection(trg),
    buildProcessingDetailSection({
      methodSummaryTable: buildMethodSummaryTable(trg),
      body: trg.body,
      preservedNarrative: preservedBlocks?.get("processing-detail-narrative"),
    }),
    buildFieldWritesSection({
      componentName: trg.fullyQualifiedName,
      body: trg.body,
      triggerObject: trg.object,
      knownObjects: new Set(graph.objects.map((o) => o.fullyQualifiedName)),
      getPreserved: (id) => preservedBlocks?.get(id),
    }),
    testCoverageSection(trg, graph, coverage),
    changeHistorySection(trg.sourcePath, gitCwd),
    impactHintSection(`ApexTrigger:${trg.fullyQualifiedName}`),
    concernsSection(trg, graph, preservedBlocks?.get("concerns")),
    relatedDomainsSection("apexTrigger", trg.fullyQualifiedName, graph),
  ];

  return { type: "trigger", name: trg.fullyQualifiedName, sections };
}

function dependenciesSection(trg: ApexTrigger): SectionViewModel {
  const outgoing = unique((trg.body?.classReferences ?? []).map((r) => r.className));
  return {
    id: "dependencies",
    title: "依存関係",
    htmlContent: `
    <h3>呼び出し先ハンドラ (${outgoing.length})</h3>
    ${listOrPlaceholderHtml(outgoing, "（ハンドラへの委譲は検出されませんでした）")}
    <p class="muted">対象オブジェクト: <code>${escapeHtml(trg.object)}</code></p>
    <p class="muted">イベント: <code>${escapeHtml(trg.events.join(" / "))}</code></p>`,
  };
}

function dataModelTouchpointsSection(trg: ApexTrigger): SectionViewModel {
  const body = trg.body;
  const soqlObjects = unique(
    (body?.soqlQueries ?? []).map((q) => q.primaryObject).filter((o): o is string => o !== null),
  );
  const dmlTargets = unique((body?.dmlOperations ?? []).map((d) => d.target));
  return {
    id: "data-model-touchpoints",
    title: "データモデル接点",
    htmlContent: `
    <div class="grid two-col">
      <div>
        <h3>SOQL 対象 (${soqlObjects.length})</h3>
        ${listOrPlaceholderHtml(soqlObjects, "（SOQL は検出されませんでした）")}
      </div>
      <div>
        <h3>DML 対象 (${dmlTargets.length})</h3>
        ${listOrPlaceholderHtml(dmlTargets, "（DML は検出されませんでした）")}
      </div>
    </div>`,
  };
}

function internalFlowSection(trg: ApexTrigger): SectionViewModel {
  const flows = trg.body?.controlFlows ?? [];
  if (flows.length === 0) {
    return {
      id: "internal-flow",
      title: "内部処理フロー",
      htmlContent: `<p class="muted">制御フロー情報がありません (トリガ本体がハンドラへの委譲のみ等)。</p>`,
    };
  }
  return {
    id: "internal-flow",
    title: "内部処理フロー",
    htmlContent: `
    <p class="muted">${flows.length} メソッドの制御フローを検出。各メソッドのヘッダをクリックで展開し、Mermaid 図 / ツリーを切替表示できます。</p>
    ${renderMethodFlowcharts(flows)}`,
  };
}

function testCoverageSection(
  trg: ApexTrigger,
  graph: KnowledgeGraph,
  coverage?: CoverageEntry,
): SectionViewModel {
  const referencingTests = graph.apexClasses
    .filter((c) => c.isTest)
    .filter((c) =>
      (c.body?.classReferences ?? []).some((r) => r.className === trg.fullyQualifiedName),
    )
    .map((c) => c.fullyQualifiedName);
  const coverageBlock = coverage !== undefined ? renderCoverageBlock(coverage) : "";
  return {
    id: "test-coverage",
    title: "テスト被覆",
    htmlContent:
      referencingTests.length === 0
        ? `${coverageBlock}<p class="warning">対応するテストクラスが見つかりません。</p>`
        : `${coverageBlock}<h3>関連テストクラス</h3>${listOrPlaceholderHtml(referencingTests, "")}`,
  };
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

function concernsSection(
  trg: ApexTrigger,
  graph: KnowledgeGraph,
  preserved?: string,
): SectionViewModel {
  if (preserved !== undefined && preserved.trim() !== "") {
    return {
      id: "concerns",
      title: "既知の懸念",
      editableBlockId: "concerns",
      htmlContent: `\n        ${preserved}\n        `,
    };
  }
  const items = concernsForTrigger(trg, graph);
  return {
    id: "concerns",
    title: "既知の懸念",
    editableBlockId: "concerns",
    htmlContent:
      items.length === 0
        ? `<p class="muted">既知の懸念は検出されませんでした。</p>`
        : `
    <ul class="concerns">
      ${items
        .map(
          (c) =>
            `<li class="severity-${escapeHtml(c.severity)}"><span class="severity-badge">${escapeHtml(c.severity)}</span> <strong>${escapeHtml(c.title)}</strong>${c.detail !== undefined ? ` — ${escapeHtml(c.detail)}` : ""}</li>`,
        )
        .join("\n      ")}
    </ul>`,
  };
}

function escapeMaybeMd(md: string): string {
  return escapeHtml(md)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
