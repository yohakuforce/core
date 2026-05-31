// ----------------------------------------------------------------------------
// sf CLI 等が出すカバレッジ JSON のパーサ
//
// 想定入力 (代表 3 系列):
//   1. sf apex run test --code-coverage --result-format json
//      { status, result: { codecoverage: [{ name, type, numLinesCovered, ... }] } }
//   2. sf project deploy validate --test-level RunLocalTests --code-coverage --json
//      { result: { details: { runTestResult: { codeCoverage: [{ name, ... }] } } } }
//   3. 直接 normalized form (yohaku 自身の出力)
//      { version: 1, entries: [{ apexName, type, ... }] }
//
// 失敗時は CoverageParseError を投げる (拾える形式が見つからない場合)。
// ----------------------------------------------------------------------------

import type { CoverageApexType, CoverageEntry, CoverageReport } from "./types.js";
import { CoverageParseError } from "./types.js";

interface ParseContext {
  readonly source: string;
}

export function parseCoverageJson(raw: string, source: string): CoverageReport {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new CoverageParseError(`${source}: JSON parse error: ${(err as Error).message}`);
  }
  const ctx: ParseContext = { source };

  // Form 3: 直接 normalized
  if (isNormalized(value)) {
    return value;
  }

  // Form 1: sf apex run test
  const form1 = (value as Record<string, unknown> | null)?.result as
    | Record<string, unknown>
    | undefined;
  if (form1 !== undefined) {
    const arr =
      (form1.codecoverage as unknown[] | undefined) ?? (form1.coverage as unknown[] | undefined);
    if (Array.isArray(arr) && arr.length >= 0) {
      const summary = form1.summary as Record<string, unknown> | undefined;
      const orgWide = parsePercent(summary?.orgWideCoverage);
      const testRun = parsePercent(summary?.testRunCoverage);
      return buildReport(
        arr.map((e, i) => parseSfApexEntry(e, `${source}.result.codecoverage[${i}]`)),
        ctx,
        orgWide,
        testRun,
      );
    }
  }

  // Form 2: sf project deploy validate
  const dep = (value as Record<string, unknown>)?.result as Record<string, unknown> | undefined;
  const details = dep?.details as Record<string, unknown> | undefined;
  const rtr = details?.runTestResult as Record<string, unknown> | undefined;
  const cov2 = rtr?.codeCoverage as unknown[] | undefined;
  if (Array.isArray(cov2)) {
    return buildReport(
      cov2.map((e, i) =>
        parseDeployEntry(e, `${source}.result.details.runTestResult.codeCoverage[${i}]`),
      ),
      ctx,
    );
  }

  throw new CoverageParseError(
    `${source}: unrecognized format. Expected sf apex run test JSON, sf project deploy validate JSON, or yohaku normalized form.`,
  );
}

function isNormalized(value: unknown): value is CoverageReport {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.entries);
}

function buildReport(
  entries: readonly CoverageEntry[],
  ctx: ParseContext,
  orgWide?: number,
  testRun?: number,
): CoverageReport {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: ctx.source,
    ...(orgWide !== undefined ? { orgWideCoverage: orgWide } : {}),
    ...(testRun !== undefined ? { testRunCoverage: testRun } : {}),
    entries,
  };
}

function parseSfApexEntry(raw: unknown, where: string): CoverageEntry {
  if (raw === null || typeof raw !== "object") {
    throw new CoverageParseError(`${where}: not an object`);
  }
  const o = raw as Record<string, unknown>;
  const apexName = pickString(o, ["name", "apexName", "Name"]);
  const type = normalizeType(pickString(o, ["type", "Type"]) ?? "ApexClass", where);
  const numLinesCovered = pickNumber(o, ["numLinesCovered", "NumLinesCovered"]) ?? 0;
  const numLinesUncovered = pickNumber(o, ["numLinesUncovered", "NumLinesUncovered"]) ?? 0;
  const explicitPct = parsePercent(o.percentage ?? o.coveredPercent);
  const total = numLinesCovered + numLinesUncovered;
  const coveredPercent = explicitPct ?? (total === 0 ? 0 : round1((numLinesCovered / total) * 100));
  if (apexName === undefined) throw new CoverageParseError(`${where}: missing name`);
  return { apexName, type, numLinesCovered, numLinesUncovered, coveredPercent };
}

function parseDeployEntry(raw: unknown, where: string): CoverageEntry {
  if (raw === null || typeof raw !== "object") {
    throw new CoverageParseError(`${where}: not an object`);
  }
  const o = raw as Record<string, unknown>;
  const apexName = pickString(o, ["name", "Name"]);
  const type = normalizeType(pickString(o, ["type", "Type"]) ?? "ApexClass", where);
  const numLocations = pickNumber(o, ["numLocations"]) ?? 0;
  const numLocationsNotCovered = pickNumber(o, ["numLocationsNotCovered"]) ?? 0;
  const covered = Math.max(0, numLocations - numLocationsNotCovered);
  if (apexName === undefined) throw new CoverageParseError(`${where}: missing name`);
  const coveredPercent = numLocations === 0 ? 0 : round1((covered / numLocations) * 100);
  return {
    apexName,
    type,
    numLinesCovered: covered,
    numLinesUncovered: numLocationsNotCovered,
    coveredPercent,
  };
}

function pickString(o: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

function pickNumber(o: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function parsePercent(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return round1(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/%/g, "").trim();
    const n = Number(cleaned);
    if (!Number.isNaN(n)) return round1(n);
  }
  return undefined;
}

function normalizeType(t: string, where: string): CoverageApexType {
  if (t === "ApexClass" || t === "ApexTrigger") return t;
  // 一部 tooling では "Class" / "Trigger" の短縮形がある
  if (t === "Class") return "ApexClass";
  if (t === "Trigger") return "ApexTrigger";
  throw new CoverageParseError(`${where}: unknown type "${t}"`);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
