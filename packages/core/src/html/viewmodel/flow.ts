// ----------------------------------------------------------------------------
// Flow ComponentViewModel builder
// ----------------------------------------------------------------------------

import { concernsForFlow } from "../../render/concerns.js";
import { buildFlowFlowchart } from "../../render/flow-flowchart.js";
import { summaryForFlow } from "../../render/summary.js";
import type {
  Flow,
  FlowElementInfo,
  FlowStartTrigger,
  KnowledgeGraph,
} from "../../types/graph.js";
import {
  type FieldLabelResolver,
  type LabelResolver,
  labelIfDistinct,
  makeFieldLabelResolver,
  makeLabelResolver,
  objectRefListHtml,
  renderRefInline,
} from "../display.js";
import { escapeAttr, escapeHtml } from "../escape.js";
import type { ComponentViewModel, SectionViewModel } from "../types.js";
import {
  renderFlowFieldAssignmentBlock,
  renderFlowRecordDetailBlock,
} from "./flow-detail.js";
import {
  changeHistorySection,
  emptyLlmPlaceholderSection,
  impactHintSection,
  listOrPlaceholderHtml,
  relatedDomainsSection,
  unique,
} from "./shared.js";

export function buildFlowViewModel(
  flow: Flow,
  graph: KnowledgeGraph,
  gitCwd?: string,
  preservedBlocks?: Map<string, string>,
): ComponentViewModel {
  const resolveLabel = makeLabelResolver(graph);
  const resolveFieldLabel = makeFieldLabelResolver(graph);
  const sections: SectionViewModel[] = [
    {
      id: "one-line-summary",
      title: "一行サマリ",
      htmlContent: `<p>${escapeMaybeMd(summaryForFlow(flow))}</p>`,
    },
    emptyLlmPlaceholderSection(
      "business-meaning",
      "業務的意味づけ",
      "この Flow が業務上どんなプロセスを自動化しているかを 2〜3 文で記述してください。",
      "business-meaning",
      preservedBlocks?.get("business-meaning"),
    ),
    dependenciesSection(flow),
    dataModelTouchpointsSection(flow, resolveLabel, resolveFieldLabel, (id) =>
      preservedBlocks?.get(id),
    ),
    internalFlowSection(flow),
    ioContractSection(flow, resolveLabel, resolveFieldLabel),
    changeHistorySection(flow.sourcePath, gitCwd),
    impactHintSection(`Flow:${flow.fullyQualifiedName}`),
    concernsSection(flow, preservedBlocks?.get("concerns")),
    relatedDomainsSection("flow", flow.fullyQualifiedName, graph),
  ];

  return {
    type: "flow",
    name: flow.fullyQualifiedName,
    label: labelIfDistinct(flow.label, flow.fullyQualifiedName),
    sections,
  };
}

function dependenciesSection(flow: Flow): SectionViewModel {
  const subflows = unique(flow.body?.subflows ?? []);
  const actions = unique(flow.body?.actionCalls ?? []);
  return {
    id: "dependencies",
    title: "依存関係",
    htmlContent: `
    <div class="grid two-col">
      <div>
        <h3>サブフロー (${subflows.length})</h3>
        ${listOrPlaceholderHtml(subflows, "（サブフローなし）")}
      </div>
      <div>
        <h3>呼び出しアクション (${actions.length})</h3>
        ${listOrPlaceholderHtml(actions, "（呼び出しアクションなし）")}
      </div>
    </div>`,
  };
}

function dataModelTouchpointsSection(
  flow: Flow,
  resolveLabel: LabelResolver,
  resolveFieldLabel: FieldLabelResolver,
  getPreserved: (id: string) => string | undefined,
): SectionViewModel {
  const records = unique(flow.body?.recordObjects ?? []);
  const elements = flow.body?.elements ?? [];
  const resolveObjectLabel = (api: string): string | undefined => resolveLabel("object", api);
  const recordDetail = renderFlowRecordDetailBlock(
    elements,
    resolveObjectLabel,
    resolveFieldLabel,
    getPreserved,
  );
  const fieldAssign = renderFlowFieldAssignmentBlock(
    elements,
    resolveObjectLabel,
    resolveFieldLabel,
    getPreserved,
  );
  return {
    id: "data-model-touchpoints",
    title: "データモデル接点",
    htmlContent: `
    <h3>参照/更新オブジェクト (${records.length})</h3>
    ${objectRefListHtml(records, resolveLabel, "（レコード操作は検出されませんでした）")}${recordDetail}${fieldAssign}`,
  };
}

const FLOW_KIND_JA: Record<string, string> = {
  recordLookup: "レコード取得",
  recordCreate: "レコード作成",
  recordUpdate: "レコード更新",
  recordDelete: "レコード削除",
  decision: "分岐",
  assignment: "代入",
  loop: "ループ",
  actionCall: "アクション呼出",
  subflow: "サブフロー",
  screen: "画面",
  wait: "待機",
};

