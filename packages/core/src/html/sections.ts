// ----------------------------------------------------------------------------
// HTML section schema
//
// Component leaf HTML の「抜け漏れ防止」セクションを宣言的に定義する。
// --strict ビルドでは、各コンポーネントタイプに対応する REQUIRED セクションが
// in-memory ViewModel に揃わない場合に fail させる (Phase 1+ で enforce)。
// ----------------------------------------------------------------------------

export const COMPONENT_TYPES = ["apex", "trigger", "lwc", "object", "flow"] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const SECTION_IDS = [
  "one-line-summary", // 1. 一行サマリ (決定的)
  "business-meaning", // 2. 業務的意味づけ (LLM, 編集マーカー内)
  "dependencies", // 3. 依存関係 (callers / callees / used-by)
  "public-interface", // 4. 公開インターフェース
  "data-model-touchpoints", // 5. データモデル接点 (参照Object/Field)
  "internal-flow", // 6. 内部処理フロー (method-flowchart 等)
  "io-contract", // 7. 入出力契約 (params/returns / handlers)
  "test-coverage", // 8. テスト被覆 (既存テストへのリンク)
  "change-history", // 9. 変更履歴 (直近 N コミット)
  "impact-hint", // 10. 影響範囲ヒント (yohaku impact <name>)
  "concerns", // 11. 既知の懸念 (SOQLループ・hard-coded ID 等)
  "related-domains", // 12. 関連ドメイン (index 階層へのリンク)
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type SectionRequirement = "required" | "optional" | "not-applicable";

export interface SectionDescriptor {
  readonly id: SectionId;
  /** 日本語の表示名 */
  readonly label: string;
  /** データ由来: deterministic | llm */
  readonly source: "deterministic" | "llm";
  /** 各タイプでの要件 */
  readonly perType: Readonly<Record<ComponentType, SectionRequirement>>;
}

// 提案承認済みの12項目セクション仕様
// - 表現の凡例: required = 必須、optional = 任意、not-applicable = 出力対象外
export const SECTION_SCHEMA: readonly SectionDescriptor[] = [
  {
    id: "one-line-summary",
    label: "一行サマリ",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "required",
      flow: "required",
    },
  },
  {
    id: "business-meaning",
    label: "業務的意味づけ",
    source: "llm",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "required",
      flow: "required",
    },
  },
  {
    id: "dependencies",
    label: "依存関係",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "required",
      flow: "required",
    },
  },
  {
    id: "public-interface",
    label: "公開インターフェース",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "not-applicable",
      lwc: "required",
      object: "required",
      flow: "not-applicable",
    },
  },
  {
    id: "data-model-touchpoints",
    label: "データモデル接点",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "not-applicable",
      flow: "required",
    },
  },
  {
    id: "internal-flow",
    label: "内部処理フロー",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "not-applicable",
      object: "not-applicable",
      flow: "required",
    },
  },
  {
    id: "io-contract",
    label: "入出力契約",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "not-applicable",
      lwc: "required",
      object: "not-applicable",
      flow: "required",
    },
  },
  {
    id: "test-coverage",
    label: "テスト被覆",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "not-applicable",
      flow: "not-applicable",
    },
  },
  {
    id: "change-history",
    label: "変更履歴",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "required",
      flow: "required",
    },
  },
  {
    id: "impact-hint",
    label: "影響範囲ヒント",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "required",
      flow: "required",
    },
  },
  {
    id: "concerns",
    label: "既知の懸念",
    source: "llm",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "not-applicable",
      object: "not-applicable",
      flow: "not-applicable",
    },
  },
  {
    id: "related-domains",
    label: "関連ドメイン",
    source: "deterministic",
    perType: {
      apex: "required",
      trigger: "required",
      lwc: "required",
      object: "required",
      flow: "required",
    },
  },
];

export function requiredSectionsFor(type: ComponentType): readonly SectionId[] {
  return SECTION_SCHEMA.filter((s) => s.perType[type] === "required").map((s) => s.id);
}

export function applicableSectionsFor(type: ComponentType): readonly SectionId[] {
  return SECTION_SCHEMA.filter((s) => s.perType[type] !== "not-applicable").map((s) => s.id);
}

export interface SectionAuditResult {
  readonly type: ComponentType;
  readonly componentName: string;
  readonly missing: readonly SectionId[];
}

/**
 * ViewModel が必要セクションを満たしているか判定する。
 * --strict ビルドでは missing が空でなければ fail させる。
 */
export function auditSections(
  type: ComponentType,
  componentName: string,
  providedSectionIds: Iterable<string>,
): SectionAuditResult {
  const provided = new Set<string>(providedSectionIds);
  const required = requiredSectionsFor(type);
  const missing = required.filter((id) => !provided.has(id));
  return { type, componentName, missing };
}
