// 詳細設計書化セクション (processing-detail / field-assignment / calculation-rules) のテスト
import { describe, expect, it } from "vitest";
import { decodeXmlEntities, formulaToHtml } from "../../../src/html/formula-html.js";
import { buildProcessingDetailSection } from "../../../src/html/viewmodel/apex-detail.js";
import { buildFieldWritesSection } from "../../../src/html/viewmodel/apex-field-writes.js";
import {
  buildCalculationRulesSection,
  buildFieldAssignmentSection,
} from "../../../src/html/viewmodel/object-detail.js";
import { buildMethodSummaryTable } from "../../../src/render/method-summary-table.js";
import type {
  ApexClass,
  Field,
  KnowledgeGraph,
  SObject,
  ValidationRule,
} from "../../../src/types/graph.js";

function field(overrides: Partial<Field> = {}): Field {
  return {
    fullyQualifiedName: "Order__c.Amount__c",
    object: "Order__c",
    type: "Currency",
    isCustom: true,
    sourcePath: "x",
    contentHash: "h",
    ...overrides,
  };
}

const OBJ: SObject = {
  fullyQualifiedName: "Order__c",
  label: "受注",
  isCustom: true,
  sourcePath: "x",
  contentHash: "h",
};

const NO_PRESERVED = (): undefined => undefined;
const MIN_GRAPH = {
  apexClasses: [],
  apexTriggers: [],
  flows: [],
  validationRules: [],
} as unknown as KnowledgeGraph;

describe("formula-html", () => {
  it("XML 実体参照をデコードする", () => {
    expect(decodeXmlEntities("a &gt; b &amp;&amp; c &lt; d")).toBe("a > b && c < d");
    expect(decodeXmlEntities("ISPICKVAL(S, &quot;X&quot;)")).toBe('ISPICKVAL(S, "X")');
  });

  it("数式を自然語 HTML へ変換する (実体参照込み)", () => {
    const html = formulaToHtml("Amount__c &gt; 0");
    expect(html).toContain("formula-nl");
    expect(html).toContain("を超える");
  });

  it("数式のデコードにより演算子解析が成功する (フォールバックしない)", () => {
    const html = formulaToHtml("NULLVALUE(A, 0) &lt; NULLVALUE(B, 0)");
    expect(html).not.toContain("自動解析に失敗");
  });
});

describe("buildFieldAssignmentSection", () => {
  it("数式/参照/選択リスト/初期値/集計を値の決まり方として分類する", () => {
    const fields: Field[] = [
      field({ fullyQualifiedName: "Order__c.Net__c", formula: "A - B" }),
      field({ fullyQualifiedName: "Order__c.Acc__c", type: "Lookup", referenceTo: ["Account"] }),
      field({
        fullyQualifiedName: "Order__c.Status__c",
        type: "Picklist",
        picklistValues: ["Draft", "Done"],
      }),
      field({ fullyQualifiedName: "Order__c.Disc__c", defaultValue: "0" }),
      field({ fullyQualifiedName: "Order__c.Total__c", type: "Summary" }),
    ];
    const html = buildFieldAssignmentSection(OBJ, fields, MIN_GRAPH, NO_PRESERVED).htmlContent;
    expect(html).toContain("数式で自動計算");
    expect(html).toContain("参照 (lookup)");
    expect(html).toContain("選択リスト (2値)");
    expect(html).toContain("初期値あり");
    expect(html).toContain("積み上げ集計 (自動)");
  });

  it("決定的に分類できない項目は LLM ブロック(ai_managed)へ回し「—」を出さない", () => {
    const fields = [field({ fullyQualifiedName: "Order__c.Memo__c", type: "Text" })];
    const html = buildFieldAssignmentSection(OBJ, fields, MIN_GRAPH, NO_PRESERVED).htmlContent;
    expect(html).toContain('id="field-assignment-detail"');
    expect(html).toContain("要確認");
    expect(html).toContain("Order__c.Memo__c");
  });

  it("項目が無い場合はプレースホルダを返す", () => {
    expect(buildFieldAssignmentSection(OBJ, [], MIN_GRAPH, NO_PRESERVED).htmlContent).toContain(
      "検出されませんでした",
    );
  });
});

describe("buildCalculationRulesSection", () => {
  function graphWithVrs(rules: ValidationRule[]): KnowledgeGraph {
    return { validationRules: rules } as unknown as KnowledgeGraph;
  }

  it("数式項目と入力規則を自然語ロジックで描画する", () => {
    const fields = [
      field({ fullyQualifiedName: "Order__c.Net__c", formula: "NULLVALUE(A,0) - NULLVALUE(B,0)" }),
    ];
    const vr: ValidationRule = {
      fullyQualifiedName: "Order__c.CreditCheck",
      object: "Order__c",
      active: true,
      errorConditionFormula: "Net__c &gt; Limit__c",
      errorMessage: "超過しています",
      sourcePath: "x",
      contentHash: "h",
    };
    const html = buildCalculationRulesSection(
      OBJ,
      fields,
      graphWithVrs([vr]),
      NO_PRESERVED,
    ).htmlContent;
    expect(html).toContain("数式項目 (1)");
    expect(html).toContain("入力規則 (1)");
    expect(html).toContain("超過しています");
    expect(html).toContain("エラー発生条件");
    expect(html).toContain("を超える"); // > が自然語化されている
  });

  it("LLM レビュー用 ai_managed ブロックを備える", () => {
    const html = buildCalculationRulesSection(
      OBJ,
      [field()],
      graphWithVrs([]),
      NO_PRESERVED,
    ).htmlContent;
    expect(html).toContain('id="calculation-review"');
  });

  it("数式項目も入力規則も無ければプレースホルダ", () => {
    const html = buildCalculationRulesSection(
      OBJ,
      [field()],
      graphWithVrs([]),
      NO_PRESERVED,
    ).htmlContent;
    expect(html).toContain("検出されませんでした");
  });
});

