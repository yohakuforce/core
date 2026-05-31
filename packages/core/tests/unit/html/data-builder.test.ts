import { describe, expect, it } from "vitest";
import {
  buildArchitecture,
  buildDomains,
  buildHotspots,
  buildStats,
} from "../../../src/html/data-builder.js";
import type { KnowledgeGraph } from "../../../src/types/graph.js";

const META: KnowledgeGraph["meta"] = {
  yohakuVersion: "test",
  builtAt: "2026-05-30T00:00:00Z",
  sourceAdapter: "local",
  salesforceApiVersion: "62.0",
  sourceHash: "h",
};

const BASE = {
  meta: META,
  objects: [],
  fields: [],
  validationRules: [],
  flows: [],
  apexClasses: [],
  apexTriggers: [],
  permissionSets: [],
  profiles: [],
  recordTypes: [],
  approvalProcesses: [],
  sharingRules: [],
  layouts: [],
  customMetadataRecords: [],
  namedCredentials: [],
  remoteSiteSettings: [],
  lwcs: [],
  auraBundles: [],
  flexiPages: [],
  visualforcePages: [],
  visualforceComponents: [],
  customApplications: [],
  dependencies: [],
  tags: [],
} as const;

describe("buildStats", () => {
  it("空グラフでも 5 タイプ全てが byType に含まれる", () => {
    const stats = buildStats(BASE as KnowledgeGraph);
    expect(stats.byType).toHaveLength(5);
    expect(stats.totals.components).toBe(0);
  });

  it("Apex の LOC を avgSize/maxSize に集約する", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [
        {
          fullyQualifiedName: "A",
          apiVersion: "62.0",
          isTest: false,
          linesOfCode: 100,
          sourcePath: "A.cls",
          contentHash: "h",
        },
        {
          fullyQualifiedName: "B",
          apiVersion: "62.0",
          isTest: false,
          linesOfCode: 300,
          sourcePath: "B.cls",
          contentHash: "h",
        },
      ],
    };
    const stats = buildStats(graph);
    const apex = stats.byType.find((s) => s.type === "apex");
    expect(apex?.count).toBe(2);
    expect(apex?.avgSize).toBe(200);
    expect(apex?.maxSize).toBe(300);
  });
});

describe("buildArchitecture", () => {
  it("Apex から SOQL 対象オブジェクトへのエッジを張る", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      objects: [
        {
          fullyQualifiedName: "Account",
          label: "Account",
          isCustom: false,
          sourcePath: "x",
          contentHash: "h",
        },
      ],
      apexClasses: [
        {
          fullyQualifiedName: "AccountService",
          apiVersion: "62.0",
          isTest: false,
          sourcePath: "x.cls",
          contentHash: "h",
          body: {
            methods: [],
            soqlQueries: [{ raw: "SELECT Id FROM Account", primaryObject: "Account" }],
            dmlOperations: [],
            classReferences: [],
            classAnnotations: [],
            hasTryCatch: false,
            hasCallout: false,
          },
        },
      ],
    };
    const arch = buildArchitecture(graph);
    expect(arch.nodes.some((n) => n.id === "object:Account")).toBe(true);
    expect(arch.nodes.some((n) => n.id === "apex:AccountService")).toBe(true);
    expect(
      arch.edges.some(
        (e) =>
          e.from === "apex:AccountService" && e.to === "object:Account" && e.kind === "queries",
      ),
    ).toBe(true);
  });

  it("重複エッジは除去される", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      objects: [
        {
          fullyQualifiedName: "Account",
          label: "Account",
          isCustom: false,
          sourcePath: "x",
          contentHash: "h",
        },
      ],
      apexClasses: [
        {
          fullyQualifiedName: "AccountService",
          apiVersion: "62.0",
          isTest: false,
          sourcePath: "x.cls",
          contentHash: "h",
          body: {
            methods: [],
            soqlQueries: [
              { raw: "SELECT Id FROM Account", primaryObject: "Account" },
              { raw: "SELECT Name FROM Account", primaryObject: "Account" },
            ],
            dmlOperations: [],
            classReferences: [],
            classAnnotations: [],
            hasTryCatch: false,
            hasCallout: false,
          },
        },
      ],
    };
    const arch = buildArchitecture(graph);
    const queriesEdges = arch.edges.filter((e) => e.kind === "queries");
    expect(queriesEdges).toHaveLength(1);
  });
});

describe("buildDomains", () => {
  it("tags namespace=domain から domains を抽出する", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [
        {
          fullyQualifiedName: "AccountService",
          apiVersion: "62.0",
          isTest: false,
          sourcePath: "x.cls",
          contentHash: "h",
        },
      ],
      tags: [
        {
          entity: { kind: "apexClass", fullyQualifiedName: "AccountService" },
          namespace: "domain",
          value: "sales",
        },
      ],
    };
    const result = buildDomains(graph);
    expect(result.domains).toHaveLength(1);
    expect(result.domains[0]?.label).toBe("sales");
    expect(result.domains[0]?.members).toEqual([{ type: "apex", name: "AccountService" }]);
  });

  it("ドメイン未割当は unclassifiedCount に出る", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [
        {
          fullyQualifiedName: "A",
          apiVersion: "62.0",
          isTest: false,
          sourcePath: "A.cls",
          contentHash: "h",
        },
        {
          fullyQualifiedName: "B",
          apiVersion: "62.0",
          isTest: false,
          sourcePath: "B.cls",
          contentHash: "h",
        },
      ],
      tags: [
        {
          entity: { kind: "apexClass", fullyQualifiedName: "A" },
          namespace: "domain",
          value: "sales",
        },
      ],
    };
    const result = buildDomains(graph);
    expect(result.unclassifiedCount).toBe(1);
  });
});

describe("buildHotspots", () => {
  it("Phase 3 ではプレースホルダ", () => {
    const result = buildHotspots(BASE as KnowledgeGraph);
    expect(result.items).toEqual([]);
    expect(result.note).toContain("Phase 4");
  });
});
