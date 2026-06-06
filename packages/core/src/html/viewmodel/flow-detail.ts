// ----------------------------------------------------------------------------
// Flow レコード操作の詳細 (詳細設計: query-detail / field-writes)
//
// Apex の SOQL 詳細と対称に、Flow の record 要素から「どのオブジェクトを /
// どの項目を / どの条件で 取得するか」と「どの項目に どの値を 割り当てるか」を
// 1 要素 = 1 表の縦レイアウトで表す。項目・オブジェクトは「日本語ラベル + API 名」
// で併記し、操作は日本語で表示する。決定的スケルトンを ai_managed の土台に置く。
// ----------------------------------------------------------------------------

import type { FlowElementInfo } from "../../types/graph.js";
import type { FieldLabelResolver } from "../display.js";
import { renderRefInline } from "../display.js";
import { escapeHtml } from "../escape.js";
import { aiManagedBlock } from "./ai-block.js";

const RECORD_OP_LABEL: Record<string, string> = {
  recordLookup: "取得",
  recordCreate: "作成",
  recordUpdate: "更新",
  recordDelete: "削除",
};

const SORT_ORDER_JA: Record<string, string> = { Asc: "昇順", Desc: "降順" };

type ResolveObjectLabel = (api: string) => string | undefined;
type GetPreserved = (id: string) => string | undefined;

/** 取得・絞り込み詳細 (recordLookup / filters 付き update・delete)。 */
export function renderFlowRecordDetailBlock(
  elements: readonly FlowElementInfo[],
  resolveObjectLabel: ResolveObjectLabel,
  resolveFieldLabel: FieldLabelResolver,
  getPreserved: GetPreserved,
): string {
  const rows = elements.filter(
    (e) =>
      (e.queriedFields?.length ?? 0) > 0 ||
      (e.filters?.length ?? 0) > 0 ||
      e.sortField !== undefined ||
      e.getFirstRecordOnly !== undefined,
  );
  if (rows.length === 0) return "";
  const id = "flow-query-detail";
  const cards = rows
    .map((e) => recordDetailCard(e, resolveObjectLabel, resolveFieldLabel))
    .join("\n      ");
  return `
    <h3>レコード取得・絞り込み 詳細 (${rows.length})</h3>
    ${aiManagedBlock({
      id,
      preserved: getPreserved(id),
      heading: "レコード取得・絞り込み 詳細",
      prompt:
        "各レコード取得/絞り込みについて「どのオブジェクトを / どの項目を / どの条件で」を 1 要素 1 表で記述してください。項目は日本語ラベルを主に (API 名を併記)。下の決定的スケルトンは Flow 定義からの機械抽出です。条件の業務的な意味補足や取りこぼし修正を追記してください。",
      skeleton: `<div class="query-cards">${cards}</div>`,
    })}`;
}

/** 項目値の割り当て (recordCreate / recordUpdate の inputAssignments・inputReference)。 */
export function renderFlowFieldAssignmentBlock(
  elements: readonly FlowElementInfo[],
  resolveObjectLabel: ResolveObjectLabel,
  resolveFieldLabel: FieldLabelResolver,
  getPreserved: GetPreserved,
): string {
  const writers = elements.filter(
    (e) => (e.inputAssignments?.length ?? 0) > 0 || e.inputReference !== undefined,
  );
  if (writers.length === 0) return "";
  const id = "flow-field-writes";
  // Apex の「項目値の割り当て」と同じ表形式 (項目/設定値/操作/設定箇所) に統一し、
  // オブジェクト単位でまとめる。
  const byObject = new Map<string, FlowElementInfo[]>();
  for (const e of writers) {
    const key = e.target ?? "";
    const list = byObject.get(key) ?? [];
    byObject.set(key, [...list, e]);
  }
  const panels = [...byObject.entries()]
    .map(([obj, els]) => assignmentPanel(obj, els, resolveObjectLabel, resolveFieldLabel))
    .join("\n      ");
  return `
    <h3>項目値の割り当て (${writers.length})</h3>
    ${aiManagedBlock({
      id,
      preserved: getPreserved(id),
      heading: "項目値の割り当て",
      prompt:
        "各レコード作成/更新について「このオブジェクトのこの項目にこの値を」を、項目 / 設定値 / 操作 / 設定箇所 の表で記述してください。項目は日本語ラベルを主に (API 名を併記)。下の決定的スケルトンは Flow 定義からの機械抽出です。設定条件 (どの分岐で設定されるか) の補足や取りこぼし修正を追記してください。",
      skeleton: panels,
    })}`;
}