function internalFlowSection(flow: Flow): SectionViewModel {
  const body = flow.body;
  if (body === undefined || body.elements.length === 0) {
    return {
      id: "internal-flow",
      title: "内部処理フロー",
      htmlContent: `<p class="muted">要素は検出されませんでした。</p>`,
    };
  }
  const { mermaid } = buildFlowFlowchart(body);
  // method-flow の切替 JS / mermaid 描画 JS (method-flowchart.js) を再利用するため、
  // 同じ class 構造 (.method-flow / .mermaid-host / .mermaid-source) で出力する。
  return {
    id: "internal-flow",
    title: "内部処理フロー",
    htmlContent: `
    <p class="muted">${body.elements.length} 要素を検出。Salesforce Flow の要素接続をフローチャートで表示します (テーブルにも切替可)。</p>
    <div class="method-flow">
      <div class="body">
        <div class="switch-buttons" role="tablist">
          <button data-target="flow-diagram-mermaid" aria-selected="true">フローチャート</button>
          <button data-target="flow-diagram-tree" aria-selected="false">テーブル</button>
        </div>
        <div id="flow-diagram-mermaid" class="mermaid-host">
          <pre class="mermaid-source" data-mermaid="${escapeAttr(mermaid)}">${escapeHtml(mermaid)}</pre>
        </div>
        <div id="flow-diagram-tree" class="fallback-tree" style="display:none;">
          ${elementsTable(body.elements)}
        </div>
      </div>
    </div>`,
  };
}

function elementsTable(elements: readonly FlowElementInfo[]): string {
  return `<table class="data-table">
      <thead><tr><th>要素</th><th>種別</th><th>ラベル</th></tr></thead>
      <tbody>
        ${elements
          .map(
            (e) => `<tr>
          <td><code>${escapeHtml(e.name)}</code></td>
          <td>${escapeHtml(FLOW_KIND_JA[e.kind] ?? e.kind)}</td>
          <td>${escapeHtml(e.label ?? "—")}</td>
        </tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>`;
}

const RECORD_TRIGGER_TYPE_JA: Record<string, string> = {
  Create: "レコード作成時",
  Update: "レコード更新時",
  CreateAndUpdate: "レコード作成時・更新時",
  Delete: "レコード削除時",
};

function ioContractSection(
  flow: Flow,
  resolveLabel: LabelResolver,
  resolveFieldLabel: FieldLabelResolver,
): SectionViewModel {
  const trigger =
    flow.triggeringObject !== undefined
      ? renderRefInline(resolveLabel("object", flow.triggeringObject), flow.triggeringObject)
      : "<code>n/a</code>";
  const actions = unique(flow.body?.actionCalls ?? []);
  return {
    id: "io-contract",
    title: "入出力契約",
    htmlContent: `
    <h3>起点</h3>
    <p>type: <code>${escapeHtml(flow.type)}</code> / triggeringObject: ${trigger}</p>
    ${startTriggerHtml(flow.body?.startTrigger, resolveLabel, resolveFieldLabel)}
    <h3>外部アクション</h3>
    ${listOrPlaceholderHtml(actions, "（外部アクションなし）")}`,
  };
}

/** 「いつ起動するか」(起動オブジェクト / タイミング / 条件) を非エンジニア向けに表示。 */
function startTriggerHtml(
  st: FlowStartTrigger | undefined,
  resolveLabel: LabelResolver,
  resolveFieldLabel: FieldLabelResolver,
): string {
  if (st === undefined) return "";
  const rows: string[] = [];
  if (st.object !== undefined) {
    rows.push(
      `<tr><th>対象オブジェクト</th><td>${renderRefInline(resolveLabel("object", st.object), st.object)}</td></tr>`,
    );
  }
  if (st.recordTriggerType !== undefined) {
    const ja = RECORD_TRIGGER_TYPE_JA[st.recordTriggerType] ?? st.recordTriggerType;
    rows.push(`<tr><th>起動タイミング</th><td>${escapeHtml(ja)}</td></tr>`);
  }
  const condition = startConditionHtml(st, resolveFieldLabel);
  if (condition !== "") rows.push(`<tr><th>起動条件</th><td>${condition}</td></tr>`);
  if (rows.length === 0) return "";
  return `
    <h3>起動条件 (いつ動くか)</h3>
    <table class="data-table detail-kv"><tbody>${rows.join("")}</tbody></table>`;
}

function startConditionHtml(st: FlowStartTrigger, resolveFieldLabel: FieldLabelResolver): string {
  if (st.conditionFormula !== undefined && st.conditionFormula !== "") {
    return `<code>${escapeHtml(st.conditionFormula)}</code>`;
  }
  if (st.filters !== undefined && st.filters.length > 0) {
    const obj = st.object;
    return `<ul class="detail-list">${st.filters
      .map(
        (f) =>
          `<li>${renderRefInline(resolveFieldLabel(f.field, obj), f.field)} ${escapeHtml(f.operator)}${f.value !== "" ? ` <code>${escapeHtml(f.value)}</code>` : ""}</li>`,
      )
      .join("")}</ul>`;
  }
  return "";
}

function concernsSection(flow: Flow, preserved?: string): SectionViewModel {
  if (preserved !== undefined && preserved.trim() !== "") {
    return {
      id: "concerns",
      title: "既知の懸念",
      editableBlockId: "concerns",
      htmlContent: `\n        ${preserved}\n        `,
    };
  }
  const items = concernsForFlow(flow);
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
