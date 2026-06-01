import { describe, expect, it } from "vitest";
import {
  catchLabel,
  dmlLabel,
  ifLabel,
  loopLabel,
  returnLabel,
  soqlLabel,
  stmtLabel,
  throwLabel,
} from "../../../src/render/apex-node-label.js";

describe("apex-node-label 自然語化", () => {
  it("SOQL/DML を日本語化する", () => {
    expect(soqlLabel("Account")).toBe("Account を取得");
    expect(soqlLabel(null)).toBe("データを取得");
    expect(dmlLabel("insert", "o", false)).toBe("o を登録");
    expect(dmlLabel("update", "lst", false)).toBe("lst を更新");
    expect(dmlLabel("delete", "x", true)).toBe("x を削除（Database）");
  });

  it("return/throw を日本語化する", () => {
    expect(returnLabel("o.Id")).toBe("o.Id を返す");
    expect(returnLabel("")).toBe("処理を終了");
    expect(throwLabel("new AuraHandledException('x')")).toBe("AuraHandledException を送出");
  });

  it("条件を読みやすい日本語にする", () => {
    expect(ifLabel("accId == null")).toBe("accId が未設定");
    expect(ifLabel("x != null")).toBe("x が設定済");
    expect(ifLabel("a && b")).toBe("a かつ b");
    expect(ifLabel("a || b")).toBe("a または b");
    expect(ifLabel("lines.isEmpty()")).toBe("lines が空");
  });

  it("ループを 1 件ずつ繰り返す と表現する", () => {
    expect(loopLabel("for", "LineInput li : lines")).toBe("lines を 1 件ずつ繰り返す");
    expect(loopLabel("while", "i < n")).toContain("の間繰り返す");
  });

  it("catch / stmt を日本語化する", () => {
    expect(catchLabel("DmlException")).toBe("DmlException を捕捉");
    expect(stmtLabel("Order__c o = new Order__c(Status__c = 'Draft')")).toBe("Order__c を生成");
    expect(stmtLabel("ols.add(new Order_Line__c())")).toBe("Order_Line__c を生成してリストに追加");
    expect(stmtLabel("Integer a = 1")).toBe("Integer a = 1");
  });
});
