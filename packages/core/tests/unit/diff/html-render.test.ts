import { describe, expect, it } from "vitest";
import { DIFF_CSS, renderDiffHtml } from "../../../src/diff/html-render.js";
import type { RawDiff } from "../../../src/diff/types.js";
import type { ApexClass, KnowledgeGraph } from "../../../src/types/graph.js";

const META: KnowledgeGraph["meta"] = {
  yohakuVersion: "test",
  builtAt: "2026-05-30T00:00:00Z",
  sourceAdapter: "local",
  salesforceApiVersion: "62.0",
  sourceHash: "h",
};

const BASE_GRAPH = {
  meta: META,
  objects: [],
  fields: [],
  validationRules: [],
  flows: [],
  apexClasses: [] as ApexClass[],
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

function emptyDiff(): RawDiff {
  return {
    fromRef: "v1.0.0",
    toRef: "HEAD",
    generatedAt: "2026-05-30T00:00:00Z",
    files: [],
    totals: {
      files: 0,
      addedLines: 0,
      removedLines: 0,
      byCategory: {
        data_model: 0,
        automation: 0,
        permission: 0,
        ui: 0,
        logic: 0,
        operational: 0,
        manual: 0,
        unknown: 0,
      },
      byChangeKind: { added: 0, modified: 0, removed: 0, renamed: 0 },
    },
    truncated: false,
  };
}

describe("renderDiffHtml", () => {
  it("空 diff でも valid HTML を返す", () => {
    const html = renderDiffHtml(emptyDiff());
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Release Review");
    expect(html).toContain("v1.0.0");
    expect(html).toContain("HEAD");
    expect(html).toContain("変更はありません");
  });

  it("ChangedFile をカテゴリ別セクションに振り分ける", () => {
    const diff: RawDiff = {
      ...emptyDiff(),
      files: [
        {
          path: "force-app/main/default/classes/Foo.cls",
          changeKind: "modified",
          metadataType: "ApexClass",
          fullyQualifiedName: "Foo",
          category: "logic",
          addedLines: 10,
          removedLines: 3,
        },
        {
          path: "force-app/main/default/objects/Bar/Bar.object-meta.xml",
          changeKind: "added",
          metadataType: "CustomObject",
          fullyQualifiedName: "Bar",
          category: "data_model",
          addedLines: 50,
          removedLines: 0,
        },
      ],
      totals: {
        files: 2,
        addedLines: 60,
        removedLines: 3,
        byCategory: {
          data_model: 1,
          automation: 0,
          permission: 0,
          ui: 0,
          logic: 1,
          operational: 0,
          manual: 0,
          unknown: 0,
        },
        byChangeKind: { added: 1, modified: 1, removed: 0, renamed: 0 },
      },
    };
    const html = renderDiffHtml(diff);
    expect(html).toContain("データモデル");
    expect(html).toContain("ロジック");
    // 内部タイプ pill は "apex" / "object" に正規化されている
    expect(html).toContain("t-apex");
    expect(html).toContain("t-object");
    expect(html).toContain("Foo");
    expect(html).toContain("Bar");
    // categories not present should be absent
    expect(html).not.toContain("自動化");
  });

  it("graph が渡されれば、存在する component leaf へリンクする", () => {
    const cls: ApexClass = {
      fullyQualifiedName: "Foo",
      apiVersion: "62.0",
      isTest: false,
      sourcePath: "Foo.cls",
      contentHash: "h",
    };
    const graph: KnowledgeGraph = { ...BASE_GRAPH, apexClasses: [cls] };
    const diff: RawDiff = {
      ...emptyDiff(),
      files: [
        {
          path: "force-app/main/default/classes/Foo.cls",
          changeKind: "modified",
          metadataType: "ApexClass",
          fullyQualifiedName: "Foo",
          category: "logic",
          addedLines: 1,
          removedLines: 0,
        },
      ],
      totals: {
        files: 1,
        addedLines: 1,
        removedLines: 0,
        byCategory: {
          data_model: 0,
          automation: 0,
          permission: 0,
          ui: 0,
          logic: 1,
          operational: 0,
          manual: 0,
          unknown: 0,
        },
        byChangeKind: { added: 0, modified: 1, removed: 0, renamed: 0 },
      },
    };
    const html = renderDiffHtml(diff, { graph });
    expect(html).toContain("./component/apex/Foo.html");
  });

  it("graph に無いものは muted-link (リンクなし)", () => {
    const diff: RawDiff = {
      ...emptyDiff(),
      files: [
        {
          path: "force-app/main/default/classes/Missing.cls",
          changeKind: "added",
          metadataType: "ApexClass",
          fullyQualifiedName: "Missing",
          category: "logic",
          addedLines: 1,
          removedLines: 0,
        },
      ],
      totals: {
        files: 1,
        addedLines: 1,
        removedLines: 0,
        byCategory: {
          data_model: 0,
          automation: 0,
          permission: 0,
          ui: 0,
          logic: 1,
          operational: 0,
          manual: 0,
          unknown: 0,
        },
        byChangeKind: { added: 1, modified: 0, removed: 0, renamed: 0 },
      },
    };
    const html = renderDiffHtml(diff, { graph: BASE_GRAPH as KnowledgeGraph });
    expect(html).not.toContain("./component/apex/Missing.html");
    expect(html).toContain("muted-link");
  });

  it("truncated=true のとき警告を出す", () => {
    const html = renderDiffHtml({ ...emptyDiff(), truncated: true });
    expect(html).toContain("ファイル件数が上限に達しました");
  });

  it("DIFF_CSS は主要セレクタを持つ", () => {
    expect(DIFF_CSS).toContain(".diff-card");
    expect(DIFF_CSS).toContain(".diff-cat-data_model");
    expect(DIFF_CSS).toContain(".diff-change-pill");
  });
});
