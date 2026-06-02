// ----------------------------------------------------------------------------
// Knowledge graph types
//
// JSON Schema 正本 (src/schema/graph.schema.json) と 1:1 で対応する。
// スキーマと型がズレた場合は schema.json を正本とし、本ファイルを更新する。
// 自動生成は Phase 1 後半で json-schema-to-typescript 等を導入予定。
// ----------------------------------------------------------------------------

export type SourceAdapterKind = "local" | "dx-mcp";

export type EntityKind =
  | "object"
  | "field"
  | "validationRule"
  | "flow"
  | "apexClass"
  | "apexTrigger"
  | "permissionSet"
  | "profile"
  | "recordType"
  | "approvalProcess"
  | "sharingRule"
  | "layout"
  | "customMetadataRecord"
  | "namedCredential"
  | "remoteSiteSetting"
  | "lwc"
  | "auraBundle"
  | "flexiPage"
  | "visualforcePage"
  | "visualforceComponent"
  | "customApplication"
  | "emailTemplate";

export type DependencyKind =
  | "references"
  | "extends"
  | "implements"
  | "queries"
  | "writes"
  | "triggers"
  | "grants"
  | "uses";

export type TagNamespace = "domain" | "feature" | "release" | "custom";

export interface EntityRef {
  readonly kind: EntityKind;
  readonly fullyQualifiedName: string;
}

export interface GraphMeta {
  readonly yohakuVersion: string;
  readonly builtAt: string;
  readonly sourceAdapter: SourceAdapterKind;
  readonly salesforceApiVersion: string;
  readonly sourceHash: string;
  readonly incremental?: boolean;
}

