// ----------------------------------------------------------------------------
// LLM プロンプト用 context 構築
//
// graph から「LLM が業務的意味づけを書くのに十分な構造情報」を抜粋する。
// 過剰な情報は読み手の認知負荷とトークン消費を増やすので、各タイプで必要
// 最小限に絞る。
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";
import { concernsForApex, concernsForFlow, concernsForTrigger } from "../render/concerns.js";
import type {
  ApexClass,
  ApexFieldWriteInfo,
  ApexSoqlInfo,
  ApexTrigger,
  Flow,
  FlowElementInfo,
  KnowledgeGraph,
  LightningWebComponent,
  SObject,
} from "../types/graph.js";

export function buildContextForApex(
  cls: ApexClass,
  graph: KnowledgeGraph,
): Record<string, unknown> {
  const body = cls.body;
  return {
    sourcePath: cls.sourcePath,
    apiVersion: cls.apiVersion,
    isTest: cls.isTest,
    linesOfCode: cls.linesOfCode ?? null,
    hasCallout: body?.hasCallout ?? false,
    hasTryCatch: body?.hasTryCatch ?? false,
    classAnnotations: body?.classAnnotations ?? [],
    methods: (body?.methods ?? []).map((m) => ({
      name: m.name,
      visibility: m.visibility,
      static: m.isStatic,
      returnType: m.returnType,
      parameters: m.parameters,
      annotations: m.annotations,
    })),
    soqlObjects: unique(
      (body?.soqlQueries ?? []).map((q) => q.primaryObject).filter((o): o is string => o !== null),
    ),
    soqlDetail: soqlDetailContext(body?.soqlQueries),
    fieldWrites: fieldWritesContext(body?.fieldWrites),
    dmlTargets: unique((body?.dmlOperations ?? []).map((d) => `${d.kind} ${d.target}`)),
    callees: unique((body?.classReferences ?? []).map((r) => r.className)),
    callers: graph.apexClasses
      .filter((c) => c.fullyQualifiedName !== cls.fullyQualifiedName)
      .filter((c) =>
        (c.body?.classReferences ?? []).some((r) => r.className === cls.fullyQualifiedName),
      )
      .map((c) => c.fullyQualifiedName),
    autoDetectedConcerns: concernsForApex(cls, graph).map((c) => ({
      severity: c.severity,
      title: c.title,
      detail: c.detail ?? null,
    })),
  };
}

export function buildContextForTrigger(
  trg: ApexTrigger,
  graph: KnowledgeGraph,
): Record<string, unknown> {
  return {
    sourcePath: trg.sourcePath,
    apiVersion: trg.apiVersion,
    object: trg.object,
    events: trg.events,
    handlers: unique((trg.body?.classReferences ?? []).map((r) => r.className)),
    soqlObjects: unique(
      (trg.body?.soqlQueries ?? [])
        .map((q) => q.primaryObject)
        .filter((o): o is string => o !== null),
    ),
    soqlDetail: soqlDetailContext(trg.body?.soqlQueries),
    fieldWrites: fieldWritesContext(trg.body?.fieldWrites),
    dmlTargets: unique((trg.body?.dmlOperations ?? []).map((d) => `${d.kind} ${d.target}`)),
    siblingsOnSameObject: graph.apexTriggers
      .filter((t) => t.object === trg.object && t.fullyQualifiedName !== trg.fullyQualifiedName)
      .map((t) => t.fullyQualifiedName),
    autoDetectedConcerns: concernsForTrigger(trg, graph).map((c) => ({
      severity: c.severity,
      title: c.title,
      detail: c.detail ?? null,
    })),
  };
}

export function buildContextForLwc(
  lwc: LightningWebComponent,
  _graph: KnowledgeGraph,
): Record<string, unknown> {
  return {
    sourcePath: lwc.sourcePath,
    apiVersion: lwc.apiVersion ?? null,
    isExposed: lwc.isExposed,
    targets: lwc.targets,
    publicProperties: lwc.publicProperties,
    customEvents: lwc.customEvents,
    apexImports: lwc.apexImports.map((a) => `${a.className}.${a.methodName}`),
    wires: lwc.wires.map((w) => w.target),
    childComponents: lwc.childComponents,
  };
}

export function buildContextForObject(
  obj: SObject,
  graph: KnowledgeGraph,
): Record<string, unknown> {
  const name = obj.fullyQualifiedName;
  const fields = graph.fields.filter((f) => f.object === name);
  const apexUsers = graph.apexClasses
    .filter(
      (c) =>
        (c.body?.soqlQueries ?? []).some((q) => q.primaryObject === name) ||
        (c.body?.dmlOperations ?? []).some((d) => d.target === name),
    )
    .map((c) => c.fullyQualifiedName);
  const triggers = graph.apexTriggers
    .filter((t) => t.object === name)
    .map((t) => t.fullyQualifiedName);
  const flows = graph.flows
    .filter((f) => f.triggeringObject === name || (f.body?.recordObjects ?? []).includes(name))
    .map((f) => f.fullyQualifiedName);
  return {
    sourcePath: obj.sourcePath,
    label: obj.label,
    isCustom: obj.isCustom,
    sharingModel: obj.sharingModel ?? null,
    fieldCount: fields.length,
    fieldSamples: fields.slice(0, 8).map((f) => ({
      name: f.fullyQualifiedName,
      type: f.type,
      label: f.label ?? null,
      required: f.required ?? false,
      referenceTo: f.referenceTo ?? [],
    })),
    usedBy: { apex: apexUsers, triggers, flows },
  };
}

