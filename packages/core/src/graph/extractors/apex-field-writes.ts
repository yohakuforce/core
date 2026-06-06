// ----------------------------------------------------------------------------
// 項目への値の割り当て (field-writes) の決定的抽出
//
// `receiver.field = value` 形の代入を拾い、レシーバの SObject 型・設定値・
// 操作種別 (後続 DML から推定)・所属メソッドを構造化する。正規表現ベースで
// あり、動的代入 (put / sObject.put('F', v)) や複合代入 (+=) は対象外。
// 解決できない型は object=null とし、LLM / HUMAN_MANAGED 補完に委ねる。
// ----------------------------------------------------------------------------

import type { ApexDmlInfo, ApexDmlKind, ApexFieldWriteInfo } from "../../types/graph.js";

// receiver.Field = value;  (== / != / <= / >= / += 等は除外)
const ASSIGN_REGEX = /([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*=(?!=)\s*([^;{}]+);/g;

// var = new Type(   /   Type var = new Type(
const NEW_ASSIGN_REGEX = /\b([a-z_]\w*)\s*=\s*new\s+([A-Z]\w*)\s*[(\]]/g;
// (先頭/区切りの直後) Type var [=;]
const DECL_REGEX = /(?:^|[;{(,])\s*([A-Z]\w*)\s+([a-z_]\w*)\s*[=;]/g;
// for (Type var : ...)  /  for (final Type var : ...)
const FOREACH_REGEX = /\bfor\s*\(\s*(?:final\s+)?([A-Z]\w*)\s+([a-z_]\w*)\s*:/g;

// 型として扱わない頻出の非 SObject 型 (誤マッピング抑止)
const NON_SOBJECT_TYPES = new Set([
  "String",
  "Integer",
  "Decimal",
  "Double",
  "Long",
  "Boolean",
  "Date",
  "Datetime",
  "DateTime",
  "Time",
  "Id",
  "Object",
  "Blob",
  "List",
  "Set",
  "Map",
  "Void",
]);

/**
 * 変数名 → SObject 型 (推定) のマップを構築する。
 * new 代入 > 宣言 > for-each の順で上書きし、より具体的な情報を優先する。
 */
function buildTypeMap(stripped: string): Map<string, string> {
  const map = new Map<string, string>();
  const record = (varName: string, type: string): void => {
    if (varName === "" || type === "" || NON_SOBJECT_TYPES.has(type)) return;
    map.set(varName, type);
  };
  for (const re of [DECL_REGEX, FOREACH_REGEX]) {
    const r = new RegExp(re.source, "g");
    let m: RegExpExecArray | null = r.exec(stripped);
    while (m !== null) {
      record(m[2] ?? "", m[1] ?? "");
      m = r.exec(stripped);
    }
  }
  // new 代入は最後に適用し、宣言より優先 (実体生成の型が最も確か)
  const nr = new RegExp(NEW_ASSIGN_REGEX.source, "g");
  let nm: RegExpExecArray | null = nr.exec(stripped);
  while (nm !== null) {
    record(nm[1] ?? "", nm[2] ?? "");
    nm = nr.exec(stripped);
  }
  return map;
}

/** メソッド宣言位置から、ある文字位置が属するメソッド名を推定する。 */
function buildMethodIndex(stripped: string): readonly { readonly at: number; readonly name: string }[] {
  const re = /(?:public|private|protected|global)\s+(?:(?:static|virtual|abstract|override)\s+)*[\w<>,\s?[\]]+?\s+(\w+)\s*\([^)]*\)\s*\{/g;
  const out: { at: number; name: string }[] = [];
  let m: RegExpExecArray | null = re.exec(stripped);
  while (m !== null) {
    out.push({ at: m.index, name: m[1] ?? "" });
    m = re.exec(stripped);
  }
  return out;
}

function methodNameAt(
  index: readonly { readonly at: number; readonly name: string }[],
  pos: number,
): string | undefined {
  let name: string | undefined;
  for (const m of index) {
    if (m.at <= pos) name = m.name;
    else break;
  }
  return name === "" ? undefined : name;
}

function operationFor(
  receiver: string,
  dmlOperations: readonly ApexDmlInfo[],
): ApexDmlKind | undefined {
  return dmlOperations.find((d) => d.target === receiver)?.kind;
}

/**
 * `receiver.field = value` 代入を抽出して構造化する。
 *
 * @param stripped コメントのみ除去済みの本文 (設定値リテラルは保持する。stripApexComments)
 * @param dmlOperations 同本文から抽出済みの DML (操作種別の推定に使う)
 */
export function extractFieldWrites(
  stripped: string,
  dmlOperations: readonly ApexDmlInfo[],
): readonly ApexFieldWriteInfo[] {
  const typeMap = buildTypeMap(stripped);
  const methodIndex = buildMethodIndex(stripped);
  const result: ApexFieldWriteInfo[] = [];

  const re = new RegExp(ASSIGN_REGEX.source, "g");
  let m: RegExpExecArray | null = re.exec(stripped);
  while (m !== null) {
    const receiver = m[1] ?? "";
    const field = m[2] ?? "";
    const valueExpr = (m[3] ?? "").trim().replace(/\s+/g, " ");
    if (receiver !== "" && field !== "" && valueExpr !== "") {
      result.push({
        receiver,
        object: typeMap.get(receiver) ?? null,
        field,
        valueExpr,
        operation: operationFor(receiver, dmlOperations),
        methodName: methodNameAt(methodIndex, m.index),
      });
    }
    m = re.exec(stripped);
  }
  return result;
}
