// ----------------------------------------------------------------------------
// HTML ホーム用 JSON データ生成
//
// 描画はクライアントサイド (assets/home.js) で行い、ここでは「決定的に」JSON を
// 吐く。tab 切替時の描画ロジックは home.html + home.js が data/*.json を fetch
// して使う。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import {
  type Concern,
  type ConcernSeverity,
  concernsForApex,
  concernsForFlow,
  concernsForTrigger,
} from "../render/concerns.js";
import type { KnowledgeGraph } from "../types/graph.js";
import { makeLabelResolver } from "./display.js";
import type { ComponentType } from "./sections.js";

export interface ComponentStat {
  readonly type: string;
  readonly count: number;
  /** 該当タイプ内の平均サイズ (LOC / elements / fields / methods 等) */
  readonly avgSize: number;
  /** 該当タイプ内の最大サイズ */
  readonly maxSize: number;
}

export interface StatsPayload {
  readonly totals: { readonly components: number };
  readonly byType: readonly ComponentStat[];
  /** generated at (ISO) */
  readonly generatedAt: string;
}

export function buildStats(graph: KnowledgeGraph): StatsPayload {
  const apexSizes = graph.apexClasses.map((c) => c.linesOfCode ?? 0);
  const triggerSizes = graph.apexTriggers.map((t) => t.body?.methods.length ?? 0);
  const lwcSizes = graph.lwcs.map((l) => l.publicProperties.length + l.customEvents.length);
  const objectSizes = graph.objects.map(
    (o) => graph.fields.filter((f) => f.object === o.fullyQualifiedName).length,
  );
  const flowSizes = graph.flows.map((f) => f.body?.elements.length ?? 0);

  const byType: ComponentStat[] = [
    { type: "apex", count: graph.apexClasses.length, ...statsOf(apexSizes) },
    { type: "trigger", count: graph.apexTriggers.length, ...statsOf(triggerSizes) },
    { type: "lwc", count: graph.lwcs.length, ...statsOf(lwcSizes) },
    { type: "object", count: graph.objects.length, ...statsOf(objectSizes) },
    { type: "flow", count: graph.flows.length, ...statsOf(flowSizes) },
  ];

  return {
    totals: { components: byType.reduce((sum, t) => sum + t.count, 0) },
    byType,
    generatedAt: graph.meta.builtAt,
  };
}

function statsOf(sizes: readonly number[]): { avgSize: number; maxSize: number } {
  if (sizes.length === 0) return { avgSize: 0, maxSize: 0 };
  const max = sizes.reduce((m, s) => Math.max(m, s), 0);
  const sum = sizes.reduce((s, v) => s + v, 0);
  return { avgSize: Math.round(sum / sizes.length), maxSize: max };
}

// ----------------------------------------------------------------------------
// Architecture
// ----------------------------------------------------------------------------

export interface ArchNode {
  readonly id: string;
  /** 主表示: 日本語ラベル (無ければ API 名)。 */
  readonly label: string;
  /** API 名 (fullyQualifiedName)。label と異なる場合のみ副表示する。 */
  readonly apiName: string;
  readonly type: "object" | "apex" | "trigger" | "flow" | "lwc";
}

export interface ArchEdge {
  readonly from: string;
  readonly to: string;
  /** uses / triggers / queries / references */
  readonly kind: string;
}

export interface ArchitecturePayload {
  readonly nodes: readonly ArchNode[];
  readonly edges: readonly ArchEdge[];
}

const ARCH_NODE_LIMIT = 80;

