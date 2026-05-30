// ----------------------------------------------------------------------------
// Flow ComponentViewModel builder
// ----------------------------------------------------------------------------

import { concernsForFlow } from "../../render/concerns.js";
import { summaryForFlow } from "../../render/summary.js";
import type { Flow, KnowledgeGraph } from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import type { ComponentViewModel, SectionViewModel } from "../types.js";
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
    dataModelTouchpointsSection(flow),
    internalFlowSection(flow),
    ioContractSection(flow),
    changeHistorySection(flow.sourcePath, gitCwd),
    impactHintSection(`Flow:${flow.fullyQualifiedName}`),
    concernsSection(flow, preservedBlocks?.get("concerns")),
    relatedDomainsSection("flow", flow.fullyQualifiedName, graph),
  ];

  return { type: "flow", name: flow.fullyQualifiedName, sections };
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

function dataModelTouchpointsSection(flow: Flow): SectionViewModel {
  const records = unique(flow.body?.recordObjects ?? []);
  return {
    id: "data-model-touchpoints",
    title: "データモデル接点",
    htmlContent: `
    <h3>参照/更新オブジェクト (${records.length})</h3>
    ${listOrPlaceholderHtml(records, "（レコード操作は検出されませんでした）")}`,
  };
}

function internalFlowSection(flow: Flow): SectionViewModel {
  const elements = flow.body?.elements ?? [];
  if (elements.length === 0) {
    return {
      id: "internal-flow",
      title: "内部処理フロー",
      htmlContent: `<p class="muted">要素は検出されませんでした。</p>`,
    };
  }
  return {
    id: "internal-flow",
    title: "内部処理フロー",
    htmlContent: `
    <p class="muted">${elements.length} 要素を検出 (Mermaid 描画は未実装、現状はテーブル表示)。</p>
    <table class="data-table">
      <thead><tr><th>name</th><th>kind</th><th>label</th></tr></thead>
      <tbody>
        ${elements
          .map(
            (e) => `<tr>
          <td><code>${escapeHtml(e.name)}</code></td>
          <td>${escapeHtml(e.kind)}</td>
          <td>${escapeHtml(e.label ?? "—")}</td>
        </tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>`,
  };
}

function ioContractSection(flow: Flow): SectionViewModel {
  const trigger = flow.triggeringObject ?? "n/a";
  const actions = unique(flow.body?.actionCalls ?? []);
  return {
    id: "io-contract",
    title: "入出力契約",
    htmlContent: `
    <h3>起点</h3>
    <p>type: <code>${escapeHtml(flow.type)}</code> / triggeringObject: <code>${escapeHtml(trigger)}</code></p>
    <h3>外部アクション</h3>
    ${listOrPlaceholderHtml(actions, "（外部アクションなし）")}`,
  };
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
