import { describe, expect, it } from "vitest";
import {
  firstSentencePlain,
  labelIfDistinct,
  makeFieldLabelResolver,
  makeLabelResolver,
  objectRefListHtml,
  renderNameInline,
  renderNameStacked,
  renderRefInline,
} from "../../../src/html/display.js";
import type { KnowledgeGraph } from "../../../src/types/graph.js";

// makeLabelResolver は graph.objects / flows / lwcs しか参照しないため、
// 必要なフィールドだけ持つ最小グラフを組み立てる。
function graphWith(partial: Record<string, unknown>): KnowledgeGraph {
  return {
    objects: [],
    flows: [],
    lwcs: [],
    ...partial,
  } as unknown as KnowledgeGraph;
}

describe("labelIfDistinct", () => {
  it("returns undefined when label is undefined", () => {
    expect(labelIfDistinct(undefined, "Customer__c")).toBeUndefined();
  });

  it("returns undefined when label equals the API name", () => {
    expect(labelIfDistinct("Customer__c", "Customer__c")).toBeUndefined();
  });

  it("returns undefined when label is empty or whitespace", () => {
    expect(labelIfDistinct("   ", "Customer__c")).toBeUndefined();
  });

  it("returns the trimmed label when distinct from the API name", () => {
    expect(labelIfDistinct("  顧客  ", "Customer__c")).toBe("顧客");
  });
});

describe("makeLabelResolver", () => {
  it("resolves object / flow / lwc labels and never apex / trigger", () => {
    const graph = graphWith({
      objects: [{ fullyQualifiedName: "Customer__c", label: "顧客" }],
      flows: [{ fullyQualifiedName: "Order_AfterUpdate", label: "注文更新後フロー" }],
      lwcs: [{ fullyQualifiedName: "claimDashboard", masterLabel: "請求ダッシュボード" }],
    });
    const resolve = makeLabelResolver(graph);

    expect(resolve("object", "Customer__c")).toBe("顧客");
    expect(resolve("flow", "Order_AfterUpdate")).toBe("注文更新後フロー");
    expect(resolve("lwc", "claimDashboard")).toBe("請求ダッシュボード");
    expect(resolve("apex", "CustomerService")).toBeUndefined();
    expect(resolve("trigger", "OrderTrigger")).toBeUndefined();
    expect(resolve("object", "Unknown__c")).toBeUndefined();
  });

  it("omits labels equal to the API name", () => {
    const graph = graphWith({
      objects: [{ fullyQualifiedName: "Account", label: "Account" }],
    });
    expect(makeLabelResolver(graph)("object", "Account")).toBeUndefined();
  });
});

describe("renderNameStacked / renderNameInline", () => {
  it("renders API name only when there is no label", () => {
    expect(renderNameStacked(undefined, "CustomerService")).toBe("CustomerService");
    expect(renderNameInline(undefined, "CustomerService")).toBe("CustomerService");
  });

  it("renders label as primary with the API name as a secondary code/span", () => {
    expect(renderNameStacked("顧客", "Customer__c")).toBe(
      '<span class="name-stacked">顧客<code class="api-name">Customer__c</code></span>',
    );
    expect(renderNameInline("顧客", "Customer__c")).toBe(
      '顧客<span class="api-name-inline">Customer__c</span>',
    );
  });

  it("escapes HTML in both label and API name", () => {
    expect(renderNameStacked("<b>", "A&B")).toBe(
      '<span class="name-stacked">&lt;b&gt;<code class="api-name">A&amp;B</code></span>',
    );
  });
});

describe("renderRefInline / objectRefListHtml", () => {
  it("renders a bare code element when no label is resolved", () => {
    expect(renderRefInline(undefined, "CustomerService")).toBe("<code>CustomerService</code>");
  });

  it("renders label plus code when a label exists", () => {
    expect(renderRefInline("顧客", "Customer__c")).toBe("顧客 <code>Customer__c</code>");
  });

  it("builds an object reference list using the resolver, with empty fallback", () => {
    const resolve = makeLabelResolver(
      graphWith({
        objects: [{ fullyQualifiedName: "Customer__c", label: "顧客" }],
      }),
    );
    expect(objectRefListHtml(["Customer__c", "Order__c"], resolve, "なし")).toBe(
      "<ul><li>顧客 <code>Customer__c</code></li><li><code>Order__c</code></li></ul>",
    );
    expect(objectRefListHtml([], resolve, "なし")).toBe('<p class="muted">なし</p>');
    expect(objectRefListHtml([], resolve, "")).toBe("");
  });
});

describe("makeFieldLabelResolver", () => {
  const graph = graphWith({
    fields: [
      { fullyQualifiedName: "Claim__c.Status__c", label: "ステータス" },
      { fullyQualifiedName: "Account.Name", label: "Name" }, // label == short → 無視
      { fullyQualifiedName: "Order__c.Net_Amount__c", label: "正味金額" },
    ],
  });
  const resolve = makeFieldLabelResolver(graph);

  it("resolves a full Object.Field reference", () => {
    expect(resolve("Claim__c.Status__c")).toBe("ステータス");
    expect(resolve("Order__c.Net_Amount__c")).toBe("正味金額");
  });

  it("resolves a bare field name using the object context", () => {
    expect(resolve("Status__c", "Claim__c")).toBe("ステータス");
  });

  it("strips a leading Record. prefix (FlexiPage convention)", () => {
    expect(resolve("Record.Status__c", "Claim__c")).toBe("ステータス");
  });

  it("returns undefined when label equals the short API name", () => {
    expect(resolve("Account.Name")).toBeUndefined();
  });

  it("returns undefined for unknown fields", () => {
    expect(resolve("Claim__c.Nope__c")).toBeUndefined();
    expect(resolve("Ghost__c", "Claim__c")).toBeUndefined();
  });
});

describe("firstSentencePlain", () => {
  it("takes the first sentence and strips markdown markers", () => {
    expect(
      firstSentencePlain("**2 メソッド** / `SOQL 2 件` を含む 通常クラス。 主要メソッド: `foo`。"),
    ).toBe("2 メソッド / SOQL 2 件 を含む 通常クラス");
  });

  it("handles summaries without a trailing period", () => {
    expect(firstSentencePlain("シンプルな説明")).toBe("シンプルな説明");
  });
});