export function buildArchitecture(graph: KnowledgeGraph): ArchitecturePayload {
  // 大規模 org でも崩れないよう、ノード数に上限を設けて主要オブジェクト/Apex/Flow に絞る
  const objects = topNObjectsByConnectivity(graph, 30);
  const apex = topNApexByReferences(graph, 30);
  const triggers = graph.apexTriggers.slice(0, 20);
  const flows = graph.flows.slice(0, 20);
  const resolveLabel = makeLabelResolver(graph);
  const node = (type: ComponentType, fqn: string): ArchNode => ({
    id: nodeId(type, fqn),
    label: resolveLabel(type, fqn) ?? fqn,
    apiName: fqn,
    type: type as ArchNode["type"],
  });

  const nodes: ArchNode[] = [
    ...objects.map((o) => node("object", o.fullyQualifiedName)),
    ...apex.map((c) => node("apex", c.fullyQualifiedName)),
    ...triggers.map((t) => node("trigger", t.fullyQualifiedName)),
    ...flows.map((f) => node("flow", f.fullyQualifiedName)),
  ].slice(0, ARCH_NODE_LIMIT);

  const nodeSet = new Set(nodes.map((n) => n.id));
  const edges: ArchEdge[] = [];

  for (const cls of apex) {
    const from = nodeId("apex", cls.fullyQualifiedName);
    if (!nodeSet.has(from)) continue;
    for (const q of cls.body?.soqlQueries ?? []) {
      if (q.primaryObject !== null) {
        const to = nodeId("object", q.primaryObject);
        if (nodeSet.has(to)) edges.push({ from, to, kind: "queries" });
      }
    }
    for (const d of cls.body?.dmlOperations ?? []) {
      const to = nodeId("object", d.target);
      if (nodeSet.has(to)) edges.push({ from, to, kind: "writes" });
    }
    for (const r of cls.body?.classReferences ?? []) {
      const to = nodeId("apex", r.className);
      if (nodeSet.has(to)) edges.push({ from, to, kind: "uses" });
    }
  }

  for (const trg of triggers) {
    const from = nodeId("trigger", trg.fullyQualifiedName);
    if (!nodeSet.has(from)) continue;
    const to = nodeId("object", trg.object);
    if (nodeSet.has(to)) edges.push({ from, to, kind: "triggers" });
    for (const r of trg.body?.classReferences ?? []) {
      const apexTo = nodeId("apex", r.className);
      if (nodeSet.has(apexTo)) edges.push({ from, to: apexTo, kind: "uses" });
    }
  }

  for (const flow of flows) {
    const from = nodeId("flow", flow.fullyQualifiedName);
    if (!nodeSet.has(from)) continue;
    for (const obj of flow.body?.recordObjects ?? []) {
      const to = nodeId("object", obj);
      if (nodeSet.has(to)) edges.push({ from, to, kind: "writes" });
    }
  }

  return { nodes, edges: dedupeEdges(edges) };
}

function nodeId(type: string, name: string): string {
  return `${type}:${name}`;
}

