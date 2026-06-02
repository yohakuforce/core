// ----------------------------------------------------------------------------
// 表示名ヘルパ (日本語ラベル主 / API名副)
//
// Salesforce メタデータには日本語ラベル (SObject.label / Flow.label(=masterLabel)
// / LWC.masterLabel) が存在する。生成 HTML ではこれを「主」表示にし、API 名
// (fullyQualifiedName) を「副」表示 (小さいグレーの mono) として併記する。
//
// - Apex / Trigger は Salesforce 仕様上ラベルが無いため、常に API 名のみ。
// - ラベルが空 / API 名と同一の場合も副表記は出さない (重複回避)。
// - href / ファイル名生成には一切関与しない (API 名のまま使うこと)。
// ----------------------------------------------------------------------------

import type { KnowledgeGraph } from "../types/graph.js";
import { escapeHtml } from "./escape.js";
import type { ComponentType } from "./sections.js";

/** (type, apiName) からラベルを引く。無ければ undefined。 */
export type LabelResolver = (type: ComponentType, apiName: string) => string | undefined;

/**
 * 項目 (Field) のラベルを引く。fieldRef は以下の形式を許容する:
 *  - `Object__c.Field__c` (オブジェクト接頭辞つき完全名)
 *  - `Field__c` (短縮。objectContext を渡すと補完する)
 *  - `Record.Field__c` (FlexiPage 慣習。`Record.` は除去して扱う)
 * ラベルが無い / 解決できない場合は undefined。
 */
export type FieldLabelResolver = (fieldRef: string, objectContext?: string) => string | undefined;

/**
 * ラベルが「副表記する価値のある日本語」かを判定して正規化する。
 * 空文字・未定義・API 名と同一なら undefined を返す。
 */
export function labelIfDistinct(label: string | undefined, apiName: string): string | undefined {
  if (label === undefined) return undefined;
  const trimmed = label.trim();
  if (trimmed === "" || trimmed === apiName) return undefined;
  return trimmed;
}

/**
 * graph から object / flow / lwc のラベルマップを 1 度だけ構築し、
 * 相互参照リストの大量呼び出しでも O(1) で引ける resolver を返す。
 */
export function makeLabelResolver(graph: KnowledgeGraph): LabelResolver {
  const objectLabels = collect(graph.objects, (o) => o.label);
  const flowLabels = collect(graph.flows, (f) => f.label);
  const lwcLabels = collect(graph.lwcs, (l) => l.masterLabel);

  return (type, apiName) => {
    if (type === "object") return objectLabels.get(apiName);
    if (type === "flow") return flowLabels.get(apiName);
    if (type === "lwc") return lwcLabels.get(apiName);
    return undefined; // apex / trigger はラベルを持たない
  };
}

/**
 * graph.fields から項目ラベルマップを 1 度だけ構築する resolver を返す。
 * ラベルは「項目の短縮 API 名と異なる」場合のみ採用 (重複・無意味表記を回避)。
 */
export function makeFieldLabelResolver(graph: KnowledgeGraph): FieldLabelResolver {
  const map = new Map<string, string>();
  for (const f of graph.fields ?? []) {
    const short = shortFieldName(f.fullyQualifiedName);
    const label = labelIfDistinct(f.label, short);
    if (label !== undefined) map.set(f.fullyQualifiedName, label);
  }
  return (fieldRef, objectContext) => {
    const ref = fieldRef.replace(/^Record\./i, "");
    if (ref.includes(".")) {
      const hit = map.get(ref);
      if (hit !== undefined) return hit;
    }
    if (objectContext !== undefined) {
      const hit = map.get(`${objectContext}.${shortFieldName(ref)}`);
      if (hit !== undefined) return hit;
    }
    return undefined;
  };
}

function shortFieldName(fqn: string): string {
  const idx = fqn.lastIndexOf(".");
  return idx === -1 ? fqn : fqn.slice(idx + 1);
}

function collect<T extends { readonly fullyQualifiedName: string }>(
  items: readonly T[],
  getLabel: (item: T) => string | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items ?? []) {
    const label = labelIfDistinct(getLabel(item), item.fullyQualifiedName);
    if (label !== undefined) map.set(item.fullyQualifiedName, label);
  }
  return map;
}

/**
 * 見出し / カード用の「主＋副」HTML 片 (副 = API 名を block の小さいグレー mono)。
 * label が無ければ API 名のみ。返り値はエスケープ済み。
 */
export function renderNameStacked(label: string | undefined, apiName: string): string {
  if (label === undefined) return escapeHtml(apiName);
  return `<span class="name-stacked">${escapeHtml(label)}<code class="api-name">${escapeHtml(apiName)}</code></span>`;
}

/**
 * サイドバー / 検索結果など 1 行に収める用途の「主＋副」HTML 片
 * (副 = API 名を inline の小さいグレー mono)。label が無ければ API 名のみ。
 */
export function renderNameInline(label: string | undefined, apiName: string): string {
  if (label === undefined) return escapeHtml(apiName);
  return `${escapeHtml(label)}<span class="api-name-inline">${escapeHtml(apiName)}</span>`;
}

/**
 * 相互参照リスト 1 件のインライン表記: 「ラベル <code>API名</code>」または
 * 「<code>API名</code>」。label が無い (apex/trigger 等) 場合は API 名のみ。
 */
export function renderRefInline(label: string | undefined, apiName: string): string {
  if (label === undefined) return `<code>${escapeHtml(apiName)}</code>`;
  return `${escapeHtml(label)} <code>${escapeHtml(apiName)}</code>`;
}

/**
 * オブジェクト API 名の配列を「ラベル <code>API名</code>」のリストで描画する。
 * listOrPlaceholderHtml のオブジェクト版 (ラベル併記)。
 */
export function objectRefListHtml(
  apiNames: readonly string[],
  resolver: LabelResolver,
  emptyText: string,
): string {
  if (apiNames.length === 0) {
    return emptyText === "" ? "" : `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul>${apiNames
    .map((n) => `<li>${renderRefInline(resolver("object", n), n)}</li>`)
    .join("")}</ul>`;
}

/**
 * Apex / Trigger のサブタイトル用。決定的サマリ (summaryForApex 等) の先頭 1 文を
 * 取り出し、markdown 記号 (** / `) を除いたプレーンな日本語にする。
 */
export function firstSentencePlain(summary: string): string {
  const head = summary.split("。")[0] ?? "";
  return head.replace(/\*\*/g, "").replace(/`/g, "").trim();
}
