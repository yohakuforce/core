// ----------------------------------------------------------------------------
// .yohaku/coverage.json の load / save
// ----------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CoverageReport } from "./types.js";
import { CoverageParseError } from "./types.js";

export function loadCoverageJson(path: string): CoverageReport | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CoverageParseError(`${path}: JSON parse error: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new CoverageParseError(`${path}: root must be an object`);
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== 1) {
    throw new CoverageParseError(`${path}: unsupported version ${String(o.version)}`);
  }
  if (!Array.isArray(o.entries)) {
    throw new CoverageParseError(`${path}: entries must be an array`);
  }
  return parsed as CoverageReport;
}

export function saveCoverageJson(path: string, report: CoverageReport): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
}

/**
 * Apex 名 → CoverageEntry の Map を作って返す (高速 lookup 用)。
 */
export function buildCoverageLookup(
  report: CoverageReport | null | undefined,
): Map<string, CoverageReport["entries"][number]> {
  const m = new Map<string, CoverageReport["entries"][number]>();
  if (report === null || report === undefined) return m;
  for (const e of report.entries) m.set(e.apexName, e);
  return m;
}
