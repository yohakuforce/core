import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildFlowViewModel,
  buildLwcViewModel,
  buildObjectViewModel,
  buildTriggerViewModel,
  renderHtmlAll,
  resolveHtmlOutDir,
} from "../../../src/html/index.js";
import { requiredSectionsFor } from "../../../src/html/sections.js";
import type {
  ApexTrigger,
  Field,
  Flow,
  KnowledgeGraph,
  LightningWebComponent,
  SObject,
} from "../../../src/types/graph.js";

const META: KnowledgeGraph["meta"] = {
  yohakuVersion: "test",
  builtAt: "2026-05-30T00:00:00Z",
  sourceAdapter: "local",
  salesforceApiVersion: "62.0",
  sourceHash: "h",
};

const EMPTY_GRAPH_BASE = {
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

function mkTrigger(overrides: Partial<ApexTrigger> = {}): ApexTrigger {
  return {
    fullyQualifiedName: "AccountTrigger",
    object: "Account",
    events: ["beforeInsert", "afterInsert"],
    apiVersion: "62.0",
    sourcePath: "x.trigger",
    contentHash: "h",
    body: {
      methods: [],
      soqlQueries: [],
      dmlOperations: [],
      classReferences: [{ className: "AccountTriggerHandler", memberName: "run" }],
      classAnnotations: [],
      hasTryCatch: false,
      hasCallout: false,
    },
    ...overrides,
  };
}

function mkLwc(overrides: Partial<LightningWebComponent> = {}): LightningWebComponent {
  return {
    fullyQualifiedName: "accountCard",
    apiVersion: "62.0",
    isExposed: true,
    targets: ["lightning__RecordPage"],
    hasHtml: true,
    hasCss: false,
    apexImports: [
      { methodAlias: "getAccount", className: "AccountService", methodName: "getAccount" },
    ],
    labelImports: [],
    publicProperties: ["accountId", "showHeader"],
    wires: [{ target: "getAccount", bindingProperty: "account" }],
    customEvents: ["save"],
    childComponents: ["c-account-row"],
    standardComponents: [{ tag: "lightning-card", count: 1 }],
    directives: [],
    sourcePath: "lwc/accountCard/accountCard.js-meta.xml",
    contentHash: "h",
    ...overrides,
  };
}

function mkObject(overrides: Partial<SObject> = {}): SObject {
  return {
    fullyQualifiedName: "Account",
    label: "Account",
    isCustom: false,
    sourcePath: "objects/Account.object-meta.xml",
    contentHash: "h",
    ...overrides,
  };
}

function mkField(name: string, object: string): Field {
  return {
    fullyQualifiedName: `${object}.${name}`,
    object,
    label: name,
    type: "Text",
    isCustom: name.endsWith("__c"),
    sourcePath: `objects/${object}/fields/${name}.field-meta.xml`,
    contentHash: "h",
  };
}

function mkFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    fullyQualifiedName: "AccountAutomation",
    type: "AutoLaunchedFlow",
    status: "Active",
    sourcePath: "flows/AccountAutomation.flow-meta.xml",
    contentHash: "h",
    body: {
      elements: [
        { name: "Get_Account", kind: "recordLookup", target: "Account" },
        { name: "Update_Account", kind: "recordUpdate", target: "Account" },
      ],
      subflows: [],
      recordObjects: ["Account"],
      actionCalls: [],
    },
    ...overrides,
  };
}

describe("Trigger ViewModel", () => {
  it("trigger の必須セクションを満たす", () => {
    const trg = mkTrigger();
    const vm = buildTriggerViewModel(trg, { ...EMPTY_GRAPH_BASE, apexTriggers: [trg] });
    const provided = vm.sections.map((s) => s.id);
    for (const id of requiredSectionsFor("trigger")) {
      expect(provided, `missing ${id}`).toContain(id);
    }
  });
});

describe("LWC ViewModel", () => {
  it("lwc の必須セクションを満たす", () => {
    const lwc = mkLwc();
    const vm = buildLwcViewModel(lwc, { ...EMPTY_GRAPH_BASE, lwcs: [lwc] });
    const provided = vm.sections.map((s) => s.id);
    for (const id of requiredSectionsFor("lwc")) {
      expect(provided, `missing ${id}`).toContain(id);
    }
  });

  it("@api プロパティとカスタムイベントが入出力に出る", () => {
    const lwc = mkLwc();
    const vm = buildLwcViewModel(lwc, { ...EMPTY_GRAPH_BASE, lwcs: [lwc] });
    const io = vm.sections.find((s) => s.id === "io-contract");
    expect(io?.htmlContent).toContain("accountId");
    expect(io?.htmlContent).toContain("save");
  });
});

