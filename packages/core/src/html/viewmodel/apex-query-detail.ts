// ----------------------------------------------------------------------------
// SOQL 詳細 (詳細設計: query-detail)
//
// 「どのオブジェクトを / どの項目を / どの条件で」取得するかを、1 クエリ = 1 つの
// 縦表で表す。1 行に詰め込むと WHERE が折り返して読みにくいため、項目は 1 項目
// 1 行、条件は AND/OR ごとに 1 行に分けて表示する。
//
// 項目・オブジェクト・条件の項目は「日本語ラベル + API 名」で併記し、非エンジニア
// にも読め、かつ API 名併記で曖昧さを残さない。決定的スケルトンを ai_managed
// ブロックの土台に置き、LLM が条件の意味補足等で上書きできる。
// ----------------------------------------------------------------------------

import type { ApexSoqlInfo } from "../../types/graph.js";
import type { FieldLabelResolver } from "../display.js";
import { renderRefInline } from "../display.js";
import { escapeHtml } from "../escape.js";
import { aiManagedBlock } from "./ai-block.js";
import { leadingFieldToken, splitOrderByKeys, splitWhereConditions } from "./detail-format.js";

type ResolveObjectLabel = (api: string) => string | undefined;
type GetPreserved = (id: string) => string | undefined;

export function renderQueryDetailBlock(
  soqlQueries: readonly ApexSoqlInfo[],
  resolveObjectLabel: ResolveObjectLabel,
  resolveFieldLabel: FieldLabelResolver,
  getPreserved: GetPreserved,
): string {
  if (soqlQueries.length === 0) return "";
  const id = "query-detail";
  const cards = soqlQueries
    .map((q, i) => queryCard(q, i, resolveObjectLabel, resolveFieldLabel))
    .join("\n      ");
  return `
    <h3>SOQL 詳細 (${soqlQueries.length})</h3>
    ${aiManagedBlock({
      id,
      preserved: getPreserved(id),
      heading: "SOQL 詳細",
      prompt:
        "各 SOQL について「どのオブジェクトを / どの項目を / どの条件で」取得するかを、1 クエリ 1 表で記述してください。項目は日本語ラベルを主に (API 名を併記)。下の決定的スケルトンは機械抽出の初期値です。条件の業務的な意味補足や、動的 SOQL (文字列結合) の取りこぼしを追記・修正してください。",
      skeleton: `<div class="query-cards">${cards}</div>`,
    })}`;
}

function queryCard(
  q: ApexSoqlInfo,
  index: number,
  resolveObjectLabel: ResolveObjectLabel,
  resolveFieldLabel: FieldLabelResolver,
): string {
  const objectApi = q.primaryObject ?? undefined;
  const objectCell =
    objectApi !== undefined ? renderRefInline(resolveObjectLabel(objectApi), objectApi) : "—";

  const fieldsCell =
    q.fields !== undefined && q.fields.length > 0
      ? `<ul class="detail-list">${q.fields
          .map((f) => `<li>${fieldHtml(f, objectApi, resolveFieldLabel)}</li>`)
          .join("")}</ul>`
      : '<span class="muted">—</span>';

  const whereCell =
    q.whereClause !== undefined && q.whereClause !== ""
      ? `<ul class="detail-list">${splitWhereConditions(q.whereClause)
          .map(
            (c) =>
              `<li>${c.connector !== undefined ? `<span class="cond-op">${escapeHtml(c.connector)}</span> ` : ""}${conditionHtml(c.text, objectApi, resolveFieldLabel)}</li>`,
          )
          .join("")}</ul>`
      : '<span class="muted">全件取得（絞り込みなし）</span>';

  const rows = [
    row("オブジェクト", objectCell),
    row("取得項目", fieldsCell),
    row("絞り込み条件", whereCell),
  ];
  if (q.orderByClause !== undefined && q.orderByClause !== "") {
    rows.push(row("並び順", orderByHtml(q.orderByClause, objectApi, resolveFieldLabel)));
  }
  if (q.limitClause !== undefined && q.limitClause !== "") {
    rows.push(row("件数", `<code>${escapeHtml(q.limitClause)}</code>`));
  }

  return `<section class="query-card">
        <h4>クエリ ${index + 1}</h4>
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

/** 取得項目 1 件。単純な項目はラベル解決、関数/サブクエリ等は原文を code 表示。 */
function fieldHtml(
  fieldExpr: string,
  objectApi: string | undefined,
  resolveFieldLabel: FieldLabelResolver,
): string {
  if (/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/.test(fieldExpr)) {
    return renderRefInline(resolveFieldLabel(fieldExpr, objectApi), fieldExpr);
  }
  return `<code>${escapeHtml(fieldExpr)}</code>`;
}

/** 条件式の先頭項目をラベル化し、残り (演算子・値) は原文のまま続ける。 */
function conditionHtml(
  text: string,
  objectApi: string | undefined,
  resolveFieldLabel: FieldLabelResolver,
): string {
  const lead = leadingFieldToken(text);
  if (lead !== undefined) {
    const rest = text.slice(lead.length);
    return `${renderRefInline(resolveFieldLabel(lead, objectApi), lead)}${escapeHtml(rest)}`;
  }
  return `<code>${escapeHtml(text)}</code>`;
}

function orderByHtml(
  orderBy: string,
  objectApi: string | undefined,
  resolveFieldLabel: FieldLabelResolver,
): string {
  return `<ul class="detail-list">${splitOrderByKeys(orderBy)
    .map((k) => `<li>${conditionHtml(k, objectApi, resolveFieldLabel)}</li>`)
    .join("")}</ul>`;
}
