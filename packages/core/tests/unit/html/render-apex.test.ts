import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HtmlAuditFailedError,
  buildApexViewModel,
  renderHtmlAll,
  resolveHtmlOutDir,
} from "../../../src/html/index.js";
import { requiredSectionsFor } from "../../../src/html/sections.js";
import type {
  ApexClass,
  ApexMethodInfo,
  KnowledgeGraph,
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

function graphWith(apexClasses: ApexClass[]): KnowledgeGraph {
  return { ...EMPTY_GRAPH_BASE, apexClasses };
}

function method(
  name: string,
  visibility: ApexMethodInfo["visibility"] = "public",
): ApexMethodInfo {
  return {
    name,
    visibility,
    isStatic: false,
    returnType: "void",
    parameters: "",
    annotations: [],
  };
}

function makeClass(overrides: Partial<ApexClass> = {}): ApexClass {
  return {
    fullyQualifiedName: "AccountService",
    apiVersion: "62.0",
    isTest: false,
    sourcePath: "force-app/main/default/classes/AccountService.cls",
    contentHash: "h",
    body: {
      methods: [method("save"), method("validate", "private")],
      soqlQueries: [{ raw: "SELECT Id FROM Account", primaryObject: "Account" }],
      dmlOperations: [
        { kind: "insert", target: "Account", viaDatabaseClass: false },
      ],
      classReferences: [],
      classAnnotations: [],
      hasTryCatch: false,
      hasCallout: false,
    },
    ...overrides,
  };
}

describe("buildApexViewModel", () => {
  it("Apex の必須セクション (12項目) を全て備える", () => {
    const cls = makeClass();
    const vm = buildApexViewModel(cls, graphWith([cls]));
    const providedIds = vm.sections.map((s) => s.id);
    const required = requiredSectionsFor("apex");
    for (const id of required) {
      expect(providedIds, `missing required section ${id}`).toContain(id);
    }
  });

  it("LLM セクションは editableBlockId を持つ", () => {
    const cls = makeClass();
    const vm = buildApexViewModel(cls, graphWith([cls]));
    const business = vm.sections.find((s) => s.id === "business-meaning");
    expect(business?.editableBlockId).toBe("business-meaning");
    const concerns = vm.sections.find((s) => s.id === "concerns");
    expect(concerns?.editableBlockId).toBe("concerns");
  });

  it("公開インターフェースは public メソッドのみを含む", () => {
    const cls = makeClass();
    const vm = buildApexViewModel(cls, graphWith([cls]));
    const pi = vm.sections.find((s) => s.id === "public-interface");
    expect(pi?.htmlContent).toContain("save");
    expect(pi?.htmlContent).not.toContain("validate");
  });

  it("SOQL/DML 対象がデータモデル接点に出る", () => {
    const cls = makeClass();
    const vm = buildApexViewModel(cls, graphWith([cls]));
    const dm = vm.sections.find((s) => s.id === "data-model-touchpoints");
    expect(dm?.htmlContent).toContain("Account");
  });

  it("テストクラスがあれば test-coverage に出る", () => {
    const cls = makeClass();
    const testCls = makeClass({ fullyQualifiedName: "AccountServiceTest", isTest: true });
    const vm = buildApexViewModel(cls, graphWith([cls, testCls]));
    const tc = vm.sections.find((s) => s.id === "test-coverage");
    expect(tc?.htmlContent).toContain("AccountServiceTest");
  });

  it("テストクラス未検出なら警告を含む", () => {
    const cls = makeClass();
    const vm = buildApexViewModel(cls, graphWith([cls]));
    const tc = vm.sections.find((s) => s.id === "test-coverage");
    expect(tc?.htmlContent).toContain("対応するテストクラスが見つかりません");
  });
});

describe("renderHtmlAll (Phase 1: Apex 出力)", () => {
  let outRoot: string;
  beforeEach(() => {
    outRoot = mkdtempSync(join(tmpdir(), "yohaku-apex-test-"));
  });
  afterEach(() => {
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("Apex クラスごとに component/apex/<name>.html を生成する", () => {
    const cls1 = makeClass();
    const cls2 = makeClass({ fullyQualifiedName: "OrderService" });
    const htmlOut = resolveHtmlOutDir(outRoot);
    const result = renderHtmlAll(graphWith([cls1, cls2]), htmlOut);
    const file1 = join(htmlOut, "component", "apex", "AccountService.html");
    const file2 = join(htmlOut, "component", "apex", "OrderService.html");
    expect(existsSync(file1)).toBe(true);
    expect(existsSync(file2)).toBe(true);
    expect(result.written).toContain(file1);
    expect(result.written).toContain(file2);
  });

  it("生成 HTML は breadcrumb と 12 セクションを含む", () => {
    const cls = makeClass();
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(graphWith([cls]), htmlOut);
    const html = readFileSync(
      join(htmlOut, "component", "apex", "AccountService.html"),
      "utf8",
    );
    expect(html).toContain("breadcrumb");
    expect(html).toContain('id="one-line-summary"');
    expect(html).toContain('id="business-meaning"');
    expect(html).toContain('id="related-domains"');
  });

  it("LLM セクションは ai_managed 編集マーカーを含む", () => {
    const cls = makeClass();
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(graphWith([cls]), htmlOut);
    const html = readFileSync(
      join(htmlOut, "component", "apex", "AccountService.html"),
      "utf8",
    );
    expect(html).toContain(
      'yohaku:block kind="ai_managed" id="business-meaning" start',
    );
    expect(html).toContain(
      'yohaku:block kind="ai_managed" id="business-meaning" end',
    );
  });

  it("ホームページに Apex 一覧へのリンクが出る", () => {
    const cls = makeClass();
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(graphWith([cls]), htmlOut);
    const index = readFileSync(join(htmlOut, "index.html"), "utf8");
    expect(index).toContain("./component/apex/AccountService.html");
    expect(index).toContain("Apex Classes");
    expect(index).toContain('class="count">1</span>');
  });

  it("typesFilter=trigger だと apex は skip 扱い", () => {
    const cls = makeClass();
    const htmlOut = resolveHtmlOutDir(outRoot);
    const result = renderHtmlAll(graphWith([cls]), htmlOut, {
      typesFilter: ["trigger"],
    });
    expect(result.skipped).toContain("apex (filtered)");
    expect(existsSync(join(htmlOut, "component", "apex", "AccountService.html"))).toBe(
      false,
    );
  });

  it("ファイル名はサニタイズされる (危険文字は _ に)", () => {
    const cls = makeClass({ fullyQualifiedName: "Foo/Bar" });
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(graphWith([cls]), htmlOut);
    expect(existsSync(join(htmlOut, "component", "apex", "Foo_Bar.html"))).toBe(true);
  });
});

describe("--strict mode", () => {
  let outRoot: string;
  beforeEach(() => {
    outRoot = mkdtempSync(join(tmpdir(), "yohaku-strict-test-"));
  });
  afterEach(() => {
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("Apex は全 required を満たすので strict でも throw しない", () => {
    const cls = makeClass();
    const htmlOut = resolveHtmlOutDir(outRoot);
    expect(() =>
      renderHtmlAll(graphWith([cls]), htmlOut, { strict: true }),
    ).not.toThrow();
  });

  it("HtmlAuditFailedError は failures を保持する (構造テスト)", () => {
    const err = new HtmlAuditFailedError([
      { type: "apex", componentName: "X", missing: ["one-line-summary"] },
    ]);
    expect(err.failures).toHaveLength(1);
    expect(err.name).toBe("HtmlAuditFailedError");
  });
});
