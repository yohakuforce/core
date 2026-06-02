import { describe, expect, it } from "vitest";
import {
  COMPONENT_TYPES,
  SECTION_IDS,
  SECTION_SCHEMA,
  applicableSectionsFor,
  auditSections,
  requiredSectionsFor,
} from "../../../src/html/sections.js";

describe("SECTION_SCHEMA", () => {
  it("21 項目すべて定義されている (12 基本 + 詳細設計 4 + Object周辺メタ 5)", () => {
    expect(SECTION_SCHEMA).toHaveLength(21);
    expect(SECTION_IDS).toHaveLength(21);
  });

  it("各セクションは全コンポーネントタイプの perType エントリを持つ", () => {
    for (const s of SECTION_SCHEMA) {
      for (const type of COMPONENT_TYPES) {
        expect(s.perType[type]).toBeDefined();
        expect(["required", "optional", "not-applicable"]).toContain(s.perType[type]);
      }
    }
  });

  it("SECTION_IDS は SECTION_SCHEMA と一致", () => {
    expect([...SECTION_IDS]).toEqual(SECTION_SCHEMA.map((s) => s.id));
  });
});

describe("requiredSectionsFor", () => {
  it("apex は 11 項目必須 (one-line, business, dep, public-if, data, internal-flow, io, test, change, impact, concerns, related = 12)", () => {
    // 仕様で apex は 12 項目全てが required (concerns 含む)
    const ids = requiredSectionsFor("apex");
    expect(ids).toContain("one-line-summary");
    expect(ids).toContain("concerns");
    expect(ids).toContain("related-domains");
  });

  it("trigger は public-interface / io-contract が外れる", () => {
    const ids = requiredSectionsFor("trigger");
    expect(ids).not.toContain("public-interface");
    expect(ids).not.toContain("io-contract");
    expect(ids).toContain("internal-flow");
  });

  it("object は public-interface 含むが test-coverage / concerns は外れる", () => {
    const ids = requiredSectionsFor("object");
    expect(ids).toContain("public-interface");
    expect(ids).not.toContain("test-coverage");
    expect(ids).not.toContain("concerns");
  });
});

describe("applicableSectionsFor", () => {
  it("not-applicable のセクションは除外される", () => {
    const ids = applicableSectionsFor("lwc");
    expect(ids).not.toContain("internal-flow");
    expect(ids).not.toContain("concerns");
  });
});

describe("auditSections", () => {
  it("required を全て満たせば missing は空", () => {
    const required = requiredSectionsFor("apex");
    const result = auditSections("apex", "AccountService", required);
    expect(result.missing).toEqual([]);
  });

  it("required の一部が欠けると missing に出る", () => {
    const required = requiredSectionsFor("apex");
    const partial = required.slice(0, required.length - 2);
    const result = auditSections("apex", "AccountService", partial);
    expect(result.missing.length).toBe(2);
  });

  it("type と componentName を返す", () => {
    const result = auditSections("trigger", "AccountTrigger", []);
    expect(result.type).toBe("trigger");
    expect(result.componentName).toBe("AccountTrigger");
  });
});
