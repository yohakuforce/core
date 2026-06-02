import type {
  ApexBodyInfo,
  ApexClass,
  ApexTrigger,
  ApexTriggerEvent,
  ApprovalActionInfo,
  ApprovalCriterion,
  ApprovalProcess,
  ApprovalStepInfo,
  AuraBundle,
  AuraBundleKind,
  CustomApplication,
  CustomMetadataRecord,
  CustomMetadataValueInfo,
  EmailTemplate,
  Field,
  FlexiPage,
  FlexiPageRegionInfo,
  Flow,
  FlowBodyInfo,
  KnowledgeGraph,
  Layout,
  LayoutRelatedListInfo,
  LayoutSectionInfo,
  LightningWebComponent,
  LwcApexImportInfo,
  LwcStandardComponentCount,
  LwcWireInfo,
  NamedCredential,
  PermissionSet,
  PermissionSetBodyInfo,
  Profile,
  RecordType,
  RemoteSiteSetting,
  SObject,
  SharedToInfo,
  SharingCriterion,
  SharingRule,
  SharingRuleKind,
  ValidationRule,
  VfComponentAttribute,
  VfMarkupCount,
  VisualforceComponent,
  VisualforcePage,
} from "../types/graph.js";
import { SqliteGraphStore } from "./sqlite-store.js";

export interface ReaderOptions {
  readonly dbPath: string;
}

interface MetaRow {
  readonly key: string;
  readonly value: string;
}

interface ObjectRow {
  readonly fqn: string;
  readonly label: string;
  readonly plural_label: string | null;
  readonly description: string | null;
  readonly is_custom: number;
  readonly sharing_model: string | null;
  readonly source_path: string;
  readonly content_hash: string;
}

interface FieldRow {
  readonly fqn: string;
  readonly object: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly type: string;
  readonly required: number | null;
  readonly is_unique: number | null;
  readonly is_custom: number;
  readonly reference_to_json: string | null;
  readonly picklist_values_json: string | null;
  readonly formula: string | null;
  readonly default_value: string | null;
  readonly source_path: string;
  readonly content_hash: string;
}

interface ValidationRuleRow {
  readonly fqn: string;
  readonly object: string;
  readonly active: number;
  readonly error_condition_formula: string | null;
  readonly error_message: string | null;
  readonly error_display_field: string | null;
  readonly source_path: string;
  readonly content_hash: string;
}

interface FlowRow {
  readonly fqn: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly type: string;
  readonly status: string;
  readonly triggering_object: string | null;
  readonly source_path: string;
  readonly content_hash: string;
  readonly body_json: string | null;
}

interface ApexClassRow {
  readonly fqn: string;
  readonly api_version: string;
  readonly is_test: number;
  readonly is_interface: number | null;
  readonly is_abstract: number | null;
  readonly lines_of_code: number | null;
  readonly source_path: string;
  readonly content_hash: string;
  readonly body_json: string | null;
}

interface ApexTriggerRow {
  readonly fqn: string;
  readonly object: string;
  readonly events_json: string;
  readonly api_version: string;
  readonly source_path: string;
  readonly content_hash: string;
  readonly body_json: string | null;
}

interface PermissionSetRow {
  readonly fqn: string;
  readonly label: string;
  readonly description: string | null;
  readonly license: string | null;
  readonly source_path: string;
  readonly content_hash: string;
  readonly body_json: string | null;
}

interface ProfileRow {
  readonly fqn: string;
  readonly user_license: string | null;
  readonly source_path: string;
  readonly content_hash: string;
  readonly body_json: string | null;
}

interface RecordTypeRow {
  readonly fqn: string;
  readonly object: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly active: number;
  readonly source_path: string;
  readonly content_hash: string;
}

const DEFAULT_API = "62.0";

function parseApexBody(json: string | null): ApexBodyInfo | undefined {
  if (json === null) return undefined;
  try {
    return JSON.parse(json) as ApexBodyInfo;
  } catch {
    return undefined;
  }
}

function parseFlowBody(json: string | null): FlowBodyInfo | undefined {
  if (json === null) return undefined;
  try {
    return JSON.parse(json) as FlowBodyInfo;
  } catch {
    return undefined;
  }
}

function parsePermissionSetBody(json: string | null): PermissionSetBodyInfo | undefined {
  if (json === null) return undefined;
  try {
    return JSON.parse(json) as PermissionSetBodyInfo;
  } catch {
    return undefined;
  }
}

export class KnowledgeGraphReader {
  readonly #store: SqliteGraphStore;

