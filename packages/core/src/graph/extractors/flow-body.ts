// Flow XML 構造解析 (Phase 7-A+2 / Phase 8-B3 で edges 拡張)
// recordLookups / recordCreates / recordUpdates / recordDeletes /
// decisions / assignments / loops / actionCalls / subflows / screens / waits
// を取り出して Markdown / Mermaid 化に使えるよう整える。
//
// Phase 8-B3: connector / defaultConnector / faultConnector / rules を読み、
// 要素間の有向グラフを edges として返す。

import type {
  FlowBodyInfo,
  FlowEdgeInfo,
  FlowElementInfo,
  FlowElementKind,
  FlowFieldAssignment,
  FlowRecordFilter,
} from "../../types/graph.js";
import { asArray, asBoolean, asString } from "../parse-xml.js";

const RECORD_KINDS: ReadonlySet<FlowElementKind> = new Set([
  "recordLookup",
  "recordCreate",
  "recordUpdate",
  "recordDelete",
]);

interface FlowNodeBase {
  readonly name?: unknown;
  readonly label?: unknown;
}

const SECTION_TO_KIND: ReadonlyArray<readonly [string, FlowElementKind]> = [
  ["recordLookups", "recordLookup"],
  ["recordCreates", "recordCreate"],
  ["recordUpdates", "recordUpdate"],
  ["recordDeletes", "recordDelete"],
  ["decisions", "decision"],
  ["assignments", "assignment"],
  ["loops", "loop"],
  ["actionCalls", "actionCall"],
  ["subflows", "subflow"],
  ["screens", "screen"],
  ["waits", "wait"],
];

export function extractFlowBody(flowNode: Record<string, unknown>): FlowBodyInfo {
  const elements: FlowElementInfo[] = [];
  const subflows: string[] = [];
  const recordObjects = new Set<string>();
  const actionCalls: string[] = [];
  const edges: FlowEdgeInfo[] = [];

  for (const [sectionName, kind] of SECTION_TO_KIND) {
    const list = asArray(flowNode[sectionName] as FlowNodeBase | readonly FlowNodeBase[]);
    for (const node of list) {
      if (typeof node !== "object" || node === null) continue;
      const rec = node as Record<string, unknown>;
      const name = asString(rec.name) ?? "";
      const label = asString(rec.label);
      const target = inferTarget(rec, kind);
      if (name === "") continue;
      elements.push({ name, kind, label, target, ...recordDetail(rec, kind) });
      if (kind === "subflow") {
        const fqn = asString(rec.flowName);
        if (fqn !== undefined) subflows.push(fqn);
      }
      if (kind === "actionCall") {
        const action = asString(rec.actionName);
        if (action !== undefined) actionCalls.push(action);
      }
      if (
        kind === "recordLookup" ||
        kind === "recordCreate" ||
        kind === "recordUpdate" ||
        kind === "recordDelete"
      ) {
        const obj = asString(rec.object);
        if (obj !== undefined) recordObjects.add(obj);
      }

      // Phase 8-B3: connector を読んで edges を構築
      collectEdgesFor(rec, name, kind, edges);
    }
  }

  // start からの最初の遷移
  const startNode = flowNode.start as Record<string, unknown> | undefined;
  let startTarget: string | undefined;
  if (startNode !== undefined) {
    const target = readConnectorTarget(startNode.connector);
    if (target !== undefined) {
      startTarget = target;
      edges.push({ from: "__start__", to: target, kind: "start", label: "start" });
    }
  }

  return {
    elements,
    subflows: dedupe(subflows),
    recordObjects: [...recordObjects].toSorted((a, b) => a.localeCompare(b)),
    actionCalls: dedupe(actionCalls),
    edges,
    startTarget,
    startTrigger: extractStartTrigger(startNode),
  };
}

