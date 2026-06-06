// ----------------------------------------------------------------------------
// SOQL 句の決定的分解 (詳細設計: query-detail)
//
// extractSoql が拾った raw 文字列を、取得項目 (SELECT) / 絞り込み条件 (WHERE) /
// 並び順 (ORDER BY) / 件数 (LIMIT) に分解する。正規表現ではなく括弧深度を見ながら
// トップレベルの句キーワードだけを境界に使うため、サブクエリ・集計関数の内側に
// 同名キーワードがあっても誤検出しない。
//
// 限界: 動的 SOQL (文字列結合) は対象外 (呼び出し側が raw を渡せないため)。
// 解析しきれない部分は原文のまま 1 要素として残し、LLM / HUMAN_MANAGED 補完に委ねる。
// ----------------------------------------------------------------------------

export interface SoqlClauseDetail {
  /** トップレベル FROM の対象オブジェクト (サブクエリの FROM は無視)。 */
  readonly object: string | null;
  /** SELECT 句の取得項目 (トップレベルのカンマで分割)。 */
  readonly fields: readonly string[];
  readonly whereClause?: string;
  readonly orderByClause?: string;
  readonly limitClause?: string;
}

// トップレベル句キーワード (長いものを先に並べ、部分一致の取りこぼしを防ぐ)
const CLAUSE_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
  "OFFSET",
  "FOR UPDATE",
  "FOR VIEW",
  "FOR REFERENCE",
  "WITH",
] as const;

interface ClauseMarker {
  readonly kw: string;
  readonly start: number;
  readonly contentStart: number;
}

/**
 * raw SOQL を句単位に分解する。括弧深度 0 の位置でのみキーワードを境界として扱う。
 */
export function parseSoqlDetail(raw: string): SoqlClauseDetail {
  const q = raw.replace(/\s+/g, " ").trim();
  const markers = findTopLevelClauses(q);
  const contentOf = (kw: string): string | undefined => {
    const idx = markers.findIndex((m) => m.kw === kw);
    if (idx === -1) return undefined;
    const start = markers[idx]?.contentStart ?? 0;
    const end = markers[idx + 1]?.start ?? q.length;
    const text = q.slice(start, end).trim();
    return text === "" ? undefined : text;
  };

  const selectText = contentOf("SELECT");
  const fields = selectText === undefined ? [] : splitTopLevelCommas(selectText);
  // FROM 句の先頭トークン = 対象オブジェクト。サブクエリの FROM は depth>0 のため
  // findTopLevelClauses に拾われず、ここでは常にトップレベルの FROM だけを見る。
  const fromText = contentOf("FROM");
  const object = fromText !== undefined ? (fromText.split(/[\s,)]/)[0] ?? null) || null : null;

  return {
    object,
    fields,
    whereClause: contentOf("WHERE"),
    orderByClause: contentOf("ORDER BY"),
    limitClause: contentOf("LIMIT"),
  };
}

function findTopLevelClauses(q: string): readonly ClauseMarker[] {
  const ups = q.toUpperCase();
  const res: ClauseMarker[] = [];
  let depth = 0;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    for (const kw of CLAUSE_KEYWORDS) {
      if (!ups.startsWith(kw, i)) continue;
      const before = i === 0 ? " " : q[i - 1];
      const afterIdx = i + kw.length;
      const after = afterIdx >= q.length ? " " : q[afterIdx];
      // キーワードが識別子の一部 (ORDERED 等) でないことを境界で確認する
      const boundedLeft = before === " " || before === "(" || before === ",";
      const boundedRight = after === " " || after === "(" || afterIdx >= q.length;
      if (boundedLeft && boundedRight) {
        res.push({ kw, start: i, contentStart: afterIdx });
        i = afterIdx - 1;
        break;
      }
    }
  }
  return res;
}

/** 括弧深度を尊重してトップレベルのカンマで分割する (サブクエリ/関数引数は割らない)。 */
export function splitTopLevelCommas(s: string): readonly string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      const t = buf.trim();
      if (t !== "") out.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last !== "") out.push(last);
  return out;
}