function dedupeEdges(edges: readonly ArchEdge[]): ArchEdge[] {
  const seen = new Set<string>();
  const out: ArchEdge[] = [];
  for (const e of edges) {
    const key = `${e.from}->${e.to}#${e.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function topNObjectsByConnectivity(graph: KnowledgeGraph, n: number): KnowledgeGraph["objects"] {
  const score = new Map<string, number>();
  for (const cls of graph.apexClasses) {
    for (const q of cls.body?.soqlQueries ?? []) {
      if (q.primaryObject !== null) {
        score.set(q.primaryObject, (score.get(q.primaryObject) ?? 0) + 1);
      }
    }
    for (const d of cls.body?.dmlOperations ?? []) {
      score.set(d.target, (score.get(d.target) ?? 0) + 1);
    }
  }
  for (const trg of graph.apexTriggers) {
    score.set(trg.object, (score.get(trg.object) ?? 0) + 2);
  }
  for (const flow of graph.flows) {
    for (const obj of flow.body?.recordObjects ?? []) {
      score.set(obj, (score.get(obj) ?? 0) + 1);
    }
  }
  return [...graph.objects]
    .sort((a, b) => (score.get(b.fullyQualifiedName) ?? 0) - (score.get(a.fullyQualifiedName) ?? 0))
    .slice(0, n);
}

function topNApexByReferences(graph: KnowledgeGraph, n: number): KnowledgeGraph["apexClasses"] {
  const score = new Map<string, number>();
  for (const cls of graph.apexClasses) {
    score.set(
      cls.fullyQualifiedName,
      (cls.body?.methods.length ?? 0) +
        (cls.body?.soqlQueries.length ?? 0) +
        (cls.body?.dmlOperations.length ?? 0),
    );
  }
  return [...graph.apexClasses]
    .filter((c) => !c.isTest)
    .sort((a, b) => (score.get(b.fullyQualifiedName) ?? 0) - (score.get(a.fullyQualifiedName) ?? 0))
    .slice(0, n);
}

// ----------------------------------------------------------------------------
// Domains
// ----------------------------------------------------------------------------

export interface DomainMember {
  readonly type: string;
  readonly name: string;
  /** 日本語ラベル (object/flow/lwc)。無ければ undefined。 */
  readonly label?: string;
}

export interface DomainPayload {
  readonly id: string;
  readonly label: string;
  readonly members: readonly DomainMember[];
}

export interface DomainsPayload {
  readonly domains: readonly DomainPayload[];
  /** ドメインに割り当てられていないコンポーネント数 */
  readonly unclassifiedCount: number;
}

export function buildDomains(
  graph: KnowledgeGraph,
  domainsConfig?: DomainsConfig | null,
): DomainsPayload {
  const resolveLabel = makeLabelResolver(graph);
  const withLabel = (type: string, name: string): DomainMember => {
    const label = resolveLabel(type as ComponentType, name);
    return label === undefined ? { type, name } : { type, name, label };
  };

  // 優先順位: domains.yaml (Phase 5 で正本) > graph.tags (Phase 4 までの簡易方式)
  if (domainsConfig !== undefined && domainsConfig !== null) {
    const claimed = new Set<string>();
    const domains: DomainPayload[] = [];
    for (const d of domainsConfig.domains) {
      const members: DomainMember[] = d.members.map((m) => withLabel(m.type, m.name));
      for (const m of members) claimed.add(`${m.type}:${m.name}`);
      domains.push({ id: d.id, label: d.label, members });
    }
    const totalComponents =
      graph.apexClasses.filter((c) => !c.isTest).length +
      graph.apexTriggers.length +
      graph.lwcs.length +
      graph.objects.length +
      graph.flows.length;
    const unclassifiedCount = Math.max(0, totalComponents - claimed.size);
    return { domains, unclassifiedCount };
  }

  const byDomain = new Map<string, DomainMember[]>();
  const claimed = new Set<string>();

  for (const tag of graph.tags) {
    if (tag.namespace !== "domain") continue;
    const k = tag.value;
    const member: DomainMember = withLabel(
      entityKindToType(tag.entity.kind),
      tag.entity.fullyQualifiedName,
    );
    const list = byDomain.get(k) ?? [];
    list.push(member);
    byDomain.set(k, list);
    claimed.add(`${member.type}:${member.name}`);
  }

  const domains: DomainPayload[] = [];
  for (const [id, members] of byDomain) {
    domains.push({ id, label: id, members });
  }
  domains.sort((a, b) => a.id.localeCompare(b.id));

  const totalComponents =
    graph.apexClasses.length +
    graph.apexTriggers.length +
    graph.lwcs.length +
    graph.objects.length +
    graph.flows.length;
  const unclassifiedCount = totalComponents - claimed.size;

  return { domains, unclassifiedCount };
}

function entityKindToType(kind: string): string {
  if (kind === "apexClass") return "apex";
  if (kind === "apexTrigger") return "trigger";
  if (kind === "object") return "object";
  if (kind === "lwc") return "lwc";
  if (kind === "flow") return "flow";
  return kind;
}

// ----------------------------------------------------------------------------
// Hotspots (Phase 4 で git 連携を入れる; Phase 3 ではプレースホルダ)
// ----------------------------------------------------------------------------

export interface HotspotReason {
  readonly severity: ConcernSeverity;
  readonly title: string;
  readonly detail?: string;
}

export interface HotspotItem {
  readonly type: ComponentType;
  /** API 名 (href 生成に使う) */
  readonly name: string;
  /** 日本語ラベル (object/flow/lwc)。無ければ undefined。 */
  readonly label?: string;
  /** 注目度スコア (大きいほど要注意) */
  readonly score: number;
  /** reasons 中の最大深刻度 */
  readonly severity: ConcernSeverity;
  readonly reasons: readonly HotspotReason[];
}

export interface HotspotsPayload {
  readonly items: readonly HotspotItem[];
  readonly note: string;
}

const SEVERITY_WEIGHT = new Map<ConcernSeverity, number>([
  ["HIGH", 5],
  ["MEDIUM", 2],
  ["INFO", 1],
]);
const SEVERITY_RANK = new Map<ConcernSeverity, number>([
  ["HIGH", 3],
  ["MEDIUM", 2],
  ["INFO", 1],
]);
const weightOf = (s: ConcernSeverity): number => SEVERITY_WEIGHT.get(s) ?? 0;
const rankOf = (s: ConcernSeverity): number => SEVERITY_RANK.get(s) ?? 0;
const HOTSPOT_LIMIT = 15;

// 依存集中度 (fan-in) のしきい値。これ以上 被参照されると「変更の影響範囲が広い」と判断。
const APEX_FANIN_MEDIUM = 3;
const APEX_FANIN_HIGH = 6;
const OBJECT_FANIN_MEDIUM = 5;
const OBJECT_FANIN_HIGH = 8;

/**
 * ホットスポット = 「いま注目すべきコンポーネント」を決定的に算出する。
 *
 * シグナル:
 *   1. 既存の懸念検出 (concernsForApex/Trigger/Flow) の深刻度
 *   2. 依存の集中度 (fan-in)。多く参照される Apex / オブジェクトは変更時の影響が広い
 *
 * 深刻度を重み付けして合算し、スコア降順で上位を返す (LLM 不使用・完全決定的)。
 * git の変更頻度 (churn) 連携は今後追加予定。
 */
export function buildHotspots(graph: KnowledgeGraph): HotspotsPayload {
  const resolveLabel = makeLabelResolver(graph);
  const items: HotspotItem[] = [];

  const add = (type: ComponentType, name: string, reasons: readonly HotspotReason[]): void => {
    if (reasons.length === 0) return;
    const score = reasons.reduce((s, r) => s + weightOf(r.severity), 0);
    const severity = reasons.reduce<ConcernSeverity>(
      (max, r) => (rankOf(r.severity) > rankOf(max) ? r.severity : max),
      "INFO",
    );
    const label = resolveLabel(type, name);
    items.push(
      label === undefined
        ? { type, name, score, severity, reasons }
        : { type, name, label, score, severity, reasons },
    );
  };

  for (const cls of graph.apexClasses) {
    if (cls.isTest) continue;
    const reasons = [...toReasons(concernsForApex(cls, graph))];
    appendFanIn(
      reasons,
      apexFanIn(graph, cls.fullyQualifiedName),
      APEX_FANIN_MEDIUM,
      APEX_FANIN_HIGH,
      (n) => `他コンポーネントから ${n} 箇所で参照 — 変更の影響範囲が広い`,
    );
    add("apex", cls.fullyQualifiedName, reasons);
  }

  for (const trg of graph.apexTriggers) {
    add("trigger", trg.fullyQualifiedName, toReasons(concernsForTrigger(trg, graph)));
  }

  for (const flow of graph.flows) {
    add("flow", flow.fullyQualifiedName, toReasons(concernsForFlow(flow)));
  }

  for (const obj of graph.objects) {
    const reasons: HotspotReason[] = [];
    appendFanIn(
      reasons,
      objectFanIn(graph, obj.fullyQualifiedName),
      OBJECT_FANIN_MEDIUM,
      OBJECT_FANIN_HIGH,
      (n) => `中心的オブジェクト — ${n} 箇所の処理が参照 / 更新`,
    );
    add("object", obj.fullyQualifiedName, reasons);
  }

  items.sort(
    (a, b) =>
      b.score - a.score || rankOf(b.severity) - rankOf(a.severity) || a.name.localeCompare(b.name),
  );

  return {
    items: items.slice(0, HOTSPOT_LIMIT),
    note:
      items.length === 0
        ? "注目すべき懸念・依存集中は検出されませんでした。"
        : "決定的シグナル（懸念検出＋依存の集中度）から要注意コンポーネントをスコア順に表示します。git の変更頻度（churn）連携は今後追加予定。",
  };
}

function toReasons(concerns: readonly Concern[]): HotspotReason[] {
  return concerns.map((c) => ({ severity: c.severity, title: c.title, detail: c.detail }));
}

function appendFanIn(
  reasons: HotspotReason[],
  fanIn: number,
  mediumAt: number,
  highAt: number,
  title: (n: number) => string,
): void {
  if (fanIn >= highAt) reasons.push({ severity: "HIGH", title: title(fanIn) });
  else if (fanIn >= mediumAt) reasons.push({ severity: "MEDIUM", title: title(fanIn) });
}

function apexFanIn(graph: KnowledgeGraph, fqn: string): number {
  let n = 0;
  for (const c of graph.apexClasses) {
    if (c.fullyQualifiedName === fqn) continue;
    if ((c.body?.classReferences ?? []).some((r) => r.className === fqn)) n++;
  }
  for (const t of graph.apexTriggers) {
    if ((t.body?.classReferences ?? []).some((r) => r.className === fqn)) n++;
  }
  return n;
}

function objectFanIn(graph: KnowledgeGraph, name: string): number {
  const refs = new Set<string>();
  for (const c of graph.apexClasses) {
    const touches =
      (c.body?.soqlQueries ?? []).some((q) => q.primaryObject === name) ||
      (c.body?.dmlOperations ?? []).some((d) => d.target === name);
    if (touches) refs.add(`apex:${c.fullyQualifiedName}`);
  }
  for (const t of graph.apexTriggers) {
    if (t.object === name) refs.add(`trigger:${t.fullyQualifiedName}`);
  }
  for (const f of graph.flows) {
    if (f.triggeringObject === name || (f.body?.recordObjects ?? []).includes(name)) {
      refs.add(`flow:${f.fullyQualifiedName}`);
    }
  }
  return refs.size;
}
