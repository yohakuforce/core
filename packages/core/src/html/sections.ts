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
  "processing-detail", // 6.5 処理詳細 (詳細設計: メソッド/要素単位の処理・分岐・計算・戻り値)
  "field-writes", // 6.6 項目値の割り当て (apex/trigger: 触れるオブジェクト別タブ、LLM抽出)
  "field-assignment", // 4.5 項目値の割り当て (詳細設計: 項目ごとの値の決まり方・書き込み元)
  "calculation-rules", // 4.6 計算項目・入力規則 (詳細設計: 数式/入力規則の算出ロジック)
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
    id: "processing-detail",
    label: "処理詳細",
    // 決定的スケルトン (メソッド統合表 + 制御フロー) の上に LLM 解説ブロックを重ねる
    source: "deterministic",
    perType: {
      apex: "optional",
      trigger: "optional",
      lwc: "not-applicable",
      object: "not-applicable",
      flow: "optional",
    },
  },
  {
    id: "field-writes",
    label: "項目値の割り当て",
    // タブ構造は決定的、各タブ内訳は LLM (ai_managed)
    source: "deterministic",
    perType: {
      apex: "optional",
      trigger: "optional",
      lwc: "not-applicable",
      object: "not-applicable",
      flow: "not-applicable",
    },
  },
  {
    id: "field-assignment",
    label: "項目値の割り当て",
    source: "deterministic",
    perType: {
      apex: "not-applicable",
      trigger: "not-applicable",
      lwc: "not-applicable",
      object: "optional",
      flow: "not-applicable",
    },
  },
  {
    id: "calculation-rules",
    label: "計算項目・入力規則",
    source: "deterministic",
    perType: {
      apex: "not-applicable",
      trigger: "not-applicable",
      lwc: "not-applicable",
      object: "optional",
      flow: "not-applicable",
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
