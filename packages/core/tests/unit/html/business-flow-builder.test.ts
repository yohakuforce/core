import { describe, expect, it } from "vitest";
import { buildBusinessFlows } from "../../../src/html/business-flow-builder.js";
import type { DomainsConfig } from "../../../src/domains/types.js";
import type {
  ApexClass,
  ApexTrigger,
  KnowledgeGraph,
  SObject,
} from "../../../src/types/graph.js";

const META: KnowledgeGraph["meta"] = {
  yohakuVersion: "test",
  builtAt: "2026-05-31T00:00:00Z",
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

function apex(name: string, opts?: Partial<ApexClass> & { entryAnnot?: string }): ApexClass {
  const annot = opts?.entryAnnot;
  return {
    fullyQualifiedName: name,
    apiVersion: "62.0",
    isTest: opts?.isTest ?? false,
    sourcePath: `${name}.cls`,
    contentHash: "h",
    body: {
      methods: [
        {
          name: "run",
          visibility: "public",
          isStatic: true,
          returnType: "void",
          parameters: "",
          annotations: annot !== undefined ? [annot] : [],
        },
      ],
      soqlQueries: [],
      dmlOperations: [],
      classReferences: [],
      classAnnotations: [],
      hasTryCatch: false,
      hasCallout: false,
    },
    ...opts,
  };
}

function trg(name: string, object: string): ApexTrigger {
  return {
    fullyQualifiedName: name,
    object,
    events: ["beforeInsert", "afterInsert"],
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
    sourcePath: `${name}.object`,
    contentHash: "h",
  };
}

describe("buildBusinessFlows — domain scope", () => {
  it("domains.yaml が無いと domainFlows は空", () => {
    const out = buildBusinessFlows(BASE as KnowledgeGraph);
    expect(out.domainFlows).toEqual([]);
  });

  it("ドメイン内 Trigger は entryPoints に入る", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexTriggers: [trg("InvoiceTrigger", "Invoice__c")],
    };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        {
          id: "invoice",
          label: "Invoice",
          members: [{ type: "trigger", name: "InvoiceTrigger" }],
        },
      ],
    };
    const out = buildBusinessFlows(graph, domains);
    const f = out.domainFlows[0];
    expect(f?.entryPoints).toHaveLength(1);
    expect(f?.entryPoints[0]?.type).toBe("trigger");
    expect(f?.entryPoints[0]?.name).toBe("InvoiceTrigger");
  });

  it("@RestResource クラスは entry に分類", () => {
    const base = apex("InvoiceRest");
    const cls: ApexClass = {
      ...base,
      body: { ...base.body!, classAnnotations: ["RestResource"] },
    };
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [cls] };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        { id: "invoice", label: "Invoice", members: [{ type: "apex", name: "InvoiceRest" }] },
      ],
    };
    const out = buildBusinessFlows(graph, domains);
    expect(out.domainFlows[0]?.entryPoints[0]?.evidence).toBe("@RestResource");
  });

  it("@AuraEnabled メソッドのあるクラスは entry", () => {
    const cls = apex("Controller", { entryAnnot: "AuraEnabled" });
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [cls] };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        { id: "x", label: "X", members: [{ type: "apex", name: "Controller" }] },
      ],
    };
    const out = buildBusinessFlows(graph, domains);
    expect(out.domainFlows[0]?.entryPoints[0]?.evidence).toContain("@AuraEnabled");
  });

  it("非 entry の Apex は processing", () => {
    const cls = apex("Helper");
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [cls] };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        { id: "x", label: "X", members: [{ type: "apex", name: "Helper" }] },
      ],
    };
    const out = buildBusinessFlows(graph, domains);
    expect(out.domainFlows[0]?.processing).toHaveLength(1);
    expect(out.domainFlows[0]?.entryPoints).toHaveLength(0);
  });

  it("processing の DML は affectedData に反映", () => {
    const cls: ApexClass = {
      ...apex("Helper"),
      body: {
        methods: [],
        soqlQueries: [],
        dmlOperations: [{ kind: "insert", target: "Account", viaDatabaseClass: false }],
        classReferences: [],
        classAnnotations: [],
        hasTryCatch: false,
        hasCallout: false,
      },
    };
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [cls], objects: [obj("Account")] };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        { id: "x", label: "X", members: [{ type: "apex", name: "Helper" }] },
      ],
    };
    const out = buildBusinessFlows(graph, domains);
    const names = out.domainFlows[0]?.affectedData.map((s) => s.name) ?? [];
    expect(names).toContain("Account");
  });

  it("テストクラスは entry/processing から除外", () => {
    const cls = apex("HelperTest", { isTest: true });
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [cls] };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        { id: "x", label: "X", members: [{ type: "apex", name: "HelperTest" }] },
      ],
    };
    const out = buildBusinessFlows(graph, domains);
    expect(out.domainFlows[0]?.entryPoints).toEqual([]);
    expect(out.domainFlows[0]?.processing).toEqual([]);
  });

  it("meaningLookup から meaning が拾われる", () => {
    const cls = apex("Foo");
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [cls] };
    const domains: DomainsConfig = {
      version: 1,
      domains: [
        { id: "x", label: "X", members: [{ type: "apex", name: "Foo" }] },
      ],
    };
    const lookup = new Map<string, string>([["apex:Foo", "<p>業務的意味</p>"]]);
    const out = buildBusinessFlows(graph, domains, lookup);
    expect(out.domainFlows[0]?.meaning).toBe("<p>業務的意味</p>");
  });
});

describe("buildBusinessFlows — object scope", () => {
  it("各 SObject ごとに 1 つ生成", () => {
    const graph: KnowledgeGraph = { ...BASE, objects: [obj("A"), obj("B")] };
    const out = buildBusinessFlows(graph);
    expect(out.objectFlows).toHaveLength(2);
  });

  it("オブジェクトに対する Trigger は entry に", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      objects: [obj("Invoice__c")],
      apexTriggers: [trg("InvoiceTrigger", "Invoice__c")],
    };
    const out = buildBusinessFlows(graph);
    const f = out.objectFlows.find((f) => f.label.includes("Invoice__c"));
    expect(f?.entryPoints[0]?.type).toBe("trigger");
  });

  it("Apex が SOQL/DML で触っていれば processing", () => {
    const cls: ApexClass = {
      ...apex("Svc"),
      body: {
        methods: [],
        soqlQueries: [{ raw: "SELECT Id FROM Account", primaryObject: "Account" }],
        dmlOperations: [{ kind: "update", target: "Account", viaDatabaseClass: false }],
        classReferences: [],
        classAnnotations: [],
        hasTryCatch: false,
        hasCallout: false,
      },
    };
    const graph: KnowledgeGraph = { ...BASE, objects: [obj("Account")], apexClasses: [cls] };
    const out = buildBusinessFlows(graph);
    const f = out.objectFlows[0];
    expect(f?.processing.map((s) => s.name)).toContain("Svc");
    expect(f?.processing[0]?.evidence).toContain("SOQL");
    expect(f?.processing[0]?.evidence).toContain("update");
  });
});