describe("Object ViewModel", () => {
  it("object の必須セクションを満たす", () => {
    const obj = mkObject();
    const graph = { ...EMPTY_GRAPH_BASE, objects: [obj], fields: [mkField("Name", "Account")] };
    const vm = buildObjectViewModel(obj, graph);
    const provided = vm.sections.map((s) => s.id);
    for (const id of requiredSectionsFor("object")) {
      expect(provided, `missing ${id}`).toContain(id);
    }
  });

  it("公開インターフェースに項目が表示される", () => {
    const obj = mkObject();
    const fields = [mkField("Name", "Account"), mkField("Industry", "Account")];
    const vm = buildObjectViewModel(obj, { ...EMPTY_GRAPH_BASE, objects: [obj], fields });
    const pi = vm.sections.find((s) => s.id === "public-interface");
    expect(pi?.htmlContent).toContain("Account.Name");
    expect(pi?.htmlContent).toContain("Account.Industry");
  });
});

describe("Flow ViewModel", () => {
  it("flow の必須セクションを満たす", () => {
    const flow = mkFlow();
    const vm = buildFlowViewModel(flow, { ...EMPTY_GRAPH_BASE, flows: [flow] });
    const provided = vm.sections.map((s) => s.id);
    for (const id of requiredSectionsFor("flow")) {
      expect(provided, `missing ${id}`).toContain(id);
    }
  });

  it("recordObjects がデータモデル接点に出る", () => {
    const flow = mkFlow();
    const vm = buildFlowViewModel(flow, { ...EMPTY_GRAPH_BASE, flows: [flow] });
    const dm = vm.sections.find((s) => s.id === "data-model-touchpoints");
    expect(dm?.htmlContent).toContain("Account");
  });
});

describe("renderHtmlAll multi-type", () => {
  let outRoot: string;
  beforeEach(() => {
    outRoot = mkdtempSync(join(tmpdir(), "yohaku-multi-test-"));
  });
  afterEach(() => {
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("4 タイプ全てに対し component/<type>/<name>.html を生成する", () => {
    const trg = mkTrigger();
    const lwc = mkLwc();
    const obj = mkObject();
    const flow = mkFlow();
    const graph: KnowledgeGraph = {
      ...EMPTY_GRAPH_BASE,
      apexTriggers: [trg],
      lwcs: [lwc],
      objects: [obj],
      flows: [flow],
      fields: [mkField("Name", "Account")],
    };
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(graph, htmlOut, { strict: true });
    expect(existsSync(join(htmlOut, "component", "trigger", "AccountTrigger.html"))).toBe(true);
    expect(existsSync(join(htmlOut, "component", "lwc", "accountCard.html"))).toBe(true);
    expect(existsSync(join(htmlOut, "component", "object", "Account.html"))).toBe(true);
    expect(existsSync(join(htmlOut, "component", "flow", "AccountAutomation.html"))).toBe(true);
  });

  it("ホームページに全タイプのリンクが出る", () => {
    const trg = mkTrigger();
    const lwc = mkLwc();
    const obj = mkObject();
    const flow = mkFlow();
    const graph: KnowledgeGraph = {
      ...EMPTY_GRAPH_BASE,
      apexTriggers: [trg],
      lwcs: [lwc],
      objects: [obj],
      flows: [flow],
    };
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(graph, htmlOut);
    const home = readFileSync(join(htmlOut, "index.html"), "utf8");
    expect(home).toContain("./component/trigger/AccountTrigger.html");
    expect(home).toContain("./component/lwc/accountCard.html");
    expect(home).toContain("./component/object/Account.html");
    expect(home).toContain("./component/flow/AccountAutomation.html");
  });

  it("typesFilter で特定タイプだけ出力できる", () => {
    const trg = mkTrigger();
    const lwc = mkLwc();
    const graph: KnowledgeGraph = {
      ...EMPTY_GRAPH_BASE,
      apexTriggers: [trg],
      lwcs: [lwc],
    };
    const htmlOut = resolveHtmlOutDir(outRoot);
    const result = renderHtmlAll(graph, htmlOut, { typesFilter: ["trigger"] });
    expect(existsSync(join(htmlOut, "component", "trigger", "AccountTrigger.html"))).toBe(true);
    expect(existsSync(join(htmlOut, "component", "lwc", "accountCard.html"))).toBe(false);
    expect(result.skipped).toContain("lwc (filtered)");
  });
});