  constructor(options: ReaderOptions) {
    this.#store = new SqliteGraphStore({ dbPath: options.dbPath });
  }

  close(): void {
    this.#store.close();
  }

  read(): KnowledgeGraph {
    return {
      meta: this.readMeta(),
      objects: this.readObjects(),
      fields: this.readFields(),
      validationRules: this.readValidationRules(),
      flows: this.readFlows(),
      apexClasses: this.readApexClasses(),
      apexTriggers: this.readApexTriggers(),
      permissionSets: this.readPermissionSets(),
      profiles: this.readProfiles(),
      recordTypes: this.readRecordTypes(),
      approvalProcesses: this.readApprovalProcesses(),
      sharingRules: this.readSharingRules(),
      layouts: this.readLayouts(),
      customMetadataRecords: this.readCustomMetadataRecords(),
      namedCredentials: this.readNamedCredentials(),
      remoteSiteSettings: this.readRemoteSiteSettings(),
      lwcs: this.readLwcs(),
      auraBundles: this.readAuraBundles(),
      flexiPages: this.readFlexiPages(),
      visualforcePages: this.readVisualforcePages(),
      visualforceComponents: this.readVisualforceComponents(),
      customApplications: this.readCustomApplications(),
      emailTemplates: this.readEmailTemplates(),
      dependencies: [],
      tags: [],
    };
  }