export interface SObject {
  readonly fullyQualifiedName: string;
  readonly label: string;
  readonly pluralLabel?: string;
  readonly description?: string;
  readonly isCustom: boolean;
  readonly sharingModel?:
    | "Private"
    | "Read"
    | "ReadSelect"
    | "ReadWrite"
    | "ReadWriteTransfer"
    | "FullAccess"
    | "ControlledByParent"
    | "ControlledByCampaign"
    | "ControlledByLeadOrContact";
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface Field {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly label?: string;
  readonly description?: string;
  readonly type: string;
  readonly required?: boolean;
  readonly unique?: boolean;
  readonly isCustom: boolean;
  readonly referenceTo?: readonly string[];
  readonly picklistValues?: readonly string[];
  /** 数式項目の計算式 (type=Formula 等)。詳細設計の「計算方法」算出に使用 */
  readonly formula?: string;
  /** 既定値の式/リテラル (defaultValue)。詳細設計の「項目値の割り当て」に使用 */
  readonly defaultValue?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface ValidationRule {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly active: boolean;
  readonly errorConditionFormula?: string;
  readonly errorMessage?: string;
  readonly errorDisplayField?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface Flow {
  readonly fullyQualifiedName: string;
  readonly label?: string;
  readonly description?: string;
  readonly type: string;
  readonly status: "Active" | "Draft" | "Obsolete" | "InvalidDraft";
  readonly triggeringObject?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
  readonly body?: FlowBodyInfo;
}

export interface ApexClass {
  readonly fullyQualifiedName: string;
  readonly apiVersion: string;
  readonly isTest: boolean;
  readonly isInterface?: boolean;
  readonly isAbstract?: boolean;
  readonly linesOfCode?: number;
  readonly sourcePath: string;
  readonly contentHash: string;
  readonly body?: ApexBodyInfo;
}

export type ApexVisibility = "public" | "private" | "protected" | "global";
export type ApexDmlKind = "insert" | "update" | "delete" | "upsert" | "undelete" | "merge";

export interface ApexMethodInfo {
  readonly name: string;
  readonly visibility: ApexVisibility;
  readonly isStatic: boolean;
  readonly returnType: string;
  readonly parameters: string;
  readonly annotations: readonly string[];
}

export interface ApexSoqlInfo {
  readonly raw: string;
  readonly primaryObject: string | null;
}

export interface ApexDmlInfo {
  readonly kind: ApexDmlKind;
  readonly target: string;
  readonly viaDatabaseClass: boolean;
}

export interface ApexClassReferenceInfo {
  readonly className: string;
  readonly memberName: string;
}

export interface ApexBodyInfo {
  readonly methods: readonly ApexMethodInfo[];
  readonly soqlQueries: readonly ApexSoqlInfo[];
  readonly dmlOperations: readonly ApexDmlInfo[];
  readonly classReferences: readonly ApexClassReferenceInfo[];
  readonly classAnnotations: readonly string[];
  readonly hasTryCatch: boolean;
  readonly hasCallout: boolean;
  /** メソッド単位の制御フロー (Phase 8-B1)。recursive 構造のため JSON シリアライズ可。 */
  readonly controlFlows?: readonly ApexMethodControlFlow[];
}

export interface ApexMethodControlFlow {
  readonly methodName: string;
  readonly signature: string;
  readonly nodes: readonly ApexControlFlowNode[];
}

export type ApexControlFlowNode =
  | { readonly kind: "soql"; readonly raw: string; readonly primaryObject: string | null }
  | {
      readonly kind: "dml";
      readonly verb: ApexDmlKind;
      readonly target: string;
      readonly viaDatabaseClass: boolean;
    }
  | {
      readonly kind: "if";
      readonly condition: string;
      readonly thenNodes: readonly ApexControlFlowNode[];
      readonly elseNodes: readonly ApexControlFlowNode[];
    }
  | { readonly kind: "for"; readonly header: string; readonly body: readonly ApexControlFlowNode[] }
  | {
      readonly kind: "while";
      readonly header: string;
      readonly body: readonly ApexControlFlowNode[];
    }
  | {
      readonly kind: "try";
      readonly tryNodes: readonly ApexControlFlowNode[];
      readonly catches: readonly {
        readonly exceptionType: string;
        readonly nodes: readonly ApexControlFlowNode[];
      }[];
      readonly finallyNodes: readonly ApexControlFlowNode[];
    }
  | { readonly kind: "return"; readonly expression: string }
  | { readonly kind: "throw"; readonly expression: string }
  | { readonly kind: "stmt"; readonly text: string };

export type ApexTriggerEvent =
  | "beforeInsert"
  | "afterInsert"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete"
  | "afterUndelete";

export interface ApexTrigger {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly events: readonly ApexTriggerEvent[];
  readonly apiVersion: string;
  readonly sourcePath: string;
  readonly contentHash: string;
  readonly body?: ApexBodyInfo;
}

export type FlowElementKind =
  | "recordLookup"
  | "recordCreate"
  | "recordUpdate"
  | "recordDelete"
  | "decision"
  | "assignment"
  | "loop"
  | "actionCall"
  | "subflow"
  | "screen"
  | "wait";

export interface FlowElementInfo {
  readonly name: string;
  readonly kind: FlowElementKind;
  readonly label?: string;
  readonly target?: string;
}

export interface FlowBodyInfo {
  readonly elements: readonly FlowElementInfo[];
  readonly subflows: readonly string[];
  readonly recordObjects: readonly string[];
  readonly actionCalls: readonly string[];
  readonly edges?: readonly FlowEdgeInfo[];
  readonly startTarget?: string;
}

export interface FlowEdgeInfo {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly kind: "next" | "rule" | "default" | "fault" | "loop" | "noMore" | "start";
}

export interface PermissionSet {
  readonly fullyQualifiedName: string;
  readonly label: string;
  readonly description?: string;
  readonly license?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
  readonly body?: PermissionSetBodyInfo;
}

export interface PermissionSetBodyInfo {
  readonly objectPermissions: readonly ObjectPermissionInfo[];
  readonly fieldPermissions: readonly FieldPermissionInfo[];
  readonly classAccesses: readonly ClassAccessInfo[];
  readonly userPermissions: readonly string[];
  /** タブ表示設定 (任意: 既存互換のため optional) */
  readonly tabSettings?: readonly TabVisibilityInfo[];
  /** レコードタイプ表示 (任意) */
  readonly recordTypeVisibilities?: readonly RecordTypeVisibilityInfo[];
  /** アプリケーション表示 (任意) */
  readonly applicationVisibilities?: readonly AppVisibilityInfo[];
  /** カスタム権限 (任意) */
  readonly customPermissions?: readonly string[];
}

export interface TabVisibilityInfo {
  readonly tab: string;
  readonly visibility: string; // DefaultOn / DefaultOff(Available) / Hidden
}

export interface RecordTypeVisibilityInfo {
  readonly recordType: string;
  readonly visible: boolean;
  readonly default: boolean;
}

export interface AppVisibilityInfo {
  readonly application: string;
  readonly visible: boolean;
  readonly default: boolean;
}

export interface ObjectPermissionInfo {
  readonly object: string;
  readonly create: boolean;
  readonly read: boolean;
  readonly edit: boolean;
  readonly delete: boolean;
  readonly viewAll: boolean;
  readonly modifyAll: boolean;
}

export interface FieldPermissionInfo {
  readonly field: string;
  readonly readable: boolean;
  readonly editable: boolean;
}

export interface ClassAccessInfo {
  readonly apexClass: string;
  readonly enabled: boolean;
}

export interface Profile {
  readonly fullyQualifiedName: string;
  readonly userLicense?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
  /** PermissionSet と同形式の権限ボディ (Phase 10-A) */
  readonly body?: PermissionSetBodyInfo;
}

export interface RecordType {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly label?: string;
  readonly description?: string;
  readonly active: boolean;
  readonly sourcePath: string;
  readonly contentHash: string;
}

// ===== ApprovalProcess (Phase 9-B2) =====

export interface ApprovalProcess {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly label?: string;
  readonly description?: string;
  readonly active: boolean;
  readonly entryCriteria: readonly ApprovalCriterion[];
  readonly steps: readonly ApprovalStepInfo[];
  readonly initialSubmissionActions: readonly ApprovalActionInfo[];
  readonly finalApprovalActions: readonly ApprovalActionInfo[];
  readonly finalRejectionActions: readonly ApprovalActionInfo[];
  readonly recallActions: readonly ApprovalActionInfo[];
  readonly recordEditability?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface ApprovalCriterion {
  readonly field: string;
  readonly operation: string;
  readonly value: string;
}

export type ApprovalIfNotMet = "ApproveRecord" | "RejectRequest" | "GoToNextStep" | "Unknown";

export interface ApprovalStepInfo {
  readonly name: string;
  readonly label?: string;
  readonly description?: string;
  readonly approverType: string; // userHierarchyField / queue / user / related / role / manualSelection
  readonly approverDetail?: string; // field name / queue name / user reference
  readonly allowDelegate: boolean;
  readonly ifCriteriaNotMet: ApprovalIfNotMet;
  readonly entryCriteria: readonly ApprovalCriterion[];
}

export interface ApprovalActionInfo {
  readonly name: string;
  readonly type: string;
}

// ===== Layout (Phase 10-B) =====

export interface Layout {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly layoutName: string;
  readonly sections: readonly LayoutSectionInfo[];
  readonly relatedLists: readonly LayoutRelatedListInfo[];
  readonly quickActions: readonly string[];
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface LayoutSectionInfo {
  readonly label: string;
  readonly columnsStyle?: string;
  readonly items: readonly LayoutItemInfo[];
}

export interface LayoutItemInfo {
  readonly field: string;
  readonly behavior: string; // Edit / Readonly / Required
  readonly column: number;
}

export interface LayoutRelatedListInfo {
  readonly relatedList: string;
  readonly fields: readonly string[];
}

// ===== CustomMetadata Record (Phase 10-C) =====

export interface CustomMetadataRecord {
  readonly fullyQualifiedName: string; // <Type>.<RecordDeveloperName>
  readonly type: string; // Type fullName (e.g., `Tax_Setting__mdt`)
  readonly recordName: string;
  readonly label?: string;
  readonly protected?: boolean;
  readonly values: readonly CustomMetadataValueInfo[];
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface CustomMetadataValueInfo {
  readonly field: string;
  readonly value: string;
}

// ===== NamedCredential / RemoteSiteSetting (Phase 10-D) =====

export interface NamedCredential {
  readonly fullyQualifiedName: string;
  readonly label?: string;
  readonly endpoint?: string; // 機微度低 (URL のみ。認証情報は別)
  readonly principalType?: string;
  readonly protocol?: string;
  readonly hasSecret: boolean; // password / oauthToken の存在
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface RemoteSiteSetting {
  readonly fullyQualifiedName: string;
  readonly url?: string;
  readonly description?: string;
  readonly active: boolean;
  readonly disableProtocolSecurity: boolean;
  readonly sourcePath: string;
  readonly contentHash: string;
}

// ===== Lightning Web Component (Phase 11-A) =====

export interface LightningWebComponent {
  readonly fullyQualifiedName: string; // bundle 名 (例: claimDashboard)
  readonly apiVersion?: string;
  readonly masterLabel?: string;
  readonly description?: string;
  readonly isExposed: boolean;
  readonly targets: readonly string[];
  readonly hasHtml: boolean;
  readonly hasCss: boolean;
  readonly apexImports: readonly LwcApexImportInfo[];
  readonly labelImports: readonly string[];
  readonly publicProperties: readonly string[]; // @api 名一覧
  readonly wires: readonly LwcWireInfo[];
  readonly customEvents: readonly string[]; // dispatchEvent された CustomEvent 名
  readonly childComponents: readonly string[]; // <c-foo-bar /> の component 名
  readonly standardComponents: readonly LwcStandardComponentCount[];
  readonly directives: readonly string[]; // lwc:if / lwc:for-each など (重複排除)
  readonly sourcePath: string; // .js-meta.xml の相対パス
  readonly contentHash: string;
}

export interface LwcApexImportInfo {
  readonly methodAlias: string;
  readonly className: string;
  readonly methodName: string;
}

export interface LwcWireInfo {
  readonly target: string; // adapter 名
  readonly bindingProperty?: string; // @wire(...) の上のプロパティ/メソッド名
}

export interface LwcStandardComponentCount {
  readonly tag: string; // lightning-card など
  readonly count: number;
}

// ===== Aura Component Bundle (Phase 11-B) =====

export type AuraBundleKind = "Component" | "Application" | "Event" | "Interface" | "Tokens";

export interface AuraBundle {
  readonly fullyQualifiedName: string;
  readonly bundleKind: AuraBundleKind;
  readonly apiVersion?: string;
  readonly description?: string;
  readonly hasController: boolean;
  readonly hasHelper: boolean;
  readonly hasRenderer: boolean;
  readonly hasStyle: boolean;
  readonly attributes: readonly string[]; // <aura:attribute name=...> の名前一覧 (軽量)
  readonly handlers: readonly string[]; // <aura:handler event=...> の event
  readonly sourcePath: string; // .cmp-meta.xml の相対パス
  readonly contentHash: string;
}

// ===== FlexiPage (Phase 11-C) =====

export interface FlexiPage {
  readonly fullyQualifiedName: string;
  readonly type?: string; // RecordPage / AppPage / HomePage など
  readonly sobjectType?: string;
  readonly pageTemplate?: string;
  readonly masterLabel?: string;
  readonly description?: string;
  readonly regions: readonly FlexiPageRegionInfo[];
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface FlexiPageRegionInfo {
  readonly name: string;
  readonly type?: string;
  readonly items: readonly FlexiPageItemInfo[];
}

export interface FlexiPageItemInfo {
  readonly componentName?: string;
  readonly fieldName?: string;
}

// ===== Visualforce (Phase 12-B1 / 12-B2) =====

export interface VisualforcePage {
  readonly fullyQualifiedName: string;
  readonly apiVersion?: string;
  readonly label?: string;
  readonly description?: string;
  readonly controller?: string;
  readonly extensions: readonly string[];
  readonly standardController?: string;
  readonly renderAs?: string; // "pdf" など
  readonly availableInTouch?: boolean;
  readonly confirmationTokenRequired?: boolean;
  readonly hasMarkup: boolean;
  readonly markupCounts: readonly VfMarkupCount[]; // <apex:repeat>, <apex:form> など
  readonly methodReferences: readonly string[]; // {!controller.method} の method 部分
  readonly sourcePath: string; // .page-meta.xml の相対パス
  readonly contentHash: string;
}

export interface VisualforceComponent {
  readonly fullyQualifiedName: string;
  readonly apiVersion?: string;
  readonly label?: string;
  readonly description?: string;
  readonly controller?: string;
  readonly attributes: readonly VfComponentAttribute[];
  readonly hasMarkup: boolean;
  readonly markupCounts: readonly VfMarkupCount[];
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface VfComponentAttribute {
  readonly name: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly description?: string;
}

export interface VfMarkupCount {
  readonly tag: string;
  readonly count: number;
}

// ===== Lightning App / CustomApplication (Phase 12-B3) =====

export interface CustomApplication {
  readonly fullyQualifiedName: string;
  readonly label?: string;
  readonly description?: string;
  readonly navType?: string; // Standard / Console
  readonly formFactors: readonly string[]; // Large / Small
  readonly tabs: readonly string[];
  readonly utilityBar?: string;
  readonly brandColor?: string;
  readonly logo?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
}

// ===== SharingRule (Phase 9-B3) =====

export type SharingRuleKind = "criteriaBased" | "ownerBased" | "territoryBased";
export type SharingAccessLevel = "Read" | "Edit" | "ReadWrite";

export interface SharingRule {
  readonly fullyQualifiedName: string;
  readonly object: string;
  readonly kind: SharingRuleKind;
  readonly label?: string;
  readonly description?: string;
  readonly accessLevel: string; // Read / Edit / ReadWrite / etc.
  readonly sharedTo: SharedToInfo;
  readonly criteriaItems: readonly SharingCriterion[];
  readonly criteriaBooleanFilter?: string;
  readonly ownerSource?: string; // for ownerBased: source group/role
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface SharingCriterion {
  readonly field: string;
  readonly operation: string;
  readonly value: string;
}

export interface SharedToInfo {
  readonly type: string; // role / group / roleAndSubordinates / etc.
  readonly target?: string;
}

// ===== EmailTemplate (Phase: 詳細設計書化) =====

export interface EmailTemplate {
  readonly fullyQualifiedName: string; // folder/DeveloperName
  readonly name?: string; // 表示ラベル
  readonly subject?: string; // 件名
  readonly type?: string; // text / html / custom / visualforce
  readonly uiType?: string;
  readonly encodingKey?: string;
  readonly available?: boolean;
  readonly description?: string;
  readonly sourcePath: string;
  readonly contentHash: string;
}

export interface Dependency {
  readonly from: EntityRef;
  readonly to: EntityRef;
  readonly kind: DependencyKind;
  readonly evidencePath?: string;
}

export interface Tag {
  readonly entity: EntityRef;
  readonly namespace: TagNamespace;
  readonly value: string;
}

export interface KnowledgeGraph {
  readonly meta: GraphMeta;
  readonly objects: readonly SObject[];
  readonly fields: readonly Field[];
  readonly validationRules: readonly ValidationRule[];
  readonly flows: readonly Flow[];
  readonly apexClasses: readonly ApexClass[];
  readonly apexTriggers: readonly ApexTrigger[];
  readonly permissionSets: readonly PermissionSet[];
  readonly profiles: readonly Profile[];
  readonly recordTypes: readonly RecordType[];
  readonly approvalProcesses: readonly ApprovalProcess[];
  readonly sharingRules: readonly SharingRule[];
  readonly layouts: readonly Layout[];
  readonly customMetadataRecords: readonly CustomMetadataRecord[];
  readonly namedCredentials: readonly NamedCredential[];
  readonly remoteSiteSettings: readonly RemoteSiteSetting[];
  readonly lwcs: readonly LightningWebComponent[];
  readonly auraBundles: readonly AuraBundle[];
  readonly flexiPages: readonly FlexiPage[];
  readonly visualforcePages: readonly VisualforcePage[];
  readonly visualforceComponents: readonly VisualforceComponent[];
  readonly customApplications: readonly CustomApplication[];
  /** メールテンプレート (任意フィールド: 既存グラフ構築箇所との互換のため optional) */
  readonly emailTemplates?: readonly EmailTemplate[];
  readonly dependencies: readonly Dependency[];
  readonly tags: readonly Tag[];
}