export function buildContextForFlow(flow: Flow, _graph: KnowledgeGraph): Record<string, unknown> {
  const body = flow.body;
  return {
    sourcePath: flow.sourcePath,
    type: flow.type,
    status: flow.status,
    triggeringObject: flow.triggeringObject ?? null,
    recordObjects: body?.recordObjects ?? [],
    recordDetail: flowRecordDetailContext(body?.elements),
    fieldAssignments: flowFieldAssignmentContext(body?.elements),
    subflows: body?.subflows ?? [],
    actionCalls: body?.actionCalls ?? [],
    elementsCount: body?.elements.length ?? 0,
    elementKinds: countByKind(body?.elements ?? []),
    autoDetectedConcerns: concernsForFlow(flow).map((c) => ({
      severity: c.severity,
      title: c.title,
      detail: c.detail ?? null,
    })),
  };
}

export function buildContextFor(
  type: ComponentType,
  name: string,
  graph: KnowledgeGraph,
): Record<string, unknown> | null {
  switch (type) {
    case "apex": {
      const cls = graph.apexClasses.find((c) => c.fullyQualifiedName === name);
      return cls === undefined ? null : buildContextForApex(cls, graph);
    }
    case "trigger": {
      const trg = graph.apexTriggers.find((t) => t.fullyQualifiedName === name);
      return trg === undefined ? null : buildContextForTrigger(trg, graph);
    }
    case "lwc": {
      const lwc = graph.lwcs.find((l) => l.fullyQualifiedName === name);
      return lwc === undefined ? null : buildContextForLwc(lwc, graph);
    }
    case "object": {
      const obj = graph.objects.find((o) => o.fullyQualifiedName === name);
      return obj === undefined ? null : buildContextForObject(obj, graph);
    }
    case "flow": {
      const flow = graph.flows.find((f) => f.fullyQualifiedName === name);
      return flow === undefined ? null : buildContextForFlow(flow, graph);
    }
  }
}

/**
 * LLM が「どのオブジェクトを / どの項目を / どの条件で」取得するかを書けるよう、
 * 決定的に分解した SOQL の構造を渡す (詳細設計: query-detail / processing-detail-narrative)。
 */
function soqlDetailContext(
  queries: readonly ApexSoqlInfo[] | undefined,
): readonly Record<string, unknown>[] {
  return (queries ?? []).map((q) => ({
    object: q.primaryObject,
    fields: q.fields ?? [],
    where: q.whereClause ?? null,
    orderBy: q.orderByClause ?? null,
    limit: q.limitClause ?? null,
  }));
}

/**
 * 「このオブジェクトのこの項目にこの値を割り当てる」を LLM に渡す
 * (詳細設計: field-writes / processing-detail-narrative)。
 */
function fieldWritesContext(
  writes: readonly ApexFieldWriteInfo[] | undefined,
): readonly Record<string, unknown>[] {
  return (writes ?? []).map((w) => ({
    object: w.object,
    field: w.field,
    value: w.valueExpr,
    operation: w.operation ?? null,
    method: w.methodName ?? null,
  }));
}

/** Flow のレコード取得・絞り込みを LLM に渡す (詳細設計: query-detail)。 */
function flowRecordDetailContext(
  elements: readonly FlowElementInfo[] | undefined,
): readonly Record<string, unknown>[] {
  return (elements ?? [])
    .filter(
      (e) =>
        (e.queriedFields?.length ?? 0) > 0 ||
        (e.filters?.length ?? 0) > 0 ||
        e.sortField !== undefined ||
        e.getFirstRecordOnly !== undefined,
    )
    .map((e) => ({
      element: e.name,
      operation: e.kind,
      object: e.target ?? null,
      queriedFields: e.queriedFields ?? [],
      filters: (e.filters ?? []).map((f) => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      })),
      filterLogic: e.filterLogic ?? null,
      sortField: e.sortField ?? null,
      sortOrder: e.sortOrder ?? null,
      firstRecordOnly: e.getFirstRecordOnly ?? null,
    }));
}

/** Flow の項目への値割り当てを LLM に渡す (詳細設計: field-writes)。 */
function flowFieldAssignmentContext(
  elements: readonly FlowElementInfo[] | undefined,
): readonly Record<string, unknown>[] {
  return (elements ?? [])
    .filter((e) => (e.inputAssignments?.length ?? 0) > 0 || e.inputReference !== undefined)
    .map((e) => ({
      element: e.name,
      operation: e.kind,
      object: e.target ?? null,
      assignments: (e.inputAssignments ?? []).map((a) => ({ field: a.field, value: a.value })),
      inputReference: e.inputReference ?? null,
    }));
}

function unique<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

function countByKind<T extends { kind: string }>(arr: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of arr) out[a.kind] = (out[a.kind] ?? 0) + 1;
  return out;
}