/** start ノードからレコードトリガ Flow の起動条件を取り出す (非トリガなら undefined)。 */
function extractStartTrigger(
  startNode: Record<string, unknown> | undefined,
): FlowBodyInfo["startTrigger"] {
  if (startNode === undefined) return undefined;
  const object = asString(startNode.object);
  const recordTriggerType = asString(startNode.recordTriggerType);
  const triggerType = asString(startNode.triggerType);
  const formulaRaw = asString(startNode.filterFormula);
  const conditionFormula = formulaRaw !== undefined ? decodeBasicXmlEntities(formulaRaw) : undefined;
  const filters = extractFilters(startNode.filters);
  const filterLogic = asString(startNode.filterLogic);
  // レコードトリガでない (object も triggerType も無い) Flow では起動条件を出さない
  if (object === undefined && recordTriggerType === undefined && triggerType === undefined) {
    return undefined;
  }
  return {
    ...(object !== undefined ? { object } : {}),
    ...(recordTriggerType !== undefined ? { recordTriggerType } : {}),
    ...(triggerType !== undefined ? { triggerType } : {}),
    ...(conditionFormula !== undefined ? { conditionFormula } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    ...(filterLogic !== undefined ? { filterLogic } : {}),
  };
}

function collectEdgesFor(
  rec: Record<string, unknown>,
  name: string,
  kind: FlowElementKind,
  edges: FlowEdgeInfo[],
): void {
  // 一般要素: connector → 通常遷移
  const next = readConnectorTarget(rec.connector);
  if (next !== undefined) edges.push({ from: name, to: next, kind: "next" });

  // fault path
  const fault = readConnectorTarget(rec.faultConnector);
  if (fault !== undefined) edges.push({ from: name, to: fault, kind: "fault", label: "fault" });

  // decision
  if (kind === "decision") {
    const rules = asArray(rec.rules as unknown);
    for (const r of rules) {
      if (typeof r !== "object" || r === null) continue;
      const rule = r as Record<string, unknown>;
      const ruleName = asString(rule.name) ?? "";
      const ruleLabel = asString(rule.label) ?? ruleName;
      const target = readConnectorTarget(rule.connector);
      if (target !== undefined) {
        edges.push({ from: name, to: target, kind: "rule", label: ruleLabel });
      }
    }
    const def = readConnectorTarget(rec.defaultConnector);
    if (def !== undefined) {
      const defLabel = asString(rec.defaultConnectorLabel) ?? "default";
      edges.push({ from: name, to: def, kind: "default", label: defLabel });
    }
  }

  // loop は通常 connector を使わず nextValue/noMoreValues
  if (kind === "loop") {
    const nv = readConnectorTarget(rec.nextValueConnector);
    if (nv !== undefined) edges.push({ from: name, to: nv, kind: "loop", label: "next value" });
    const nmv = readConnectorTarget(rec.noMoreValuesConnector);
    if (nmv !== undefined)
      edges.push({ from: name, to: nmv, kind: "noMore", label: "no more values" });
  }
}

function readConnectorTarget(node: unknown): string | undefined {
  if (typeof node !== "object" || node === null) return undefined;
  const rec = node as Record<string, unknown>;
  return asString(rec.targetReference);
}

/**
 * record 系要素から「どの項目を / どの条件で / どの値を」を抽出する
 * (詳細設計: query-detail / field-writes)。非 record 要素では空オブジェクトを返す。
 */
function recordDetail(
  rec: Record<string, unknown>,
  kind: FlowElementKind,
): Partial<FlowElementInfo> {
  if (!RECORD_KINDS.has(kind)) return {};
  const out: {
    -readonly [K in keyof FlowElementInfo]?: FlowElementInfo[K];
  } = {};

  const queriedFields = asArray(rec.queriedFields)
    .map((x) => asString(x) ?? "")
    .filter((s) => s !== "");
  if (queriedFields.length > 0) out.queriedFields = queriedFields;

  const filters = extractFilters(rec.filters);
  if (filters.length > 0) out.filters = filters;
  const filterLogic = asString(rec.filterLogic);
  if (filterLogic !== undefined) out.filterLogic = filterLogic;

  const inputAssignments = extractAssignments(rec.inputAssignments);
  if (inputAssignments.length > 0) out.inputAssignments = inputAssignments;
  const inputReference = asString(rec.inputReference);
  if (inputReference !== undefined) out.inputReference = inputReference;

  const sortField = asString(rec.sortField);
  if (sortField !== undefined) out.sortField = sortField;
  const sortOrder = asString(rec.sortOrder);
  if (sortOrder !== undefined) out.sortOrder = sortOrder;
  const getFirstRecordOnly = asBoolean(rec.getFirstRecordOnly);
  if (getFirstRecordOnly !== undefined) out.getFirstRecordOnly = getFirstRecordOnly;

  return out;
}

function extractFilters(raw: unknown): readonly FlowRecordFilter[] {
  return asArray(raw)
    .map((f) => {
      const ff = (typeof f === "object" && f !== null ? f : {}) as Record<string, unknown>;
      return {
        field: asString(ff.field) ?? "",
        operator: asString(ff.operator) ?? "",
        value: flowValueToString(ff.value),
      };
    })
    .filter((f) => f.field !== "");
}

function extractAssignments(raw: unknown): readonly FlowFieldAssignment[] {
  return asArray(raw)
    .map((a) => {
      const aa = (typeof a === "object" && a !== null ? a : {}) as Record<string, unknown>;
      return { field: asString(aa.field) ?? "", value: flowValueToString(aa.value) };
    })
    .filter((a) => a.field !== "");
}

/**
 * 定義済み XML エンティティ (&quot; 等) のみを復号する。parse-xml は XXE 対策で
 * processEntities=false にしているため、表示用にここで安全な 5 種だけ戻す。
 */
function decodeBasicXmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Flow の値 (FlowElementReferenceOrValue) を表示用文字列にする。
 * 参照は {!ref}、文字列は 'str'、その他はそのまま。解決不能は空文字。
 */
function flowValueToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return decodeBasicXmlEntities(value);
  if (typeof value !== "object") return String(value);
  const v = value as Record<string, unknown>;
  const ref = asString(v.elementReference);
  if (ref !== undefined) return `{!${ref}}`;
  const s = asString(v.stringValue);
  if (s !== undefined) return `'${decodeBasicXmlEntities(s)}'`;
  const b = asString(v.booleanValue);
  if (b !== undefined) return b;
  const n = asString(v.numberValue);
  if (n !== undefined) return n;
  const dt = asString(v.dateTimeValue) ?? asString(v.dateValue);
  if (dt !== undefined) return dt;
  const apex = asString(v.apexValue);
  if (apex !== undefined) return apex;
  return "";
}

function inferTarget(rec: Record<string, unknown>, kind: FlowElementKind): string | undefined {
  switch (kind) {
    case "recordLookup":
    case "recordCreate":
    case "recordUpdate":
    case "recordDelete":
      return asString(rec.object);
    case "subflow":
      return asString(rec.flowName);
    case "actionCall":
      return asString(rec.actionName);
    default:
      return undefined;
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)].toSorted((a, b) => a.localeCompare(b));
}
