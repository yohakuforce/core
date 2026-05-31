// ----------------------------------------------------------------------------
// domains.yaml の load / save
// ----------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import YAML from "yaml";
import type { ComponentType } from "../html/sections.js";
import { COMPONENT_TYPES } from "../html/sections.js";
import type { DomainDef, DomainMemberRef, DomainsConfig } from "./types.js";

export class DomainsYamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainsYamlError";
  }
}

export function loadDomainsYaml(path: string): DomainsConfig | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    throw new DomainsYamlError(`${path}: YAML parse error: ${(err as Error).message}`);
  }
  return validateConfig(parsed, path);
}

export function saveDomainsYaml(path: string, config: DomainsConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  const doc = YAML.stringify(config, { lineWidth: 120 });
  writeFileSync(path, doc, "utf8");
}

function validateConfig(parsed: unknown, path: string): DomainsConfig {
  if (parsed === null || typeof parsed !== "object") {
    throw new DomainsYamlError(`${path}: root must be a mapping`);
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new DomainsYamlError(`${path}: unsupported version ${String(obj.version)}, expected 1`);
  }
  const rawDomains = obj.domains;
  if (!Array.isArray(rawDomains)) {
    throw new DomainsYamlError(`${path}: domains must be an array`);
  }
  const domains: DomainDef[] = rawDomains.map((d, i) => validateDomain(d, `${path}.domains[${i}]`));
  const notes = typeof obj.notes === "string" ? obj.notes : undefined;
  return notes === undefined ? { version: 1, domains } : { version: 1, domains, notes };
}

function validateDomain(d: unknown, where: string): DomainDef {
  if (d === null || typeof d !== "object") {
    throw new DomainsYamlError(`${where}: must be a mapping`);
  }
  const obj = d as Record<string, unknown>;
  if (typeof obj.id !== "string" || obj.id.trim() === "") {
    throw new DomainsYamlError(`${where}.id must be a non-empty string`);
  }
  if (typeof obj.label !== "string" || obj.label.trim() === "") {
    throw new DomainsYamlError(`${where}.label must be a non-empty string`);
  }
  const rawMembers = obj.members;
  const members: DomainMemberRef[] = Array.isArray(rawMembers)
    ? rawMembers.map((m, i) => validateMember(m, `${where}.members[${i}]`))
    : [];
  const description = typeof obj.description === "string" ? obj.description : undefined;
  return description === undefined
    ? { id: obj.id, label: obj.label, members }
    : { id: obj.id, label: obj.label, description, members };
}

function validateMember(m: unknown, where: string): DomainMemberRef {
  if (m === null || typeof m !== "object") {
    throw new DomainsYamlError(`${where}: must be a mapping`);
  }
  const obj = m as Record<string, unknown>;
  if (typeof obj.type !== "string" || !(COMPONENT_TYPES as readonly string[]).includes(obj.type)) {
    throw new DomainsYamlError(`${where}.type must be one of: ${COMPONENT_TYPES.join(", ")}`);
  }
  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    throw new DomainsYamlError(`${where}.name must be a non-empty string`);
  }
  return { type: obj.type as ComponentType, name: obj.name };
}
