import { describe, expect, it } from "vitest";
import {
  dmlKindJa,
  leadingFieldToken,
  splitOrderByKeys,
  splitWhereConditions,
} from "../../../src/html/viewmodel/detail-format.js";

describe("dmlKindJa", () => {
  it("maps DML kinds to Japanese", () => {
    expect(dmlKindJa("insert")).toBe("新規作成");
    expect(dmlKindJa("update")).toBe("更新");
    expect(dmlKindJa("delete")).toBe("削除");
  });
});

describe("splitWhereConditions", () => {
  it("splits on top-level AND/OR, preserving the connector", () => {
    expect(splitWhereConditions("Tier__c = 'Gold' AND CreatedDate > :dt")).toEqual([
      { text: "Tier__c = 'Gold'" },
      { connector: "AND", text: "CreatedDate > :dt" },
    ]);
  });

  it("does not split inside a string literal", () => {
    expect(splitWhereConditions("Name = 'A and B'")).toEqual([{ text: "Name = 'A and B'" }]);
  });

  it("does not split inside parentheses", () => {
    expect(splitWhereConditions("(A = 1 OR B = 2) AND C = 3")).toEqual([
      { text: "(A = 1 OR B = 2)" },
      { connector: "AND", text: "C = 3" },
    ]);
  });

  it("does not treat 'AND' inside an identifier as a connector", () => {
    expect(splitWhereConditions("BRAND__c = 'X'")).toEqual([{ text: "BRAND__c = 'X'" }]);
  });
});

describe("splitOrderByKeys", () => {
  it("splits multiple sort keys on commas", () => {
    expect(splitOrderByKeys("Name DESC, CreatedDate ASC")).toEqual(["Name DESC", "CreatedDate ASC"]);
  });
});

describe("leadingFieldToken", () => {
  it("extracts the leading field of a condition", () => {
    expect(leadingFieldToken("Tier__c = 'Gold'")).toBe("Tier__c");
    expect(leadingFieldToken("Account.Name LIKE 'A%'")).toBe("Account.Name");
  });

  it("returns undefined for functions / parens / negation", () => {
    expect(leadingFieldToken("COUNT(Id) > 0")).toBeUndefined();
    expect(leadingFieldToken("(A = 1)")).toBeUndefined();
    expect(leadingFieldToken("NOT IsActive__c")).toBeUndefined();
  });
});
