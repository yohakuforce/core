// ----------------------------------------------------------------------------
// 制御フローノード → 自然な日本語ラベル
//
// Mermaid フローチャート / ツリー表示の双方で同一のラベルを使い、初見の人でも
// 処理の流れを理解できるようにする。決定的変換のみ (LLM 非依存)。
//
// 方針: 構造 (SOQL/DML/分岐/繰り返し/例外/戻り値) は明確な日本語に、
// 条件式・文は「意味を損なわない範囲」で軽く日本語化し、取り切れない部分は
// 原文のまま残す (誤訳より原文が安全)。原文は別途 詳細(ツリーの muted / NodeDetail)
// で常に参照できる。
// ----------------------------------------------------------------------------

import type { ApexDmlKind } from "../types/graph.js";

const DML_VERB_JA: Record<ApexDmlKind, string> = {
  insert: "登録",
  update: "更新",
  delete: "削除",
  upsert: "登録/更新",
  undelete: "復元",
  merge: "統合",
};

export function soqlLabel(primaryObject: string | null): string {
  return primaryObject !== null ? `${primaryObject} を取得` : "データを取得";
}

export function dmlLabel(verb: ApexDmlKind, target: string, viaDatabaseClass: boolean): string {
  const v = DML_VERB_JA[verb] ?? verb;
  return `${target} を${v}${viaDatabaseClass ? "（Database）" : ""}`;
}

export function returnLabel(expression: string): string {
  const e = compact(expression);
  return e === "" ? "処理を終了" : `${truncate(e, 36)} を返す`;
}

export function throwLabel(expression: string): string {
  const type = exceptionType(expression);
  return type !== null ? `${type} を送出` : `エラーを送出（${truncate(compact(expression), 30)}）`;
}

export function ifLabel(condition: string): string {
  return naturalizeCondition(condition);
}

export function loopLabel(kind: "for" | "while", header: string): string {
  const h = compact(header);
  // for-each: `Type var : collection`
  const each = h.match(/^[A-Za-z_][\w<>,. ]*\s+\w+\s*:\s*([A-Za-z_][\w.]*)/);
  if (kind === "for" && each !== null) return `${each[1]} を 1 件ずつ繰り返す`;
  if (kind === "while") return `${naturalizeCondition(h)} の間繰り返す`;
  return `繰り返す（${truncate(h, 40)}）`;
}

export const TRY_LABEL = "例外処理";
export const FINALLY_LABEL = "後処理（finally）";
export function catchLabel(exceptionType: string): string {
  return `${exceptionType} を捕捉`;
}

export function stmtLabel(text: string): string {
  const t = compact(text);
  // コレクション宣言 (new List<...> / Map / Set) は型名でなく種別で表現
  const coll = t.match(/new\s+(List|Map|Set)\s*</);
  if (coll !== null) {
    const ja = coll[1] === "List" ? "リスト" : coll[1] === "Map" ? "マップ" : "セット";
    return `${ja}を生成`;
  }
  const created = t.match(/new\s+([A-Za-z_][\w]*)\s*\(/);
  const isAdd = /\.\s*add\s*\(/.test(t);
  if (created !== null && isAdd) return `${created[1]} を生成してリストに追加`;
  if (created !== null) return `${created[1]} を生成`;
  if (isAdd) return "リストに要素を追加";
  return truncate(t, 60);
}

// ---------- 内部ヘルパ ----------

function naturalizeCondition(condition: string): string {
  let s = compact(condition);
  s = s
    .replace(/\)\s*&&\s*/g, "） かつ ")
    .replace(/\s*&&\s*/g, " かつ ")
    .replace(/\)\s*\|\|\s*/g, "） または ")
    .replace(/\s*\|\|\s*/g, " または ")
    .replace(/\s*!=\s*null\b/g, " が設定済")
    .replace(/\s*==\s*null\b/g, " が未設定")
    .replace(/\.\s*isEmpty\s*\(\s*\)/g, " が空")
    .replace(/\.\s*isBlank\s*\(\s*\)/g, " が空白")
    .replace(/\s*>=\s*/g, " ≥ ")
    .replace(/\s*<=\s*/g, " ≤ ")
    .replace(/\s*!=\s*/g, " ≠ ")
    .replace(/\s*==\s*/g, " = ");
  return truncate(s, 60);
}

function exceptionType(expression: string): string | null {
  const m = compact(expression).match(/new\s+([A-Za-z_][\w]*)\s*\(/);
  return m !== null ? (m[1] ?? null) : null;
}

function compact(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