/** Apex の per-object パネルと同じ「見出し(オブジェクト) + 項目割り当て表」。 */
function assignmentPanel(
  object: string,
  elements: readonly FlowElementInfo[],
  resolveObjectLabel: ResolveObjectLabel,
  resolveFieldLabel: FieldLabelResolver,
): string {
  const heading =
    object !== "" ? renderRefInline(resolveObjectLabel(object), object) : "（オブジェクト不明）";
  const rows = elements
    .flatMap((e) => assignmentRows(e, object, resolveFieldLabel))
    .join("\n        ");
  return `<section class="obj-tabpanel">
        <h4>${heading} への項目設定</h4>
        <table class="data-table fieldwrite-skeleton">
          <thead><tr><th>項目</th><th>設定値</th><th>操作</th><th>設定箇所 (要素)</th></tr></thead>
          <tbody>
        ${rows}
          </tbody>
        </table>
      </section>`;
}

function assignmentRows(
  e: FlowElementInfo,
  object: string,
  resolveFieldLabel: FieldLabelResolver,
): string[] {
  const op = RECORD_OP_LABEL[e.kind] ?? e.kind;
  const loc = `<code>${escapeHtml(e.name)}</code>`;
  if (e.inputAssignments !== undefined && e.inputAssignments.length > 0) {
    return e.inputAssignments.map(
      (a) => `<tr>
          <td>${renderRefInline(resolveFieldLabel(a.field, object), a.field)}</td>
          <td>${a.value !== "" ? `<code>${escapeHtml(a.value)}</code>` : "—"}</td>
          <td>${escapeHtml(op)}</td>
          <td>${loc}</td>
        </tr>`,
    );
  }
  return [
    `<tr>
          <td colspan="2" class="muted">レコード変数 <code>${escapeHtml(e.inputReference ?? "")}</code> を直接設定 (項目は変数側で決定)</td>
          <td>${escapeHtml(op)}</td>
          <td>${loc}</td>
        </tr>`,
  ];
}

function recordDetailCard(
  e: FlowElementInfo,
  resolveObjectLabel: ResolveObjectLabel,
  resolveFieldLabel: FieldLabelResolver,
): string {
  const obj = e.target;
  const fieldsCell =
    e.queriedFields !== undefined && e.queriedFields.length > 0
      ? listHtml(e.queriedFields.map((f) => renderRefInline(resolveFieldLabel(f, obj), f)))
      : '<span class="muted">—</span>';

  const filtersCell =
    e.filters !== undefined && e.filters.length > 0
      ? listHtml(
          e.filters.map(
            (f) =>
              `${renderRefInline(resolveFieldLabel(f.field, obj), f.field)} ${escapeHtml(f.operator)}${f.value !== "" ? ` <code>${escapeHtml(f.value)}</code>` : ""}`,
          ),
        ) + filterLogicNote(e.filterLogic)
      : '<span class="muted">絞り込みなし</span>';

  const rows = [
    row("オブジェクト", obj !== undefined ? renderRefInline(resolveObjectLabel(obj), obj) : "—"),
    row("取得項目", fieldsCell),
    row("絞り込み条件", filtersCell),
  ];
  if (e.sortField !== undefined) {
    const order = e.sortOrder !== undefined ? ` ${SORT_ORDER_JA[e.sortOrder] ?? e.sortOrder}` : "";
    rows.push(row("並び順", `${renderRefInline(resolveFieldLabel(e.sortField, obj), e.sortField)}${order}`));
  }
  if (e.getFirstRecordOnly !== undefined) {
    rows.push(row("件数", e.getFirstRecordOnly ? "先頭1件" : "全件"));
  }
  return card(e, rows);
}

function card(e: FlowElementInfo, rows: readonly string[]): string {
  const op = RECORD_OP_LABEL[e.kind] ?? e.kind;
  return `<section class="query-card">
        <h4>${escapeHtml(e.label ?? e.name)} <span class="muted">(${escapeHtml(op)} / <code>${escapeHtml(e.name)}</code>)</span></h4>
        <table class="data-table detail-kv">
          <tbody>
            ${rows.join("\n            ")}
          </tbody>
        </table>
      </section>`;
}

function row(label: string, valueHtml: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${valueHtml}</td></tr>`;
}

function listHtml(items: readonly string[]): string {
  return `<ul class="detail-list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

function filterLogicNote(logic: string | undefined): string {
  return logic !== undefined && logic.toLowerCase() !== "and"
    ? `<p class="muted">論理: ${escapeHtml(logic)}</p>`
    : "";
}
