// yohaku init で利用者プロジェクトに展開する scaffold の eta 変数セット
// 標準は .agents/knowledge/decisions/2026-05-07-eta-variable-naming-convention.md に準拠

export type Profile = "minimal" | "standard" | "full";
export type PrimaryLanguage = "ja" | "en";
export type Segment = "enterprise" | "smb" | "vendor" | "unspecified";

export interface InitVariables {
  readonly projectName: string;
  readonly profile: Profile;
  readonly primaryLanguage: PrimaryLanguage;
  readonly salesforceApiVersion: string;
  readonly yohakuVersion: string;
  readonly segment: Segment;
  readonly repoUrl: string;
  readonly now: string;
  readonly enabledCommands: readonly string[];
  readonly enabledAgents: readonly string[];
  readonly includeDxMcpAdapter: boolean;
  readonly includeStaticAnalysis: boolean;
}

export interface InitOptions {
  readonly targetDir: string;
  readonly scaffoldDir: string;
  readonly variables: InitVariables;
  /** 既存ファイルの上書きポリシー */
  readonly conflict?: "skip" | "overwrite" | "rename";
}

export interface InitResult {
  readonly written: readonly string[];
  readonly skipped: readonly string[];
  readonly renamed: readonly { readonly from: string; readonly to: string }[];
}

export const PROFILE_DEFAULTS: ReadonlyMap<
  Profile,
  {
    readonly enabledCommands: readonly string[];
    readonly enabledAgents: readonly string[];
  }
> = new Map([
  [
    "minimal",
    {
      enabledCommands: ["onboard", "explain", "impact"],
      enabledAgents: ["graph-querier", "object-documenter"],
    },
  ],
  [
    "standard",
    {
      enabledCommands: [
        "onboard",
        "explain",
        "impact",
        "classify-diff",
        "change-summary",
        // v0.5.0 HTML 設計書パイプライン (日常運用)
        "yohaku-html-build",
        "yohaku-serve",
        "yohaku-domains",
        "yohaku-explain-prompts",
        "yohaku-html-write",
      ],
      enabledAgents: [
        "graph-querier",
        "object-documenter",
        "onboarding-guide",
        "review-assistant",
        "data-model-classifier",
        "automation-classifier",
        "permission-classifier",
        "ui-classifier",
        "logic-classifier",
      ],
    },
  ],
  [
    "full",
    {
      enabledCommands: [
        "onboard",
        "explain",
        "impact",
        "classify-diff",
        "change-summary",
        "release-prep",
        "manual-steps",
        // v0.5.0 HTML 設計書パイプライン (日常運用)
        "yohaku-html-build",
        "yohaku-serve",
        "yohaku-domains",
        "yohaku-explain-prompts",
        "yohaku-html-write",
        // v0.5.0 HTML パイプライン (リリース / QA 系、full のみ)
        "yohaku-diff-html",
        "yohaku-coverage-import",
      ],
      enabledAgents: [
        "graph-querier",
        "object-documenter",
        "onboarding-guide",
        "review-assistant",
        "release-advisor",
        "customer-impact-explainer",
        "data-model-classifier",
        "automation-classifier",
        "permission-classifier",
        "ui-classifier",
        "logic-classifier",
        "manual-step-extractor",
        "release-composer",
        "rollback-drafter",
      ],
    },
  ],
]);
