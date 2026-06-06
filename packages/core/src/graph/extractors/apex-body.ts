// Apex .cls 本体の構造解析 (Phase 7-A+1)
// 正規表現ベース。AST 解析は Phase 7 後半 / Phase 8 で検討。
// 限界 (動的 SOQL 文字列、複雑な型) は HUMAN_MANAGED で補完前提。

import type {
  ApexBodyInfo,
  ApexClassReferenceInfo,
  ApexDmlInfo,
  ApexDmlKind,
  ApexMethodInfo,
  ApexSoqlInfo,
  ApexVisibility,
} from "../../types/graph.js";
import { extractFieldWrites } from "./apex-field-writes.js";
import { parseSoqlDetail } from "./soql-parse.js";

const COMMENT_LINE_REGEX = /\/\/[^\n]*/g;
const COMMENT_BLOCK_REGEX = /\/\*[\s\S]*?\*\//g;
const STRING_LITERAL_REGEX = /'(?:\\.|[^'\\])*'/g;

const ANNOTATION_LINE_REGEX = /^\s*@(\w+(?:\([^)]*\))?)/gm;

// メソッド検出: 可視性 + (static)? + 戻り値 + 名前 + (引数)
// 戻り値は List<X>, Map<X,Y>, X[] 等を含む
const METHOD_REGEX =
  /(?:^|\n)\s*(public|private|protected|global)\s+(?:(static|virtual|abstract|override)\s+)*([\w<>,\s\?\[\]]+?)\s+(\w+)\s*\(([^)]*)\)\s*[{;]/gm;

const SOQL_REGEX = /\[\s*(SELECT[\s\S]+?FROM\s+\w+[\s\S]*?)\]/gi;
const SOQL_FROM_REGEX = /FROM\s+(\w+)/i;

const DML_VERB_REGEX =
  /(?:^|[\s;{])\s*(insert|update|delete|upsert|undelete|merge)\s+([a-zA-Z_]\w*)/gi;

const DATABASE_DML_REGEX =
  /Database\.(insert|update|delete|upsert|undelete|merge)\s*\(\s*([\w.]+)/gi;

const CLASS_REF_REGEX = /\b([A-Z][\w]*)\.([\w]+)\s*\(/g;
// new ClassName(...) — handler パターン (`new XHandler().run()`) を検出する
const NEW_INSTANCE_REGEX = /\bnew\s+([A-Z][\w]*)\s*\(/g;

const TRY_REGEX = /\btry\s*\{/;
const CALLOUT_REGEX =
  /\bnew\s+HttpRequest\s*\(|@HttpGet\b|@HttpPost\b|@HttpPut\b|@HttpDelete\b|@HttpPatch\b/;

/** コメント・文字列リテラルを除去して解析対象を整える */
export function stripApexNoise(content: string): string {
  return content
    .replace(COMMENT_BLOCK_REGEX, " ")
    .replace(COMMENT_LINE_REGEX, " ")
    .replace(STRING_LITERAL_REGEX, "''");
}

/**
 * コメントのみ除去し、文字列リテラルは残す。項目代入の「設定値」抽出のように
 * リテラルそのものが意味を持つ解析で使う。
 */
export function stripApexComments(content: string): string {
  return content.replace(COMMENT_BLOCK_REGEX, " ").replace(COMMENT_LINE_REGEX, " ");
}

/** 旧シンボル名 (内部互換用) */
function strip(content: string): string {
  return stripApexNoise(content);
}

export function extractApexBody(rawContent: string): ApexBodyInfo {
  const stripped = strip(rawContent);
  // SOQL は WHERE 値 (文字列リテラル) も意味を持つため、リテラルを残した本文から抽出する。
  const commentStripped = stripApexComments(rawContent);

  const methods = extractMethods(stripped, rawContent);
  const soqlQueries = extractSoql(commentStripped);
  const dmlOperations = extractDml(stripped);
  const classReferences = extractClassReferences(stripped);
  const classAnnotations = extractClassAnnotations(rawContent);
  const hasTryCatch = TRY_REGEX.test(stripped);
  const hasCallout = CALLOUT_REGEX.test(rawContent);
  // 設定値リテラルを保持するためコメントのみ除去した本文を渡す
  const fieldWrites = extractFieldWrites(commentStripped, dmlOperations);

  return {
    methods,
    soqlQueries,
    dmlOperations,
    classReferences,
    classAnnotations,
    hasTryCatch,
    hasCallout,
    fieldWrites: fieldWrites.length > 0 ? fieldWrites : undefined,
  };
}

function extractMethods(stripped: string, raw: string): readonly ApexMethodInfo[] {
  const result: ApexMethodInfo[] = [];
  const re = new RegExp(METHOD_REGEX.source, "gm");
  let match: RegExpExecArray | null = re.exec(stripped);
  while (match !== null) {
    const visibility = match[1] as ApexVisibility;
    const modifier = match[2] ?? "";
    const isStatic = modifier === "static";
    const returnType = (match[3] ?? "").trim().replace(/\s+/g, " ");
    const name = match[4] ?? "";
    const parameters = (match[5] ?? "").trim();
    // 戻り値が void は許容する。control-flow キーワード (if/while/for/switch...) のみを排除。
    if (
      returnType === "" ||
      name === "" ||
      isControlFlowKeyword(returnType) ||
      isReservedKeyword(name)
    ) {
      match = re.exec(stripped);
      continue;
    }
    // メソッド直前のアノテーションを raw から取得
    const annotations = extractMethodAnnotations(raw, name);
    result.push({ name, visibility, isStatic, returnType, parameters, annotations });
    match = re.exec(stripped);
  }
  return dedupeMethods(result);
}

function dedupeMethods(methods: readonly ApexMethodInfo[]): readonly ApexMethodInfo[] {
  const seen = new Set<string>();
  const result: ApexMethodInfo[] = [];
  for (const m of methods) {
    const key = `${m.name}(${m.parameters})`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(m);
  }
  return result;
}

function extractMethodAnnotations(raw: string, methodName: string): readonly string[] {
  // method 宣言の直前 5 行までに現れる @AAA を拾う簡易実装
  const lines = raw.split("\n");
  const idx = lines.findIndex((line) => new RegExp(`\\b${methodName}\\s*\\(`).test(line));
  if (idx === -1) return [];
  const before = lines.slice(Math.max(0, idx - 5), idx);
  const annotations: string[] = [];
  for (const line of before) {
    const m = /^\s*@(\w+(?:\([^)]*\))?)/.exec(line);
    if (m?.[1]) annotations.push(m[1]);
  }
  return annotations;
}

function extractClassAnnotations(raw: string): readonly string[] {
  const annotations: string[] = [];
  const re = new RegExp(ANNOTATION_LINE_REGEX.source, "gm");
  let match: RegExpExecArray | null = re.exec(raw);
  // クラス宣言行までに現れる @AAA をクラスアノテーションと見做す
  const classDeclIdx = raw.search(/\b(class|interface|enum)\s+\w+/);
  while (match !== null) {
    if (classDeclIdx !== -1 && match.index > classDeclIdx) break;
    if (match[1]) annotations.push(match[1]);
    match = re.exec(raw);
  }
  return annotations;
}

function extractSoql(stripped: string): readonly ApexSoqlInfo[] {
  const result: ApexSoqlInfo[] = [];
  const re = new RegExp(SOQL_REGEX.source, "gi");
  let match: RegExpExecArray | null = re.exec(stripped);
  while (match !== null) {
    const raw = (match[1] ?? "").trim().replace(/\s+/g, " ");
    const detail = parseSoqlDetail(raw);
    // detail.object はトップレベル FROM 由来。サブクエリを含むクエリでも正しい
    // 主オブジェクトになる (旧 SOQL_FROM_REGEX は最初の FROM=サブクエリを誤検出した)。
    const primaryObject = detail.object ?? SOQL_FROM_REGEX.exec(raw)?.[1] ?? null;
    result.push({
      raw,
      primaryObject,
      fields: detail.fields.length > 0 ? detail.fields : undefined,
      whereClause: detail.whereClause,
      orderByClause: detail.orderByClause,
      limitClause: detail.limitClause,
    });
    match = re.exec(stripped);
  }
  return result;
}

function extractDml(stripped: string): readonly ApexDmlInfo[] {
  const result: ApexDmlInfo[] = [];

  const verbRe = new RegExp(DML_VERB_REGEX.source, "gi");
  let m1: RegExpExecArray | null = verbRe.exec(stripped);
  while (m1 !== null) {
    const kind = (m1[1] ?? "").toLowerCase() as ApexDmlKind;
    const target = m1[2] ?? "";
    if (target !== "" && !isReservedKeyword(target)) {
      result.push({ kind, target, viaDatabaseClass: false });
    }
    m1 = verbRe.exec(stripped);
  }

  const dbRe = new RegExp(DATABASE_DML_REGEX.source, "gi");
  let m2: RegExpExecArray | null = dbRe.exec(stripped);
  while (m2 !== null) {
    const kind = (m2[1] ?? "").toLowerCase() as ApexDmlKind;
    const target = m2[2] ?? "";
    if (target !== "") {
      result.push({ kind, target, viaDatabaseClass: true });
    }
    m2 = dbRe.exec(stripped);
  }

  return result;
}

function extractClassReferences(stripped: string): readonly ApexClassReferenceInfo[] {
  const result: ApexClassReferenceInfo[] = [];
  const seen = new Set<string>();

  const re = new RegExp(CLASS_REF_REGEX.source, "g");
  let match: RegExpExecArray | null = re.exec(stripped);
  while (match !== null) {
    const className = match[1] ?? "";
    const memberName = match[2] ?? "";
    if (className === "" || memberName === "") {
      match = re.exec(stripped);
      continue;
    }
    if (isReservedKeyword(className) || isStandardApexType(className)) {
      match = re.exec(stripped);
      continue;
    }
    const key = `${className}.${memberName}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ className, memberName });
    }
    match = re.exec(stripped);
  }

  const newRe = new RegExp(NEW_INSTANCE_REGEX.source, "g");
  let nm: RegExpExecArray | null = newRe.exec(stripped);
  while (nm !== null) {
    const className = nm[1] ?? "";
    if (className === "" || isReservedKeyword(className) || isStandardApexType(className)) {
      nm = newRe.exec(stripped);
      continue;
    }
    const key = `${className}.<new>`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ className, memberName: "<new>" });
    }
    nm = newRe.exec(stripped);
  }

  return result;
}

const RESERVED = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "return",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "this",
  "super",
  "true",
  "false",
  "null",
  "void",
  "static",
  "final",
  "public",
  "private",
  "protected",
  "global",
  "abstract",
  "virtual",
  "override",
  "with",
  "without",
  "sharing",
  "implements",
  "extends",
]);

function isReservedKeyword(s: string): boolean {
  return RESERVED.has(s.toLowerCase());
}

const CONTROL_FLOW = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "return",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
]);

function isControlFlowKeyword(s: string): boolean {
  return CONTROL_FLOW.has(s.toLowerCase());
}

const STANDARD_APEX_TYPES = new Set([
  "System",
  "Database",
  "Schema",
  "String",
  "Integer",
  "Decimal",
  "Double",
  "Long",
  "Boolean",
  "Date",
  "Datetime",
  "Time",
  "Id",
  "Object",
  "Blob",
  "List",
  "Set",
  "Map",
  "Test",
  "Limits",
  "UserInfo",
  "Math",
  "Json",
  "JSON",
  "Http",
  "HttpRequest",
  "HttpResponse",
  "Trigger",
  "ApexPages",
  "PageReference",
  "Messaging",
  "Type",
  "DateTime",
  "Pattern",
  "Matcher",
]);

function isStandardApexType(s: string): boolean {
  return STANDARD_APEX_TYPES.has(s);
}
