// ----------------------------------------------------------------------------
// 業務フロー (Business Flow) ビルダー (Phase 15)
//
// graph + domains.yaml から「組織で実行可能な業務操作」を抽出する。
// 1 業務フロー = (入口) → (処理) → (影響) のチェーン。
//
// 入口の検出は静的な signal のみ:
//   - ApexTrigger (データ変更が起点)
//   - @RestResource クラス / @HttpGet|@HttpPost|@HttpPut|@HttpDelete|@HttpPatch
//   - @AuraEnabled (LWC/Aura から呼ばれる)
//   - @InvocableMethod (Flow から呼ばれる)
//   - LWC 自身 (UI 起点)
//   - Schedulable / Batchable (クラス名/メソッド形状ヒューリスティック)
//
// LLM は呼ばない (決定的)。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import type {
  ApexClass,
  ApexTrigger,
  KnowledgeGraph,
  LightningWebComponent,
  SObject,
} from "../types/graph.js";
import { type LabelResolver, makeLabelResolver } from "./display.js";
import type { ComponentType } from "./sections.js";

export type FlowRole = "entry" | "process" | "data" | "downstream";

export interface FlowStep {
  readonly type: ComponentType;
  readonly name: string;
  /** 日本語ラベル (object/flow/lwc)。主表示に使う。無ければ undefined。 */
  readonly label?: string;
  readonly role: FlowRole;
  /** 「なぜここに居るか」の根拠 (例: "@RestResource", "beforeInsert", "DML insert") */
  readonly evidence: string;
}

export interface BusinessFlow {
  readonly id: string;
  readonly label: string;
  readonly scope: "domain" | "object";
  readonly entryPoints: readonly FlowStep[];
  readonly processing: readonly FlowStep[];
  readonly affectedData: readonly FlowStep[];
  readonly downstream: readonly FlowStep[];
  /** business-meaning ブロックから抽出 (filled の場合のみ) */
  readonly meaning?: string;
}

export interface BusinessFlowsPayload {
  readonly version: 1;
  readonly domainFlows: readonly BusinessFlow[];
  readonly objectFlows: readonly BusinessFlow[];
}

const ENTRY_METHOD_ANNOTATIONS = new Set([
  "AuraEnabled",
  "HttpGet",
  "HttpPost",
  "HttpPut",
  "HttpDelete",
  "HttpPatch",
  "InvocableMethod",
  "RemoteAction",
]);
const ENTRY_CLASS_ANNOTATIONS = new Set(["RestResource"]);

interface EntryClassification {
  readonly isEntry: boolean;
  readonly evidence: string;
}

function classifyApexEntry(cls: ApexClass): EntryClassification {
  if (cls.isTest) return { isEntry: false, evidence: "" };
  const body = cls.body;
  if (body === undefined) return { isEntry: false, evidence: "" };
  for (const a of body.classAnnotations) {
    if (ENTRY_CLASS_ANNOTATIONS.has(a)) return { isEntry: true, evidence: `@${a}` };
  }
  const entryMethod = body.methods.find((m) =>
    m.annotations.some((a) => ENTRY_METHOD_ANNOTATIONS.has(a)),
  );
  if (entryMethod !== undefined) {
    const tag = entryMethod.annotations.find((a) => ENTRY_METHOD_ANNOTATIONS.has(a));
    return { isEntry: true, evidence: `@${tag} (${entryMethod.name})` };
  }
  // クラス名末尾の Batch / Schedule ヒューリスティック (Phase 15 では弱い signal として採用)
  if (/Batch$/.test(cls.fullyQualifiedName)) return { isEntry: true, evidence: "Batchable 候補" };
  if (/Schedul/i.test(cls.fullyQualifiedName))
    return { isEntry: true, evidence: "Schedulable 候補" };
  return { isEntry: false, evidence: "" };
}

export function buildBusinessFlows(
  graph: KnowledgeGraph,
  domainsConfig?: DomainsConfig | null,
  meaningLookup?: Map<string, string>,
): BusinessFlowsPayload {
  // 実在 SObject 名のセット (Apex 抽出器が DML target に変数名を拾うことがあるため
  // フロー側で実在チェックして除外する)
  const knownObjects = new Set(graph.objects.map((o) => o.fullyQualifiedName));
  const domainFlows =
    domainsConfig === null || domainsConfig === undefined
      ? []
      : domainsConfig.domains.map((d) => buildDomainFlow(d, graph, meaningLookup, knownObjects));
  const objectFlows = graph.objects.map((o) =>
    buildObjectFlow(o, graph, meaningLookup, knownObjects),
  );
  // 各ステップに日本語ラベルを付与 (object/flow/lwc)。apex/trigger は API 名のまま。
  const resolveLabel = makeLabelResolver(graph);
  return {
    version: 1,
    domainFlows: domainFlows.map((f) => enrichFlowLabels(f, resolveLabel)),
    objectFlows: objectFlows.map((f) => enrichFlowLabels(f, resolveLabel)),
  };
}

