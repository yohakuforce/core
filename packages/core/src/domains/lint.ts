// ----------------------------------------------------------------------------
// domains.yaml の Lint
//
// 検出項目:
//   - 重複 domain id
//   - 同一コンポーネントが複数 primary domain に属している
//   - graph に存在しないメンバ参照 (orphan)
//   - graph にあるが domains.yaml に未登場 (uncovered)
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";
import type { KnowledgeGraph } from "../types/graph.js";
import type { DomainsConfig } from "./types.js";

export type LintSeverity = "error" | "warning" | "info";

export interface LintFinding {
  readonly severity: LintSeverity;
  readonly code: string;
  readonly message: string;
  readonly domain?: string;
  readonly member?: { type: string; name: string };
}

export interface LintReport {
  readonly findings: readonly LintFinding[];
  readonly hasErrors: boolean;
}

export function lintDomains(
  config: DomainsConfig,
  graph: KnowledgeGraph,
): LintReport {
  const findings: LintFinding[] = [];
  const seenIds = new Set<string>();
  const memberOwners = new Map<string, string[]>();
  const graphMembers = collectGraphMembers(graph);

  for (const d of config.domains) {
    if (seenIds.has(d.id)) {
      findings.push({
        severity: "error",
        code: "duplicate_id",
        message: `domain id "${d.id}" appears more than once`,
        domain: d.id,
      });
    }
    seenIds.add(d.id);

    for (const m of d.members) {
      const key = `${m.type}:${m.name}`;
      const owners = memberOwners.get(key) ?? [];
      owners.push(d.id);
      memberOwners.set(key, owners);

      if (!graphMembers.has(key)) {
        findings.push({
          severity: "warning",
          code: "orphan_member",
          message: `member ${key} listed in domain "${d.id}" but not found in graph`,
          domain: d.id,
          member: { type: m.type, name: m.name },
        });
      }
    }
  }

  for (const [key, owners] of memberOwners) {
    if (owners.length > 1) {
      findings.push({
        severity: "error",
        code: "member_in_multiple_primary",
        message: `${key} appears as primary in multiple domains: ${owners.join(", ")}`,
        member: parseKey(key),
      });
    }
  }

  for (const key of graphMembers) {
    if (!memberOwners.has(key)) {
      findings.push({
        severity: "info",
        code: "uncovered_member",
        message: `${key} is in the graph but not listed in any domain (becomes Unclassified)`,
        member: parseKey(key),
      });
    }
  }

  return {
    findings,
    hasErrors: findings.some((f) => f.severity === "error"),
  };
}

function collectGraphMembers(graph: KnowledgeGraph): Set<string> {
  const out = new Set<string>();
  for (const c of graph.apexClasses) {
    if (!c.isTest) out.add(`apex:${c.fullyQualifiedName}`);
  }
  for (const t of graph.apexTriggers) out.add(`trigger:${t.fullyQualifiedName}`);
  for (const l of graph.lwcs) out.add(`lwc:${l.fullyQualifiedName}`);
  for (const o of graph.objects) out.add(`object:${o.fullyQualifiedName}`);
  for (const f of graph.flows) out.add(`flow:${f.fullyQualifiedName}`);
  return out;
}

function parseKey(key: string): { type: string; name: string } {
  const idx = key.indexOf(":");
  if (idx < 0) return { type: "unknown", name: key };
  return { type: key.slice(0, idx), name: key.slice(idx + 1) };
}

/**
 * domains.yaml に存在しない graph メンバを "unclassified" ドメインに追記して
 * 同期させた DomainsConfig を返す。既存ドメインの並びは保つ。
 */
export function syncDomains(
  config: DomainsConfig,
  graph: KnowledgeGraph,
): DomainsConfig {
  const graphMembers = collectGraphMembers(graph);
  const known = new Set<string>();
  for (const d of config.domains) {
    for (const m of d.members) known.add(`${m.type}:${m.name}`);
  }
  const missing: { type: ComponentType; name: string }[] = [];
  for (const key of graphMembers) {
    if (known.has(key)) continue;
    const idx = key.indexOf(":");
    const type = key.slice(0, idx) as ComponentType;
    const name = key.slice(idx + 1);
    missing.push({ type, name });
  }

  if (missing.length === 0) return config;

  const existingUnclassified = config.domains.find((d) => d.id === "unclassified");
  const others = config.domains.filter((d) => d.id !== "unclassified");
  const unclassified = {
    id: "unclassified",
    label: "Unclassified",
    description:
      existingUnclassified?.description ??
      "Components not yet assigned to a domain.",
    members: [...(existingUnclassified?.members ?? []), ...missing],
  };
  return {
    version: 1,
    domains: [...others, unclassified],
    ...(config.notes !== undefined ? { notes: config.notes } : {}),
  };
}
