import { describe, expect, it } from "vitest";
import { buildExplainPrompts } from "../../../src/explain-prompts/index.js";
import type { ApexClass, ApexTrigger, KnowledgeGraph, SObject } from "../../../src/types/graph.js";

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

function apex(name: string, isTest = false): ApexClass {
  return {
    fullyQualifiedName: name,
    apiVersion: "62.0",
    isTest,
    sourcePath: `${name}.cls`,
    contentHash: "h",
    body: {
      methods: [
        { name: "run", visibility: "public", isStatic: true, returnType: "void", parameters: "", annotations: [] },
      ],
      soqlQueries: [{ raw: "SELECT Id FROM Account", primaryObject: "Account" }],
      dmlOperations: [{ kind: "insert", target: "Account", viaDatabaseClass: false }],
      classReferences: [],
      classAnnotations: [],
      hasTryCatch: false,
      hasCallout: false,
    },
  };
}

function trigger(name: string, obj: string): ApexTrigger {
  return {
    fullyQualifiedName: name,
    object: obj,
    events: ["beforeInsert"],
    apiVersion: "62.0",
    sourcePath: `${name}.trigger`,
    contentHash: "h",
  };
}

function obj(name: string): SObject {
  return {
    fullyQualifiedName: name,
    label: name,
    isCustom: false,
    sourcePath: `${name}.object-meta.xml`,
    contentHash: "h",
  };
}

describe("buildExplainPrompts", () => {
  it("Apex 1 件で business-meaning + concerns の 2 item を生成", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("AccountService")] };
    const out = buildExplainPrompts(graph);
    expect(out.format).toBe("yohaku-explain-prompts");
    expect(out.items).toHaveLength(2);
    expect(out.items.map((i) => i.blockId).sort()).toEqual(["business-meaning", "concerns"]);
  });

  it("テストクラスは対象外", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("AccountServiceTest", true)],
    };
    const out = buildExplainPrompts(graph);
    expect(out.items).toEqual([]);
  });

  it("kinds=business-meaning のみで concerns は出ない", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("AccountService")] };
    const out = buildExplainPrompts(graph, { kinds: ["business-meaning"] });
    expect(out.items).toHaveLength(1);
    expect(out.items[0]?.blockId).toBe("business-meaning");
  });

  it("Object は concerns 対象外 (business-meaning のみ)", () => {
    const graph: KnowledgeGraph = { ...BASE, objects: [obj("Account")] };
    const out = buildExplainPrompts(graph);
    const types = out.items.map((i) => i.type);
    expect(types).toContain("object");
    const objConcerns = out.items.filter((i) => i.type === "object" && i.blockId === "concerns");
    expect(objConcerns).toEqual([]);
  });

  it("typesFilter で対象タイプを絞れる", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("X")],
      apexTriggers: [trigger("XTrigger", "Account")],
    };
    const out = buildExplainPrompts(graph, { typesFilter: ["apex"] });
    expect(out.items.every((i) => i.type === "apex")).toBe(true);
  });

  it("namesFilter で対象名を絞れる", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("A"), apex("B")] };
    const out = buildExplainPrompts(graph, { namesFilter: ["A"] });
    expect(out.items.every((i) => i.name === "A")).toBe(true);
  });

  it("maxItems で上限カット", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("A"), apex("B"), apex("C")],
    };
    const out = buildExplainPrompts(graph, { maxItems: 3 });
    expect(out.items).toHaveLength(3);
  });

  it("各 item の prompt は HTML 出力ルールを含む", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("X")] };
    const out = buildExplainPrompts(graph, { kinds: ["business-meaning"] });
    expect(out.items[0]?.prompt).toContain("純粋な HTML 断片");
    expect(out.items[0]?.prompt).toContain("マークダウン");
  });

  it("各 item の context は SOQL/DML 等を含む", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("X")] };
    const out = buildExplainPrompts(graph, { kinds: ["business-meaning"] });
    const ctx = out.items[0]?.context as Record<string, unknown>;
    expect(ctx.soqlObjects).toEqual(["Account"]);
    expect(ctx.dmlTargets).toEqual(["insert Account"]);
  });

  it("instructions と outputTemplate を返す", () => {
    const out = buildExplainPrompts({ ...BASE } as KnowledgeGraph);
    expect(out.instructions).toContain("version");
    expect(out.instructions).toContain("components");
    expect(out.outputTemplate.version).toBe(1);
  });
});
