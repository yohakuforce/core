import { describe, expect, it } from "vitest";
import { buildSearchIndex } from "../../../src/html/search-index.js";
import type { ApexClass, KnowledgeGraph } from "../../../src/types/graph.js";

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

function apex(name: string): ApexClass {
  return {
    fullyQualifiedName: name,
    apiVersion: "62.0",
    isTest: false,
    sourcePath: `${name}.cls`,
    contentHash: "h",
  };
}

describe("buildSearchIndex", () => {
  it("graph 全コンポーネントを並べる", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("AccountService"), apex("OrderService")],
    };
    const idx = buildSearchIndex(graph);
    expect(idx.entries.map((e) => e.name).sort()).toEqual(["AccountService", "OrderService"]);
  });

  it("domains.yaml の domain ラベルが付与される", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("AccountService")] };
    const idx = buildSearchIndex(graph, {
      version: 1,
      domains: [
        {
          id: "account",
          label: "Account",
          members: [{ type: "apex", name: "AccountService" }],
        },
      ],
    });
    expect(idx.entries[0]?.domain).toBe("Account");
    expect(idx.entries[0]?.domainLc).toBe("account");
  });

  it("href は component/<type>/<safeName>.html", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("Foo/Bar")] };
    const idx = buildSearchIndex(graph);
    expect(idx.entries[0]?.href).toBe("component/apex/Foo_Bar.html");
  });

  it("nameLc は lowercase", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("MyService")] };
    const idx = buildSearchIndex(graph);
    expect(idx.entries[0]?.nameLc).toBe("myservice");
  });
});
