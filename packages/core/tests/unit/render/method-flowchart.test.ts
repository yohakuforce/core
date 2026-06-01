import { describe, expect, it } from "vitest";
import { extractMethodControlFlows } from "../../../src/graph/extractors/apex-control-flow.js";
import { buildMethodFlowchart } from "../../../src/render/method-flowchart.js";

function flowFor(code: string, methodName: string) {
  const flows = extractMethodControlFlows(code);
  const f = flows.find((x) => x.methodName === methodName);
  if (f === undefined) throw new Error(`method ${methodName} not found`);
  return f;
}

describe("buildMethodFlowchart - 基本", () => {
  it("空メソッドは Start → End", () => {
    const f = flowFor("public class C { public void run() { } }", "run");
    const m = buildMethodFlowchart(f).mermaid;
    expect(m.startsWith("flowchart TD")).toBe(true);
    // 自然語化: 開始/終了ラベル
    expect(m).toContain('n_start(["開始: run"])');
    expect(m).toContain("n_end([終了])");
    expect(m).toContain("n_start --> n_end");
  });

  it("単純文を順次接続する", () => {
    const f = flowFor("public class C { public void run() { Integer a = 1; insert acc; } }", "run");
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain('"Integer a = 1"');
    expect(m).toContain("acc を登録"); // DML insert → 自然語
  });

  it("SOQL を自然語 (<obj> を取得) で出す", () => {
    const f = flowFor(
      "public class C { public void run() { List<Account> r = [SELECT Id FROM Account]; } }",
      "run",
    );
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain("Account を取得");
  });
});

describe("buildMethodFlowchart - if/else", () => {
  it("if-else に はい/いいえ ラベルを付ける", () => {
    const f = flowFor(
      "public class C { public void run() { if (x > 0) { return; } else { insert acc; } } }",
      "run",
    );
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain("|はい|");
    expect(m).toContain("|いいえ|");
  });

  it("else 無しの if は いいえ 側が join に直接行く", () => {
    const f = flowFor(
      "public class C { public void run() { if (x) { insert acc; } update b; } }",
      "run",
    );
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain("|はい|");
    expect(m).toContain("|いいえ|");
    // join ノード (空ラベル) が存在する
    expect(m).toMatch(/n\d+\(\( \)\)/);
  });
});

describe("buildMethodFlowchart - for/while", () => {
  it("for を自然語化し back-edge を点線で書く", () => {
    const f = flowFor(
      "public class C { public void run() { for (Account a : rows) { insert a; } } }",
      "run",
    );
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain("rows を 1 件ずつ繰り返す");
    expect(m).toContain("-.->|繰返|");
  });
});

describe("buildMethodFlowchart - try/catch", () => {
  it("try / catch / finally の各ブロックを自然語で描く", () => {
    const f = flowFor(
      "public class C { public void run() { try { insert a; } catch (DmlException e) { return; } finally { update b; } } }",
      "run",
    );
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain("例外処理");
    expect(m).toContain("DmlException を捕捉");
    expect(m).toContain("後処理（finally）");
  });
});

describe("buildMethodFlowchart - ノード詳細表", () => {
  it("各ノードに対応する details エントリが返る", () => {
    const f = flowFor(
      "public class C { public void run() { Integer a = 1; insert acc; if (x) return; } }",
      "run",
    );
    const out = buildMethodFlowchart(f);
    expect(out.details.length).toBeGreaterThanOrEqual(3);
    expect(out.details.find((d) => d.kind === "dml")).toBeDefined();
    expect(out.details.find((d) => d.kind === "if")).toBeDefined();
    expect(out.details.find((d) => d.kind === "return")).toBeDefined();
  });

  it("長い SOQL の fullText は途切れない", () => {
    const longSoql =
      "[SELECT Id, Name, AccountId, IsClosed FROM Opportunity WHERE Account.Industry = 'Finance' AND Amount > 100000 LIMIT 200]";
    const f = flowFor(
      `public class C { public void run() { List<Opportunity> r = ${longSoql}; } }`,
      "run",
    );
    const out = buildMethodFlowchart(f);
    const soql = out.details.find((d) => d.kind === "soql");
    expect(soql).toBeDefined();
    expect(soql?.fullText).toContain("LIMIT 200");
  });
});

describe("buildMethodFlowchart - 安全性", () => {
  it("メソッド名に Mermaid 特殊文字を含んでもラベルが壊れない", () => {
    // Apex 仕様上 ASCII のみだが、ガード
    const code = `public class C { public void run() { String s = "a\\"b"; return; } }`;
    const f = flowFor(code, "run");
    const m = buildMethodFlowchart(f).mermaid;
    expect(m).toContain("flowchart TD");
  });
});
