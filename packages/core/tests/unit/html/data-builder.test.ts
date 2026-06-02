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
  it("空グラフでは items が空", () => {
    const result = buildHotspots(BASE as KnowledgeGraph);
    expect(result.items).toEqual([]);
    expect(result.note).toContain("検出されませんでした");
  });

  it("懸念のある Apex を理由つきでスコアリングする", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [
        {
          fullyQualifiedName: "PaymentService",
          apiVersion: "62.0",
          isTest: false,
          sourcePath: "PaymentService.cls",
          contentHash: "h",
          body: {
            hasCallout: true,
            hasTryCatch: false, // → HIGH: コールアウトに try/catch なし
            methods: [],
            soqlQueries: [],
            dmlOperations: [],
            classReferences: [],
            classAnnotations: [],
            controlFlows: [],
          },
        },
      ],
    } as unknown as KnowledgeGraph;
    const result = buildHotspots(graph);
    expect(result.items).toHaveLength(1);
    const top = result.items[0];
    expect(top?.name).toBe("PaymentService");
    expect(top?.severity).toBe("HIGH");
    expect(top?.score).toBeGreaterThan(0);
    // try/catch なし(HIGH) と 対応テストなし(MEDIUM) の 2 件
    expect(top?.reasons.some((r) => r.title.includes("try/catch"))).toBe(true);
  });

  it("被参照の多いオブジェクトを依存集中ホットスポットとして拾う", () => {
    const obj = (fqn: string) => ({
      fullyQualifiedName: fqn,
      label: fqn,
      isCustom: true,
      sourcePath: `${fqn}.object`,
      contentHash: "h",
    });
    const apex = (fqn: string, primaryObject: string) => ({
      fullyQualifiedName: fqn,
      apiVersion: "62.0",
      isTest: false,
      sourcePath: `${fqn}.cls`,
      contentHash: "h",
      body: {
        hasCallout: false,
        hasTryCatch: true,
        methods: [],
        soqlQueries: [{ primaryObject }],
        dmlOperations: [],
        classReferences: [],
        classAnnotations: [],
        controlFlows: [],
      },
    });
    const graph: KnowledgeGraph = {
      ...BASE,
      objects: [obj("Hub__c")],
      apexClasses: ["A", "B", "C", "D", "E"].map((n) => apex(n, "Hub__c")),
    } as unknown as KnowledgeGraph;
    const result = buildHotspots(graph);
    const hub = result.items.find((i) => i.name === "Hub__c");
    expect(hub).toBeDefined();
    expect(hub?.reasons.some((r) => r.title.includes("中心的オブジェクト"))).toBe(true);
  });

  it("スコア降順に並び、上限 15 件に収める", () => {
    const apexMany = Array.from({ length: 30 }, (_, i) => ({
      fullyQualifiedName: `Cls${String(i).padStart(2, "0")}`,
      apiVersion: "62.0",
      isTest: false,
      sourcePath: `Cls${i}.cls`,
      contentHash: "h",
      body: {
        hasCallout: true,
        hasTryCatch: false,
        methods: [],
        soqlQueries: [],
        dmlOperations: [],
        classReferences: [],
        classAnnotations: [],
        controlFlows: [],
      },
    }));
    const graph = { ...BASE, apexClasses: apexMany } as unknown as KnowledgeGraph;
    const result = buildHotspots(graph);
    expect(result.items.length).toBeLessThanOrEqual(15);
    const scores = result.items.map((it) => it.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
