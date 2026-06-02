// ----------------------------------------------------------------------------
// Object (SObject) ComponentViewModel builder
// ----------------------------------------------------------------------------

import type { Field, KnowledgeGraph, SObject } from "../../types/graph.js";
import {
  type LabelResolver,
  labelIfDistinct,
  makeLabelResolver,
  renderRefInline,
} from "../display.js";
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
  const resolveLabel = makeLabelResolver(graph);
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
    dependenciesSection(obj, graph, resolveLabel),
    publicInterfaceSection(obj, fields, resolveLabel),
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

  return {
    type: "object",
    name: obj.fullyQualifiedName,
    label: labelIfDistinct(obj.label, obj.fullyQualifiedName),
    sections,
  };
}

function renderSummary(obj: SObject, fields: readonly Field[]): string {
  const custom = obj.isCustom ? "カスタムオブジェクト" : "標準オブジェクト";
  const sharing = obj.sharingModel ?? "未定義";
  return `<p><strong>${escapeHtml(obj.label)}</strong> (<code>${escapeHtml(obj.fullyQualifiedName)}</code>) — ${escapeHtml(custom)} / 共有: ${escapeHtml(sharing)} / 項目数: ${fields.length}</p>`;
}

function dependenciesSection(
  obj: SObject,
  graph: KnowledgeGraph,
  resolveLabel: LabelResolver,
): SectionViewModel {
  const name = obj.fullyQualifiedName;
  // 参照元: Apex / Trigger はラベル無し (API名のみ)、Flow はラベル併記。
  const apexUsers = graph.apexClasses
    .filter(
      (c) =>
        (c.body?.soqlQueries ?? []).some((q) => q.primaryObject === name) ||
        (c.body?.dmlOperations ?? []).some((d) => d.target === name),
    )
    .map((c) => `Apex: ${renderRefInline(undefined, c.fullyQualifiedName)}`);
  const triggerUsers = graph.apexTriggers
    .filter((t) => t.object === name)
    .map((t) => `Trigger: ${renderRefInline(undefined, t.fullyQualifiedName)}`);
  const flowUsers = graph.flows
    .filter((f) => f.triggeringObject === name || (f.body?.recordObjects ?? []).includes(name))
    .map(
      (f) =>
        `Flow: ${renderRefInline(resolveLabel("flow", f.fullyQualifiedName), f.fullyQualifiedName)}`,
    );
  const users = unique([...apexUsers, ...triggerUsers, ...flowUsers]);

  const list =
    users.length === 0
      ? `<p class="muted">（このオブジェクトを参照する処理は検出されませんでした）</p>`
      : `<ul>${users.map((u) => `<li>${u}</li>`).join("")}</ul>`;
  return {
    id: "dependencies",
    title: "依存関係",
    htmlContent: `
    <h3>このオブジェクトを参照する処理 (${users.length})</h3>
    ${list}`,
  };
}

function publicInterfaceSection(
  obj: SObject,
  fields: readonly Field[],
  resolveLabel: LabelResolver,
): SectionViewModel {
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
      <thead><tr><th>ラベル</th><th>API 名</th><th>型</th><th>必須</th><th>参照</th></tr></thead>
      <tbody>
        ${fields.map((f) => fieldRow(f, resolveLabel)).join("\n        ")}
      </tbody>
    </table>`,
  };
}

function fieldRow(f: Field, resolveLabel: LabelResolver): string {
  // 参照先は別オブジェクト → ラベル併記。
  const refs =
    f.referenceTo !== undefined && f.referenceTo.length > 0
      ? f.referenceTo.map((r) => renderRefInline(resolveLabel("object", r), r)).join(", ")
      : "—";
  const fieldLabel = labelIfDistinct(f.label, f.fullyQualifiedName);
  return `<tr>
    <td>${fieldLabel !== undefined ? escapeHtml(fieldLabel) : '<span class="muted">—</span>'}</td>
    <td><code>${escapeHtml(f.fullyQualifiedName)}</code></td>
    <td><code>${escapeHtml(f.type)}</code></td>
    <td>${f.required === true ? "✓" : ""}</td>
    <td>${refs}</td>
  </tr>`;
}
