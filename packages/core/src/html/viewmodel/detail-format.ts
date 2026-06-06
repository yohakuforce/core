// ----------------------------------------------------------------------------
// 詳細設計テーブルの整形ユーティリティ (非エンジニア可読性のため)
//
// - DML / Flow 操作種別の日本語ラベル
// - WHERE 句をトップレベルの AND / OR で分割 (論理は保持して曖昧さを残さない)
// - 条件・並び順の「先頭の項目 API 名」を取り出してラベル解決に渡す
//
// 文字列リテラル ('...') と括弧の中は分割境界として扱わない。
// ----------------------------------------------------------------------------

import type { ApexDmlKind } from "../../types/graph.js";

/** DML 操作の日本語ラベル (英語名は API として併記する前提)。 */
const DML_KIND_JA: Record<ApexDmlKind, string> = {
  insert: "新規作成",
  update: "更新",
  upsert: "作成/更新",
  delete: "削除",
  undelete: "復元",
  merge: "統合",
};

export function dmlKindJa(kind: ApexDmlKind): string {
  return DML_KIND_JA[kind] ?? kind;
}

/** WHERE 句を構成する 1 条件 (先頭以外は接続詞 AND/OR を保持)。 */
export interface WhereCondition {
  /** 2 件目以降の接続詞 (AND / OR)。先頭は undefined。 */
  readonly connector?: string;
  /** 接続詞を除いた条件式。 */
  readonly text: string;
}

/**
 * WHERE 句をトップレベルの AND / OR で分割する。論理 (AND/OR) は接続詞として
 * 保持し、改行表示しても意味が変わらないようにする。
 */
export function splitWhereConditions(where: string): readonly WhereCondition[] {
  const tokens = splitTopLevel(where, ["AND", "OR"]);
  return tokens.map((t, i) => (i === 0 ? { text: t.text } : { connector: t.keyword, text: t.text }));
}

/** ORDER BY をトップレベルのカンマで分割する (複数ソートキー)。 */
export function splitOrderByKeys(orderBy: string): readonly string[] {
  return splitTopLevel(orderBy, [","]).map((t) => t.text);
}

/**
 * 条件式・ソートキーの先頭にある項目 API 名を取り出す。
 * 関数呼び出し・括弧・否定で始まる場合や、項目に見えない場合は undefined。
 */
export function leadingFieldToken(expr: string): string | undefined {
  const m = /^([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)/.exec(expr.trim());
  if (m === null) return undefined;
  const token = m[1] ?? "";
  // 関数 (直後が "(") は項目ではない
  const after = expr.trim().slice(token.length).trimStart();
  if (after.startsWith("(")) return undefined;
  const upper = token.toUpperCase();
  if (upper === "NOT" || upper === "AND" || upper === "OR") return undefined;
  return token === "" ? undefined : token;
}

// ---------------------------------------------------------------------------
// 内部: 文字列リテラル / 括弧を尊重したトップレベル分割
// ---------------------------------------------------------------------------

interface SplitToken {
  /** この断片の手前にあったキーワード (先頭は undefined)。 */
  readonly keyword?: string;
  readonly text: string;
}

/**
 * keywords (AND/OR や ",") をトップレベル境界として分割する。
 * keyword が単語のもの (AND/OR) は語境界を要求し、記号 (",") はそのまま使う。
 */
function splitTopLevel(input: string, keywords: readonly string[]): readonly SplitToken[] {
  const s = input.trim();
  const upper = s.toUpperCase();
  const out: SplitToken[] = [];
  let segStart = 0;
  let pendingKeyword: string | undefined;
  let depth = 0;
  let inString = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;

    for (const kw of keywords) {
      const isWord = /^[A-Za-z]+$/.test(kw);
      if (!upper.startsWith(kw, i)) continue;
      if (isWord) {
        const before = i === 0 ? " " : (s[i - 1] ?? " ");
        const after = i + kw.length >= s.length ? " " : (s[i + kw.length] ?? " ");
        if (!isBoundary(before) || !isBoundary(after)) continue;
      }
      const text = s.slice(segStart, i).trim();
      if (text !== "") out.push({ keyword: pendingKeyword, text });
      pendingKeyword = isWord ? kw : undefined;
      i += kw.length - 1;
      segStart = i + 1;
      break;
    }
  }
  const tail = s.slice(segStart).trim();
  if (tail !== "") out.push({ keyword: pendingKeyword, text: tail });
  return out;
}

function isBoundary(ch: string): boolean {
  return ch === " " || ch === "(" || ch === ")";
}