function enrichFlowLabels(flow: BusinessFlow, resolveLabel: LabelResolver): BusinessFlow {
  const enrichStep = (s: FlowStep): FlowStep => {
    const label = resolveLabel(s.type, s.name);
    return label === undefined ? s : { ...s, label };
  };
  return {
    ...flow,
    entryPoints: flow.entryPoints.map(enrichStep),
    processing: flow.processing.map(enrichStep),
    affectedData: flow.affectedData.map(enrichStep),
    downstream: flow.downstream.map(enrichStep),
  };
}

function buildDomainFlow(
  d: DomainsConfig["domains"][number],
  graph: KnowledgeGraph,
  meaningLookup: Map<string, string> | undefined,
  knownObjects: Set<string>,
): BusinessFlow {
  const members = d.members;
  const memberApex = new Set<string>();
  const memberTrigger = new Set<string>();
  const memberLwc = new Set<string>();
  const memberObject = new Set<string>();
  for (const m of members) {
    if (m.type === "apex") memberApex.add(m.name);
    else if (m.type === "trigger") memberTrigger.add(m.name);
    else if (m.type === "lwc") memberLwc.add(m.name);
    else if (m.type === "object") memberObject.add(m.name);
  }

  const entryPoints: FlowStep[] = [];
  const processing: FlowStep[] = [];

  for (const trgName of memberTrigger) {
    const trg = graph.apexTriggers.find((t) => t.fullyQualifiedName === trgName);
    if (trg === undefined) continue;
    entryPoints.push({
      type: "trigger",
      name: trg.fullyQualifiedName,
      role: "entry",
      evidence: trg.events.join(" / "),
    });
  }
  for (const apexName of memberApex) {
    const cls = graph.apexClasses.find((c) => c.fullyQualifiedName === apexName);
    if (cls === undefined) continue;
    const c = classifyApexEntry(cls);
    if (c.isEntry) {
      entryPoints.push({
        type: "apex",
        name: cls.fullyQualifiedName,
        role: "entry",
        evidence: c.evidence,
      });
    } else if (!cls.isTest) {
      processing.push({
        type: "apex",
        name: cls.fullyQualifiedName,
        role: "process",
        evidence: methodSummary(cls),
      });
    }
  }
  for (const lwcName of memberLwc) {
    const lwc = graph.lwcs.find((l) => l.fullyQualifiedName === lwcName);
    if (lwc === undefined) continue;
    entryPoints.push({
      type: "lwc",
      name: lwc.fullyQualifiedName,
      role: "entry",
      evidence: lwc.isExposed ? "UI 公開" : "内部 LWC",
    });
  }

  // 影響データ: domain の object メンバー + 処理が write する object。
  // 全て graph.objects に実在する SObject のみに絞る。
  // - Apex 抽出器の DML target には変数名 (例: "lines", "updates") が混じる
  // - domains.yaml に Custom Metadata Type (例: "Tax_Setting__mdt") が
  //   object 種別で書かれていることがある (本来は別 type だが OSS では混同しがち)
  // どちらもクリックすると 404 になるため、ここで除外して安全側に倒す。
  const affectedObjectNames = new Set<string>();
  for (const m of memberObject) {
    if (knownObjects.has(m)) affectedObjectNames.add(m);
  }
  for (const apexName of memberApex) {
    const cls = graph.apexClasses.find((c) => c.fullyQualifiedName === apexName);
    for (const d of cls?.body?.dmlOperations ?? []) {
      if (knownObjects.has(d.target)) affectedObjectNames.add(d.target);
    }
  }
  for (const trgName of memberTrigger) {
    const trg = graph.apexTriggers.find((t) => t.fullyQualifiedName === trgName);
    for (const d of trg?.body?.dmlOperations ?? []) {
      if (knownObjects.has(d.target)) affectedObjectNames.add(d.target);
    }
    if (trg !== undefined && knownObjects.has(trg.object)) affectedObjectNames.add(trg.object);
  }
  const affectedData: FlowStep[] = Array.from(affectedObjectNames).map((name) => ({
    type: "object",
    name,
    role: "data",
    evidence: dmlEvidenceFor(name, graph, memberApex, memberTrigger),
  }));

  // 下流: このドメインが書き込む object に別ドメインのトリガがあれば ripple
  const downstreamSet = new Map<string, string>();
  for (const objName of affectedObjectNames) {
    for (const t of graph.apexTriggers) {
      if (t.object === objName && !memberTrigger.has(t.fullyQualifiedName)) {
        downstreamSet.set(t.fullyQualifiedName, `${objName} の変更で発火`);
      }
    }
    for (const f of graph.flows) {
      if (
        (f.triggeringObject === objName || (f.body?.recordObjects ?? []).includes(objName)) &&
        !members.some((m) => m.type === "flow" && m.name === f.fullyQualifiedName)
      ) {
        downstreamSet.set(`flow:${f.fullyQualifiedName}`, `${objName} を参照する別ドメイン Flow`);
      }
    }
  }
  const downstream: FlowStep[] = Array.from(downstreamSet.entries()).map(
    ([keyOrName, evidence]) => {
      if (keyOrName.startsWith("flow:")) {
        return { type: "flow", name: keyOrName.slice(5), role: "downstream", evidence };
      }
      return { type: "trigger", name: keyOrName, role: "downstream", evidence };
    },
  );

  // meaning は entry の最初の Apex/Trigger/LWC から拾う (ない場合は domain 名のみ)
  const meaning = pickMeaning(entryPoints.concat(processing), meaningLookup);

  return {
    id: `domain:${d.id}`,
    label: d.label,
    scope: "domain",
    entryPoints,
    processing,
    affectedData,
    downstream,
    ...(meaning !== undefined ? { meaning } : {}),
  };
}