  private readVisualforcePages(): readonly VisualforcePage[] {
    interface Row {
      readonly fqn: string;
      readonly api_version: string | null;
      readonly label: string | null;
      readonly description: string | null;
      readonly controller: string | null;
      readonly standard_controller: string | null;
      readonly render_as: string | null;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, api_version, label, description, controller, standard_controller, render_as, body_json, source_path, content_hash FROM visualforce_pages",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          extensions: readonly string[];
          availableInTouch?: boolean;
          confirmationTokenRequired?: boolean;
          hasMarkup: boolean;
          markupCounts: readonly VfMarkupCount[];
          methodReferences: readonly string[];
        };
        return {
          fullyQualifiedName: r.fqn,
          apiVersion: r.api_version ?? undefined,
          label: r.label ?? undefined,
          description: r.description ?? undefined,
          controller: r.controller ?? undefined,
          extensions: body.extensions,
          standardController: r.standard_controller ?? undefined,
          renderAs: r.render_as ?? undefined,
          availableInTouch: body.availableInTouch,
          confirmationTokenRequired: body.confirmationTokenRequired,
          hasMarkup: body.hasMarkup,
          markupCounts: body.markupCounts,
          methodReferences: body.methodReferences,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readVisualforceComponents(): readonly VisualforceComponent[] {
    interface Row {
      readonly fqn: string;
      readonly api_version: string | null;
      readonly label: string | null;
      readonly description: string | null;
      readonly controller: string | null;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, api_version, label, description, controller, body_json, source_path, content_hash FROM visualforce_components",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          attributes: readonly VfComponentAttribute[];
          hasMarkup: boolean;
          markupCounts: readonly VfMarkupCount[];
        };
        return {
          fullyQualifiedName: r.fqn,
          apiVersion: r.api_version ?? undefined,
          label: r.label ?? undefined,
          description: r.description ?? undefined,
          controller: r.controller ?? undefined,
          attributes: body.attributes,
          hasMarkup: body.hasMarkup,
          markupCounts: body.markupCounts,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readCustomApplications(): readonly CustomApplication[] {
    interface Row {
      readonly fqn: string;
      readonly label: string | null;
      readonly description: string | null;
      readonly nav_type: string | null;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, label, description, nav_type, body_json, source_path, content_hash FROM custom_applications",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          formFactors: readonly string[];
          tabs: readonly string[];
          utilityBar?: string;
          brandColor?: string;
          logo?: string;
        };
        return {
          fullyQualifiedName: r.fqn,
          label: r.label ?? undefined,
          description: r.description ?? undefined,
          navType: r.nav_type ?? undefined,
          formFactors: body.formFactors,
          tabs: body.tabs,
          utilityBar: body.utilityBar,
          brandColor: body.brandColor,
          logo: body.logo,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readEmailTemplates(): readonly EmailTemplate[] {
    interface Row {
      readonly fqn: string;
      readonly name: string | null;
      readonly subject: string | null;
      readonly type: string | null;
      readonly ui_type: string | null;
      readonly encoding_key: string | null;
      readonly available: number | null;
      readonly description: string | null;
      readonly source_path: string;
      readonly content_hash: string;
    }
    // 旧 DB (テーブル未作成) でも壊れないよう防御
    let rows: readonly Row[];
    try {
      rows = this.#store.query<Row>(
        "SELECT fqn, name, subject, type, ui_type, encoding_key, available, description, source_path, content_hash FROM email_templates",
      );
    } catch {
      return [];
    }
    return rows.map((r) => ({
      fullyQualifiedName: r.fqn,
      name: r.name ?? undefined,
      subject: r.subject ?? undefined,
      type: r.type ?? undefined,
      uiType: r.ui_type ?? undefined,
      encodingKey: r.encoding_key ?? undefined,
      available: r.available === null ? undefined : r.available === 1,
      description: r.description ?? undefined,
      sourcePath: r.source_path,
      contentHash: r.content_hash,
    }));
  }

  private readLwcs(): readonly LightningWebComponent[] {
    interface Row {
      readonly fqn: string;
      readonly api_version: string | null;
      readonly master_label: string | null;
      readonly description: string | null;
      readonly is_exposed: number;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, api_version, master_label, description, is_exposed, body_json, source_path, content_hash FROM lwcs",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          targets: readonly string[];
          hasHtml: boolean;
          hasCss: boolean;
          apexImports: readonly LwcApexImportInfo[];
          labelImports: readonly string[];
          publicProperties: readonly string[];
          wires: readonly LwcWireInfo[];
          customEvents: readonly string[];
          childComponents: readonly string[];
          standardComponents: readonly LwcStandardComponentCount[];
          directives: readonly string[];
        };
        return {
          fullyQualifiedName: r.fqn,
          apiVersion: r.api_version ?? undefined,
          masterLabel: r.master_label ?? undefined,
          description: r.description ?? undefined,
          isExposed: r.is_exposed === 1,
          targets: body.targets,
          hasHtml: body.hasHtml,
          hasCss: body.hasCss,
          apexImports: body.apexImports,
          labelImports: body.labelImports,
          publicProperties: body.publicProperties,
          wires: body.wires,
          customEvents: body.customEvents,
          childComponents: body.childComponents,
          standardComponents: body.standardComponents,
          directives: body.directives,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readAuraBundles(): readonly AuraBundle[] {
    interface Row {
      readonly fqn: string;
      readonly bundle_kind: string;
      readonly api_version: string | null;
      readonly description: string | null;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, bundle_kind, api_version, description, body_json, source_path, content_hash FROM aura_bundles",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          hasController: boolean;
          hasHelper: boolean;
          hasRenderer: boolean;
          hasStyle: boolean;
          attributes: readonly string[];
          handlers: readonly string[];
        };
        return {
          fullyQualifiedName: r.fqn,
          bundleKind: r.bundle_kind as AuraBundleKind,
          apiVersion: r.api_version ?? undefined,
          description: r.description ?? undefined,
          hasController: body.hasController,
          hasHelper: body.hasHelper,
          hasRenderer: body.hasRenderer,
          hasStyle: body.hasStyle,
          attributes: body.attributes,
          handlers: body.handlers,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readFlexiPages(): readonly FlexiPage[] {
    interface Row {
      readonly fqn: string;
      readonly type: string | null;
      readonly sobject_type: string | null;
      readonly page_template: string | null;
      readonly master_label: string | null;
      readonly description: string | null;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, type, sobject_type, page_template, master_label, description, body_json, source_path, content_hash FROM flexi_pages",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as { regions: readonly FlexiPageRegionInfo[] };
        return {
          fullyQualifiedName: r.fqn,
          type: r.type ?? undefined,
          sobjectType: r.sobject_type ?? undefined,
          pageTemplate: r.page_template ?? undefined,
          masterLabel: r.master_label ?? undefined,
          description: r.description ?? undefined,
          regions: body.regions,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readLayouts(): readonly Layout[] {
    interface Row {
      readonly fqn: string;
      readonly object: string;
      readonly layout_name: string;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, object, layout_name, body_json, source_path, content_hash FROM layouts",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          sections: readonly LayoutSectionInfo[];
          relatedLists: readonly LayoutRelatedListInfo[];
          quickActions: readonly string[];
        };
        return {
          fullyQualifiedName: r.fqn,
          object: r.object,
          layoutName: r.layout_name,
          sections: body.sections,
          relatedLists: body.relatedLists,
          quickActions: body.quickActions,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readCustomMetadataRecords(): readonly CustomMetadataRecord[] {
    interface Row {
      readonly fqn: string;
      readonly type: string;
      readonly record_name: string;
      readonly label: string | null;
      readonly is_protected: number | null;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, type, record_name, label, is_protected, body_json, source_path, content_hash FROM custom_metadata_records",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as { values: readonly CustomMetadataValueInfo[] };
        return {
          fullyQualifiedName: r.fqn,
          type: r.type,
          recordName: r.record_name,
          label: r.label ?? undefined,
          protected: r.is_protected === null ? undefined : r.is_protected === 1,
          values: body.values,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readNamedCredentials(): readonly NamedCredential[] {
    interface Row {
      readonly fqn: string;
      readonly label: string | null;
      readonly endpoint: string | null;
      readonly principal_type: string | null;
      readonly protocol: string | null;
      readonly has_secret: number;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, label, endpoint, principal_type, protocol, has_secret, source_path, content_hash FROM named_credentials",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        label: r.label ?? undefined,
        endpoint: r.endpoint ?? undefined,
        principalType: r.principal_type ?? undefined,
        protocol: r.protocol ?? undefined,
        hasSecret: r.has_secret === 1,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
      }));
  }

  private readRemoteSiteSettings(): readonly RemoteSiteSetting[] {
    interface Row {
      readonly fqn: string;
      readonly url: string | null;
      readonly description: string | null;
      readonly active: number;
      readonly disable_protocol_security: number;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, url, description, active, disable_protocol_security, source_path, content_hash FROM remote_site_settings",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        url: r.url ?? undefined,
        description: r.description ?? undefined,
        active: r.active === 1,
        disableProtocolSecurity: r.disable_protocol_security === 1,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
      }));
  }

  private readApprovalProcesses(): readonly ApprovalProcess[] {
    interface Row {
      readonly fqn: string;
      readonly object: string;
      readonly label: string | null;
      readonly description: string | null;
      readonly active: number;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, object, label, description, active, body_json, source_path, content_hash FROM approval_processes",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          entryCriteria: readonly ApprovalCriterion[];
          steps: readonly ApprovalStepInfo[];
          initialSubmissionActions: readonly ApprovalActionInfo[];
          finalApprovalActions: readonly ApprovalActionInfo[];
          finalRejectionActions: readonly ApprovalActionInfo[];
          recallActions: readonly ApprovalActionInfo[];
          recordEditability?: string;
        };
        return {
          fullyQualifiedName: r.fqn,
          object: r.object,
          label: r.label ?? undefined,
          description: r.description ?? undefined,
          active: r.active === 1,
          entryCriteria: body.entryCriteria,
          steps: body.steps,
          initialSubmissionActions: body.initialSubmissionActions,
          finalApprovalActions: body.finalApprovalActions,
          finalRejectionActions: body.finalRejectionActions,
          recallActions: body.recallActions,
          recordEditability: body.recordEditability,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readSharingRules(): readonly SharingRule[] {
    interface Row {
      readonly fqn: string;
      readonly object: string;
      readonly kind: string;
      readonly label: string | null;
      readonly description: string | null;
      readonly access_level: string;
      readonly body_json: string;
      readonly source_path: string;
      readonly content_hash: string;
    }
    return this.#store
      .query<Row>(
        "SELECT fqn, object, kind, label, description, access_level, body_json, source_path, content_hash FROM sharing_rules",
      )
      .map((r) => {
        const body = JSON.parse(r.body_json) as {
          sharedTo: SharedToInfo;
          criteriaItems: readonly SharingCriterion[];
          criteriaBooleanFilter?: string;
          ownerSource?: string;
        };
        return {
          fullyQualifiedName: r.fqn,
          object: r.object,
          kind: r.kind as SharingRuleKind,
          label: r.label ?? undefined,
          description: r.description ?? undefined,
          accessLevel: r.access_level,
          sharedTo: body.sharedTo,
          criteriaItems: body.criteriaItems,
          criteriaBooleanFilter: body.criteriaBooleanFilter,
          ownerSource: body.ownerSource,
          sourcePath: r.source_path,
          contentHash: r.content_hash,
        };
      });
  }

  private readRecordTypes(): readonly RecordType[] {
    return this.#store
      .query<RecordTypeRow>(
        "SELECT fqn, object, label, description, active, source_path, content_hash FROM record_types",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        object: r.object,
        label: r.label ?? undefined,
        description: r.description ?? undefined,
        active: r.active === 1,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
      }));
  }

  private readMeta(): KnowledgeGraph["meta"] {
    const rows = this.#store.query<MetaRow>("SELECT key, value FROM meta");
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      yohakuVersion: map.get("yohaku_version") ?? "0.0.1",
      builtAt: map.get("built_at") ?? new Date().toISOString(),
      sourceAdapter: (map.get("source_adapter") ?? "local") as "local" | "dx-mcp",
      salesforceApiVersion: map.get("salesforce_api_version") ?? DEFAULT_API,
      sourceHash: map.get("source_hash") ?? "sha256:unknown",
    };
  }

  private readObjects(): readonly SObject[] {
    return this.#store
      .query<ObjectRow>(
        "SELECT fqn, label, plural_label, description, is_custom, sharing_model, source_path, content_hash FROM objects",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        label: r.label,
        pluralLabel: r.plural_label ?? undefined,
        description: r.description ?? undefined,
        isCustom: r.is_custom === 1,
        sharingModel: (r.sharing_model ?? undefined) as SObject["sharingModel"],
        sourcePath: r.source_path,
        contentHash: r.content_hash,
      }));
  }

  private readFields(): readonly Field[] {
    return this.#store
      .query<FieldRow>(
        "SELECT fqn, object, label, description, type, required, is_unique, is_custom, reference_to_json, picklist_values_json, formula, default_value, source_path, content_hash FROM fields",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        object: r.object,
        label: r.label ?? undefined,
        description: r.description ?? undefined,
        type: r.type,
        required: r.required === null ? undefined : r.required === 1,
        unique: r.is_unique === null ? undefined : r.is_unique === 1,
        isCustom: r.is_custom === 1,
        referenceTo:
          r.reference_to_json !== null
            ? (JSON.parse(r.reference_to_json) as readonly string[])
            : undefined,
        picklistValues:
          r.picklist_values_json !== null
            ? (JSON.parse(r.picklist_values_json) as readonly string[])
            : undefined,
        formula: r.formula ?? undefined,
        defaultValue: r.default_value ?? undefined,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
      }));
  }

  private readValidationRules(): readonly ValidationRule[] {
    return this.#store
      .query<ValidationRuleRow>(
        "SELECT fqn, object, active, error_condition_formula, error_message, error_display_field, source_path, content_hash FROM validation_rules",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        object: r.object,
        active: r.active === 1,
        errorConditionFormula: r.error_condition_formula ?? undefined,
        errorMessage: r.error_message ?? undefined,
        errorDisplayField: r.error_display_field ?? undefined,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
      }));
  }

  private readFlows(): readonly Flow[] {
    return this.#store
      .query<FlowRow>(
        "SELECT fqn, label, description, type, status, triggering_object, source_path, content_hash, body_json FROM flows",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        label: r.label ?? undefined,
        description: r.description ?? undefined,
        type: r.type,
        status: r.status as Flow["status"],
        triggeringObject: r.triggering_object ?? undefined,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
        body: parseFlowBody(r.body_json),
      }));
  }

  private readApexClasses(): readonly ApexClass[] {
    return this.#store
      .query<ApexClassRow>(
        "SELECT fqn, api_version, is_test, is_interface, is_abstract, lines_of_code, source_path, content_hash, body_json FROM apex_classes",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        apiVersion: r.api_version,
        isTest: r.is_test === 1,
        isInterface: r.is_interface === null ? undefined : r.is_interface === 1,
        isAbstract: r.is_abstract === null ? undefined : r.is_abstract === 1,
        linesOfCode: r.lines_of_code ?? undefined,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
        body: parseApexBody(r.body_json),
      }));
  }

  private readApexTriggers(): readonly ApexTrigger[] {
    return this.#store
      .query<ApexTriggerRow>(
        "SELECT fqn, object, events_json, api_version, source_path, content_hash, body_json FROM apex_triggers",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        object: r.object,
        events: JSON.parse(r.events_json) as readonly ApexTriggerEvent[],
        apiVersion: r.api_version,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
        body: parseApexBody(r.body_json),
      }));
  }

  private readPermissionSets(): readonly PermissionSet[] {
    return this.#store
      .query<PermissionSetRow>(
        "SELECT fqn, label, description, license, source_path, content_hash, body_json FROM permission_sets",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        label: r.label,
        description: r.description ?? undefined,
        license: r.license ?? undefined,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
        body: parsePermissionSetBody(r.body_json),
      }));
  }

  private readProfiles(): readonly Profile[] {
    return this.#store
      .query<ProfileRow>(
        "SELECT fqn, user_license, source_path, content_hash, body_json FROM profiles",
      )
      .map((r) => ({
        fullyQualifiedName: r.fqn,
        userLicense: r.user_license ?? undefined,
        sourcePath: r.source_path,
        contentHash: r.content_hash,
        body: parsePermissionSetBody(r.body_json),
      }));
  }
}