describe("buildProcessingDetailSection", () => {
  const cls: ApexClass = {
    fullyQualifiedName: "OrderService",
    apiVersion: "62.0",
    isTest: false,
    sourcePath: "x",
    contentHash: "h",
    body: {
      methods: [
        {
          name: "create",
          visibility: "public",
          isStatic: true,
          returnType: "Id",
          parameters: "Id accId",
          annotations: [],
        },
      ],
      soqlQueries: [],
      dmlOperations: [],
      classReferences: [],
      classAnnotations: [],
      hasTryCatch: false,
      hasCallout: false,
      controlFlows: [
        {
          methodName: "create",
          signature: "Id create(Id accId)",
          nodes: [
            {
              kind: "if",
              condition: "accId == null",
              thenNodes: [{ kind: "throw", expression: "new E()" }],
              elseNodes: [],
            },
            { kind: "dml", verb: "insert", target: "o", viaDatabaseClass: false },
            { kind: "return", expression: "o.Id" },
          ],
        },
      ],
    },
  };

  it("決定的スケルトン (件数表 + 処理ステップ) を含む", () => {
    const section = buildProcessingDetailSection({
      methodSummaryTable: buildMethodSummaryTable(cls),
      body: cls.body,
    });
    expect(section.id).toBe("processing-detail");
    expect(section.htmlContent).toContain("processing-summary");
    expect(section.htmlContent).toContain("メソッド別 処理ステップ");
    expect(section.htmlContent).toContain("分岐"); // if ノード
    expect(section.htmlContent).toContain("戻り値"); // return ノード
  });

  it("LLM 解説用 ai_managed ブロックのマーカーを埋め込む", () => {
    const section = buildProcessingDetailSection({
      methodSummaryTable: buildMethodSummaryTable(cls),
      body: cls.body,
    });
    expect(section.htmlContent).toContain(
      'yohaku:block kind="ai_managed" id="processing-detail-narrative" start',
    );
    expect(section.htmlContent).toContain(
      'yohaku:block kind="ai_managed" id="processing-detail-narrative" end',
    );
  });

  it("preserve された解説を再掲する (空プレースホルダにしない)", () => {
    const section = buildProcessingDetailSection({
      methodSummaryTable: buildMethodSummaryTable(cls),
      body: cls.body,
      preservedNarrative: "<p>業務的な解説</p>",
    });
    expect(section.htmlContent).toContain("業務的な解説");
    expect(section.htmlContent).not.toContain("このセクションは LLM で生成されます");
  });
});

describe("buildFieldWritesSection", () => {
  const known = new Set(["Order__c", "Order_Line__c", "Account"]);
  const bodyWith = (text: string, soqlObj: string | null) => ({
    methods: [],
    soqlQueries: soqlObj !== null ? [{ raw: "q", primaryObject: soqlObj }] : [],
    dmlOperations: [],
    classReferences: [],
    classAnnotations: [],
    hasTryCatch: false,
    hasCallout: false,
    controlFlows: [{ methodName: "m", signature: "m()", nodes: [{ kind: "stmt" as const, text }] }],
  });

  it("new SObject と SOQL 対象からオブジェクト別タブを構築する", () => {
    const section = buildFieldWritesSection({
      componentName: "OrderService",
      body: bodyWith(
        "Order__c o = new Order__c(); Order_Line__c l = new Order_Line__c();",
        "Account",
      ),
      knownObjects: known,
      getPreserved: () => undefined,
    });
    expect(section.id).toBe("field-writes");
    expect(section.htmlContent).toContain("obj-tabs");
    // new で生成された書込対象 + SOQL 参照対象がタブになる
    expect(section.htmlContent).toContain('id="fw-Order__c"');
    expect(section.htmlContent).toContain('id="fw-Order_Line__c"');
    expect(section.htmlContent).toContain('id="fw-Account"');
    // 各タブに ai_managed パネル
    expect(section.htmlContent).toContain('id="field-writes:Order__c"');
  });

  it("トリガ対象オブジェクトは常にタブに含まれる", () => {
    const section = buildFieldWritesSection({
      componentName: "OrderTrigger",
      body: bodyWith("System.debug('x');", null),
      triggerObject: "Order__c",
      knownObjects: known,
      getPreserved: () => undefined,
    });
    expect(section.htmlContent).toContain('id="fw-Order__c"');
  });

  it("オブジェクトに触れなければ設定なしと明記する", () => {
    const section = buildFieldWritesSection({
      componentName: "Util",
      body: bodyWith("Integer x = 1;", null),
      knownObjects: known,
      getPreserved: () => undefined,
    });
    expect(section.htmlContent).toContain("項目設定 (DML / new SObject) を行いません");
  });
});
