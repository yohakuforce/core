// ----------------------------------------------------------------------------
// Object (SObject) ComponentViewModel builder
// ----------------------------------------------------------------------------

import type { Field, KnowledgeGraph, SObject } from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import type { ComponentViewModel, SectionViewModel } from "../types.js";
import { buildCalculationRulesSection, buildFieldAssignmentSection } from "./object-detail.js";
import {
  buildAccessSection,
  buildApprovalSection,
  buildLayoutsSection,
  buildRecordTypesSection,
  buildSharingSection,
} from "./object-related.js";
import {
  changeHistorySection,
  emptyLlmPlaceholderSection,
  impactHintSection,
  listOrPlaceholderHtml,
  relatedDomainsSection,
  unique,
} from "./shared.js";

export function buildObjectViewModel(
  obj: SObject,
  graph: KnowledgeGraph,
  gitCwd?: string,
  preservedBlocks?: Map<string, string>,
): ComponentViewModel {
  const fields = graph.fields.filter((f) => f.object === obj.fullyQualifiedName);
  const sections: SectionViewModel[] = [
    {
      id: "one-line-summary",
      title: "一行サマリ",
      htmlContent: renderSummary(obj, fields),
    },
    emptyLlmPlaceholderSection(
      "business-meaning",
      "業務的意味づけ",
      "この SObject が業務上どんな概念を表すかを 2〜3 文で記述してください。",
      "business-meaning",
      preservedBlocks?.get("business-meaning"),
    ),
    dependenciesSection(obj, graph),
    publicInterfaceSection(obj, fields),
    buildFieldAssignmentSection(obj, fields, graph, (id) => preservedBlocks?.get(id)),
    buildCalculationRulesSection(obj, fields, graph, (id) => preservedBlocks?.get(id)),
    buildRecordTypesSection(obj, graph),
    buildLayoutsSection(obj, graph),
    buildApprovalSection(obj, graph),
    buildSharingSection(obj, graph),
    buildAccessSection(obj, graph),
    changeHistorySection(obj.sourcePath, gitCwd),
    impactHintSection(`SObject:${obj.fullyQualifiedName}`),
    relatedDomainsSection("object", obj.fullyQualifiedName, graph),
  ];

  return { type: "object", name: obj.fullyQualifiedName, sections };
}

function renderSummary(obj: SObject, fields: readonly Field[]): string {
  const custom = obj.isCustom ? "カスタムオブジェクト" : "標準オブジェクト";
  const sharing = obj.sharingModel ?? "未定義";
  return `<p><strong>${escapeHtml(obj.label)}</strong> (<code>${escapeHtml(obj.fullyQualifiedName)}</code>) — ${escapeHtml(custom)} / 共有: ${escapeHtml(sharing)} / 項目数: ${fields.length}</p>`;
}

function dependenciesSection(obj: SObject, graph: KnowledgeGraph): SectionViewModel {
  const name = obj.fullyQualifiedName;
  const apexUsers = graph.apexClasses
    .filter(
      (c) =>
        (c.body?.soqlQueries ?? []).some((q) => q.primaryObject === name) ||
        (c.body?.dmlOperations ?? []).some((d) => d.target === name),
    )
    .map((c) => `Apex: ${c.fullyQualifiedName}`);
  const triggerUsers = graph.apexTriggers
    .filter((t) => t.object === name)
    .map((t) => `Trigger: ${t.fullyQualifiedName}`);
  const flowUsers = graph.flows
    .filter((f) => f.triggeringObject === name || (f.body?.recordObjects ?? []).includes(name))
    .map((f) => `Flow: ${f.fullyQualifiedName}`);
  const users = unique([...apexUsers, ...triggerUsers, ...flowUsers]);

  return {
    id: "dependencies",
    title: "依存関係",
    htmlContent: `
    <h3>このオブジェクトを参照する処理 (${users.length})</h3>
    ${listOrPlaceholderHtml(users, "（このオブジェクトを参照する処理は検出されませんでした）")}`,
  };
}

function publicInterfaceSection(obj: SObject, fields: readonly Field[]): SectionViewModel {
  if (fields.length === 0) {
    return {
      id: "public-interface",
      title: "公開インターフェース",
      htmlContent: `<p class="muted">項目は検出されませんでした。</p>`,
    };
  }
  return {
    id: "public-interface",
    title: "公開インターフェース",
    htmlContent: `
    <p class="muted">${escapeHtml(obj.label)} (${escapeHtml(obj.fullyQualifiedName)}) の項目 (${fields.length})</p>
    <table class="data-table">
      <thead><tr><th>API 名</th><th>ラベル</th><th>型</th><th>必須</th><th>参照</th></tr></thead>
      <tbody>
        ${fields.map(fieldRow).join("\n        ")}
      </tbody>
    </table>`,
  };
}

function fieldRow(f: Field): string {
  const refs =
    f.referenceTo !== undefined && f.referenceTo.length > 0
      ? f.referenceTo.map((r) => `<code>${escapeHtml(r)}</code>`).join(", ")
      : "—";
  return `<tr>
    <td><code>${escapeHtml(f.fullyQualifiedName)}</code></td>
    <td>${escapeHtml(f.label ?? "—")}</td>
    <td><code>${escapeHtml(f.type)}</code></td>
    <td>${f.required === true ? "✓" : ""}</td>
    <td>${refs}</td>
  </tr>`;
}