function buildObjectFlow(
  obj: SObject,
  graph: KnowledgeGraph,
  meaningLookup: Map<string, string> | undefined,
  knownObjects: Set<string>,
): BusinessFlow {
  const name = obj.fullyQualifiedName;
  // 入口: このオブジェクトに対するトリガ + DML/SOQL を行う @RestResource/@AuraEnabled
  const entryPoints: FlowStep[] = [];
  const processing: FlowStep[] = [];
  const downstream: FlowStep[] = [];

  for (const t of graph.apexTriggers.filter((t) => t.object === name)) {
    entryPoints.push({
      type: "trigger",
      name: t.fullyQualifiedName,
      role: "entry",
      evidence: t.events.join(" / "),
    });
  }
  const touchingApex = graph.apexClasses.filter(
    (c) =>
      !c.isTest &&
      ((c.body?.soqlQueries ?? []).some((q) => q.primaryObject === name) ||
        (c.body?.dmlOperations ?? []).some((d) => d.target === name)),
  );
  for (const c of touchingApex) {
    const cl = classifyApexEntry(c);
    if (cl.isEntry) {
      entryPoints.push({
        type: "apex",
        name: c.fullyQualifiedName,
        role: "entry",
        evidence: cl.evidence,
      });
    } else {
      processing.push({
        type: "apex",
        name: c.fullyQualifiedName,
        role: "process",
        evidence: apexTouchEvidence(c, name),
      });
    }
  }
  // UI 起点: LWC で apexImports が touchingApex を呼ぶもの
  for (const lwc of graph.lwcs) {
    const hits = lwc.apexImports.filter((a) =>
      touchingApex.some((c) => c.fullyQualifiedName === a.className),
    );
    if (hits.length > 0) {
      entryPoints.push({
        type: "lwc",
        name: lwc.fullyQualifiedName,
        role: "entry",
        evidence: `${hits[0]?.className}.${hits[0]?.methodName} を呼出`,
      });
    }
  }

  // 影響データ: この object 自身 + 処理が他に DML する object (実在 SObject のみ)
  const writeTargets = new Set<string>();
  writeTargets.add(name);
  for (const c of touchingApex) {
    for (const d of c.body?.dmlOperations ?? []) {
      if (knownObjects.has(d.target)) writeTargets.add(d.target);
    }
  }
  for (const t of graph.apexTriggers.filter((t) => t.object === name)) {
    for (const d of t.body?.dmlOperations ?? []) {
      if (knownObjects.has(d.target)) writeTargets.add(d.target);
    }
  }
  const affectedData: FlowStep[] = Array.from(writeTargets).map((n) => ({
    type: "object",
    name: n,
    role: "data",
    evidence: n === name ? "対象オブジェクト" : "間接更新",
  }));

  // 下流: writeTargets 上の他トリガ / Flow
  for (const target of writeTargets) {
    if (target === name) continue;
    for (const t of graph.apexTriggers.filter((tt) => tt.object === target)) {
      downstream.push({
        type: "trigger",
        name: t.fullyQualifiedName,
        role: "downstream",
        evidence: `${target} の変更で発火`,
      });
    }
  }
  for (const f of graph.flows) {
    if (f.triggeringObject === name || (f.body?.recordObjects ?? []).includes(name)) {
      downstream.push({
        type: "flow",
        name: f.fullyQualifiedName,
        role: "downstream",
        evidence: `${name} を参照`,
      });
    }
  }

  // object scope では「object 自身の meaning」のみを採用する。
  // 他 component の meaning を流用すると「請求 → AccountBalanceService の説明」のような
  // 不整合が起きるため、自オブジェクトに meaning がなければ undefined のまま。
  const meaning = pickMeaning(
    [{ type: "object", name, role: "data", evidence: "" }],
    meaningLookup,
  );

  return {
    id: `object:${name}`,
    label: `${obj.label} (${name})`,
    scope: "object",
    entryPoints,
    processing,
    affectedData,
    downstream: dedupSteps(downstream),
    ...(meaning !== undefined ? { meaning } : {}),
  };
}

