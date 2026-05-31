// ----------------------------------------------------------------------------
// HTML ホーム用 JSON データ生成
//
// 描画はクライアントサイド (assets/home.js) で行い、ここでは「決定的に」JSON を
// 吐く。tab 切替時の描画ロジックは home.html + home.js が data/*.json を fetch
// して使う。
// ----------------------------------------------------------------------------

import type { DomainsConfig } from "../domains/types.js";
import type { KnowledgeGraph } from "../types/graph.js";

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
  readonly label: string;
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

  const nodes: ArchNode[] = [
    ...objects.map<ArchNode>((o) => ({
      id: nodeId("object", o.fullyQualifiedName),
      label: o.fullyQualifiedName,
      type: "object",
    })),
    ...apex.map<ArchNode>((c) => ({
      id: nodeId("apex", c.fullyQualifiedName),
      label: c.fullyQualifiedName,
      type: "apex",
    })),
    ...triggers.map<ArchNode>((t) => ({
      id: nodeId("trigger", t.fullyQualifiedName),
      label: t.fullyQualifiedName,
      type: "trigger",
    })),
    ...flows.map<ArchNode>((f) => ({
      id: nodeId("flow", f.fullyQualifiedName),
      label: f.fullyQualifiedName,
      type: "flow",
    })),
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
  // 優先順位: domains.yaml (Phase 5 で正本) > graph.tags (Phase 4 までの簡易方式)
  if (domainsConfig !== undefined && domainsConfig !== null) {
    const claimed = new Set<string>();
    const domains: DomainPayload[] = [];
    for (const d of domainsConfig.domains) {
      const members: DomainMember[] = d.members.map((m) => ({ type: m.type, name: m.name }));
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
    const member: DomainMember = {
      type: entityKindToType(tag.entity.kind),
      name: tag.entity.fullyQualifiedName,
    };
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

export interface HotspotsPayload {
  readonly items: readonly {
    readonly type: string;
    readonly name: string;
    readonly reason: string;
  }[];
  readonly note: string;
}

export function buildHotspots(_graph: KnowledgeGraph): HotspotsPayload {
  return {
    items: [],
    note: "git 連携は Phase 4 で追加予定です。",
  };
}
