import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CoverageParseError,
  buildCoverageLookup,
  loadCoverageJson,
  parseCoverageJson,
  saveCoverageJson,
} from "../../../src/coverage/index.js";

describe("parseCoverageJson", () => {
  it("sf apex run test JSON (Form 1) を取り込める", () => {
    const raw = JSON.stringify({
      status: 0,
      result: {
        summary: { orgWideCoverage: "78%", testRunCoverage: "92%" },
        codecoverage: [
          {
            name: "AccountBalanceService",
            type: "ApexClass",
            numLinesCovered: 35,
            numLinesUncovered: 15,
          },
          {
            name: "OrderTrigger",
            type: "ApexTrigger",
            numLinesCovered: 10,
            numLinesUncovered: 0,
          },
        ],
      },
    });
    const report = parseCoverageJson(raw, "test-input");
    expect(report.entries).toHaveLength(2);
    expect(report.orgWideCoverage).toBe(78);
    expect(report.testRunCoverage).toBe(92);
    expect(report.entries[0]?.apexName).toBe("AccountBalanceService");
    expect(report.entries[0]?.coveredPercent).toBe(70); // 35/(35+15)*100
    expect(report.entries[1]?.coveredPercent).toBe(100);
  });

  it("deploy validate JSON (Form 2) を取り込める", () => {
    const raw = JSON.stringify({
      result: {
        details: {
          runTestResult: {
            codeCoverage: [
              { name: "Foo", type: "Class", numLocations: 40, numLocationsNotCovered: 10 },
              { name: "Bar", type: "Trigger", numLocations: 8, numLocationsNotCovered: 0 },
            ],
          },
        },
      },
    });
    const report = parseCoverageJson(raw, "deploy");
    expect(report.entries).toHaveLength(2);
    expect(report.entries[0]?.coveredPercent).toBe(75);
    expect(report.entries[0]?.type).toBe("ApexClass");
    expect(report.entries[1]?.type).toBe("ApexTrigger");
    expect(report.entries[1]?.coveredPercent).toBe(100);
  });

  it("yohaku normalized JSON (Form 3) はそのまま通る", () => {
    const orig = {
      version: 1,
      generatedAt: "2026-05-30T00:00:00Z",
      source: "manual",
      entries: [{ apexName: "X", type: "ApexClass", numLinesCovered: 1, numLinesUncovered: 1, coveredPercent: 50 }],
    };
    const report = parseCoverageJson(JSON.stringify(orig), "raw");
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.apexName).toBe("X");
  });

  it("認識できない形式は CoverageParseError", () => {
    expect(() => parseCoverageJson('{"foo": 1}', "bad")).toThrow(CoverageParseError);
  });

  it("壊れた JSON は CoverageParseError", () => {
    expect(() => parseCoverageJson("not json", "bad")).toThrow(CoverageParseError);
  });
});

describe("load / save / lookup", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "yohaku-cov-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("round trip", () => {
    const report = {
      version: 1 as const,
      generatedAt: "2026-05-30T00:00:00Z",
      source: "test",
      entries: [
        { apexName: "Foo", type: "ApexClass" as const, numLinesCovered: 5, numLinesUncovered: 5, coveredPercent: 50 },
      ],
    };
    const p = join(dir, "coverage.json");
    saveCoverageJson(p, report);
    const loaded = loadCoverageJson(p);
    expect(loaded).toEqual(report);
  });

  it("buildCoverageLookup で apexName → entry の Map", () => {
    const report = {
      version: 1 as const,
      generatedAt: "x",
      source: "x",
      entries: [
        { apexName: "A", type: "ApexClass" as const, numLinesCovered: 1, numLinesUncovered: 1, coveredPercent: 50 },
        { apexName: "B", type: "ApexClass" as const, numLinesCovered: 2, numLinesUncovered: 0, coveredPercent: 100 },
      ],
    };
    const m = buildCoverageLookup(report);
    expect(m.get("A")?.coveredPercent).toBe(50);
    expect(m.get("B")?.coveredPercent).toBe(100);
    expect(m.get("Z")).toBeUndefined();
  });

  it("null/undefined でも空 Map を返す", () => {
    expect(buildCoverageLookup(null).size).toBe(0);
    expect(buildCoverageLookup(undefined).size).toBe(0);
  });
});