function methodSummary(cls: ApexClass): string {
  const n = cls.body?.methods.length ?? 0;
  const soql = cls.body?.soqlQueries.length ?? 0;
  const dml = cls.body?.dmlOperations.length ?? 0;
  return `${n} methods / SOQL ${soql} / DML ${dml}`;
}

function apexTouchEvidence(c: ApexClass, objectName: string): string {
  const soql = (c.body?.soqlQueries ?? []).filter((q) => q.primaryObject === objectName).length;
  const dml = (c.body?.dmlOperations ?? []).filter((d) => d.target === objectName);
  const dmlKinds = Array.from(new Set(dml.map((d) => d.kind)));
  const parts: string[] = [];
  if (soql > 0) parts.push(`SOQL ${soql}`);
  if (dmlKinds.length > 0) parts.push(`DML ${dmlKinds.join(",")}`);
  return parts.join(" / ") || "参照";
}

function dmlEvidenceFor(
  objectName: string,
  graph: KnowledgeGraph,
  memberApex: Set<string>,
  memberTrigger: Set<string>,
): string {
  let inserts = 0;
  let updates = 0;
  let deletes = 0;
  const tally = (kind: string): void => {
    if (kind === "insert" || kind === "upsert") inserts++;
    else if (kind === "update") updates++;
    else if (kind === "delete" || kind === "undelete") deletes++;
  };
  for (const apexName of memberApex) {
    const cls = graph.apexClasses.find((c) => c.fullyQualifiedName === apexName);
    for (const d of cls?.body?.dmlOperations ?? []) {
      if (d.target === objectName) tally(d.kind);
    }
  }
  for (const trgName of memberTrigger) {
    const trg = graph.apexTriggers.find((t) => t.fullyQualifiedName === trgName);
    for (const d of trg?.body?.dmlOperations ?? []) {
      if (d.target === objectName) tally(d.kind);
    }
  }
  const parts: string[] = [];
  if (inserts > 0) parts.push(`insert ${inserts}`);
  if (updates > 0) parts.push(`update ${updates}`);
  if (deletes > 0) parts.push(`delete ${deletes}`);
  if (parts.length === 0) return "domain member";
  return parts.join(" / ");
}

function pickMeaning(
  candidates: readonly FlowStep[],
  lookup: Map<string, string> | undefined,
): string | undefined {
  if (lookup === undefined || lookup.size === 0) return undefined;
  for (const c of candidates) {
    const key = `${c.type}:${c.name}`;
    const m = lookup.get(key);
    if (m !== undefined && m.trim() !== "") return m;
  }
  return undefined;
}

function dedupSteps(steps: readonly FlowStep[]): FlowStep[] {
  const seen = new Set<string>();
  const out: FlowStep[] = [];
  for (const s of steps) {
    const key = `${s.type}:${s.name}:${s.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
