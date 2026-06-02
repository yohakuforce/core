import { validateGraph } from "../schema/validate.js";
import { maskGraphSensitiveFields } from "../secrets/apply.js";
import { loadSecretsRules } from "../secrets/load.js";
import type {
  ApexClass,
  ApexTrigger,
  ApprovalProcess,
  AuraBundle,
  CustomApplication,
  CustomMetadataRecord,
  EmailTemplate,
  Field,
  FlexiPage,
  Flow,
  KnowledgeGraph,
  Layout,
  LightningWebComponent,
  NamedCredential,
  PermissionSet,
  Profile,
  RecordType,
  RemoteSiteSetting,
  SObject,
  SharingRule,
  ValidationRule,
  VisualforceComponent,
  VisualforcePage,
} from "../types/graph.js";
import type { MetadataDescriptor, SourceAdapter } from "../types/source-adapter.js";
import {
  deriveFieldDependencies,
  deriveFlowDependencies,
  deriveTriggerDependencies,
} from "./dependencies.js";
import {
  extractApexClass,
  extractApexTrigger,
  extractApprovalProcess,
  extractAuraBundle,
  extractCustomApplication,
  extractCustomMetadataRecord,
  extractEmailTemplate,
  extractField,
  extractFlexiPage,
  extractFlow,
  extractLayout,
  extractLwc,
  extractNamedCredential,
  extractObject,
  extractPermissionSet,
  extractProfile,
  extractRecordType,
  extractRemoteSiteSetting,
  extractSharingRules,
  extractValidationRule,
  extractVisualforceComponent,
  extractVisualforcePage,
} from "./extractors/index.js";

export interface BuildOptions {
  readonly yohakuVersion: string;
  readonly salesforceApiVersion: string;
  readonly projectRoot?: string;
}

export async function buildGraph(
  adapter: SourceAdapter,
  options: BuildOptions,
): Promise<KnowledgeGraph> {
  const descriptors = await adapter.list();
  const sourceHash = await adapter.computeSourceHash();

  const objects: SObject[] = [];
  const fields: Field[] = [];
  const validationRules: ValidationRule[] = [];
  const flows: Flow[] = [];
  const apexClasses: ApexClass[] = [];
  const apexTriggers: ApexTrigger[] = [];
  const permissionSets: PermissionSet[] = [];
  const profiles: Profile[] = [];
  const recordTypes: RecordType[] = [];
  const approvalProcesses: ApprovalProcess[] = [];
  const sharingRules: SharingRule[] = [];
  const layouts: Layout[] = [];
  const customMetadataRecords: CustomMetadataRecord[] = [];
  const namedCredentials: NamedCredential[] = [];
  const remoteSiteSettings: RemoteSiteSetting[] = [];
  const lwcs: LightningWebComponent[] = [];
  const auraBundles: AuraBundle[] = [];
  const flexiPages: FlexiPage[] = [];
  const visualforcePages: VisualforcePage[] = [];
  const visualforceComponents: VisualforceComponent[] = [];
  const customApplications: CustomApplication[] = [];
  const emailTemplates: EmailTemplate[] = [];

  for (const descriptor of descriptors) {
    const content = await adapter.loadContent(descriptor);
    routeDescriptor(
      descriptor,
      content,
      {
        objects,
        fields,
        validationRules,
        flows,
        apexClasses,
        apexTriggers,
        permissionSets,
        profiles,
        recordTypes,
        approvalProcesses,
        sharingRules,
        layouts,
        customMetadataRecords,
        namedCredentials,
        remoteSiteSettings,
        lwcs,
        auraBundles,
        flexiPages,
        visualforcePages,
        visualforceComponents,
        customApplications,
        emailTemplates,
      },
      options.projectRoot,
    );
  }

  // 標準オブジェクトに追加した Custom Field 等で、親オブジェクトの
  // -meta.xml がプロジェクトに無い場合は stub を自動生成 (FK 制約対応)
  ensureReferencedObjectStubs(
    objects,
    fields,
    validationRules,
    apexTriggers,
    recordTypes,
    approvalProcesses,
    sharingRules,
    layouts,
  );

  const dependencies = [
    ...deriveFieldDependencies(fields),
    ...deriveTriggerDependencies(apexTriggers),
    ...deriveFlowDependencies(flows),
  ];

  const graph: KnowledgeGraph = {
    meta: {
      yohakuVersion: options.yohakuVersion,
      builtAt: new Date().toISOString(),
      sourceAdapter: adapter.kind,
      salesforceApiVersion: options.salesforceApiVersion,
      sourceHash,
    },
    objects,
    fields,
    validationRules,
    flows,
    apexClasses,
    apexTriggers,
    permissionSets,
    profiles,
    recordTypes,
    approvalProcesses,
    sharingRules,
    layouts,
    customMetadataRecords,
    namedCredentials,
    remoteSiteSettings,
    lwcs,
    auraBundles,
    flexiPages,
    visualforcePages,
    visualforceComponents,
    customApplications,
    emailTemplates,
    dependencies,
    tags: [],
  };

  // SQLite / Markdown / AI プロンプトに流す前にマスキングを適用 (CRITICAL: HIGH-1)
  // 機密性の高い自由文フィールド (ValidationRule formula / message, CustomMetadata values) のみ対象。
  // 構造的識別子 (FQN / 各種 hash / path) は対象外。
  const rules = loadSecretsRules(
    options.projectRoot !== undefined ? { rootPath: options.projectRoot } : {},
  );
  const maskedGraph = maskGraphSensitiveFields(graph, rules);

  validateGraph(maskedGraph);
  return maskedGraph;
}

/**
 * fields / validationRules / apexTriggers が参照する親 object のうち、
 * objects 配列に未登録のものを stub として追加する。
 *
 * 標準オブジェクト (Account 等) にカスタムフィールドを追加した場合、
 * Salesforce DX では objects/Account/Account.object-meta.xml は通常存在せず、
 * fields/validationRules のみが配置される。この場合、本関数が "Account" を
 * stub として objects に追加し、SQL FK 制約と JSON Schema 検証を満たす。
 */
function ensureReferencedObjectStubs(
  objects: SObject[],
  fields: readonly Field[],
  validationRules: readonly ValidationRule[],
  apexTriggers: readonly ApexTrigger[],
  recordTypes: readonly RecordType[],
  approvalProcesses: readonly ApprovalProcess[],
  sharingRules: readonly SharingRule[],
  layouts: readonly Layout[],
): void {
  const existing = new Set(objects.map((o) => o.fullyQualifiedName));
  const referenced = new Set<string>();
  for (const f of fields) referenced.add(f.object);
  for (const v of validationRules) referenced.add(v.object);
  for (const t of apexTriggers) referenced.add(t.object);
  for (const r of recordTypes) referenced.add(r.object);
  for (const a of approvalProcesses) referenced.add(a.object);
  for (const s of sharingRules) referenced.add(s.object);
  for (const l of layouts) referenced.add(l.object);

  for (const ref of referenced) {
    if (existing.has(ref)) continue;
    objects.push({
      fullyQualifiedName: ref,
      label: ref,
      isCustom: ref.endsWith("__c"),
      sourcePath: `<inferred:standard-or-managed-object>/${ref}`,
      contentHash: "sha256:inferred",
    });
    existing.add(ref);
  }
}

interface Buckets {
  readonly objects: SObject[];
  readonly fields: Field[];
  readonly validationRules: ValidationRule[];
  readonly flows: Flow[];
  readonly apexClasses: ApexClass[];
  readonly apexTriggers: ApexTrigger[];
  readonly permissionSets: PermissionSet[];
  readonly profiles: Profile[];
  readonly recordTypes: RecordType[];
  readonly approvalProcesses: ApprovalProcess[];
  readonly sharingRules: SharingRule[];
  readonly layouts: Layout[];
  readonly customMetadataRecords: CustomMetadataRecord[];
  readonly namedCredentials: NamedCredential[];
  readonly remoteSiteSettings: RemoteSiteSetting[];
  readonly lwcs: LightningWebComponent[];
  readonly auraBundles: AuraBundle[];
  readonly flexiPages: FlexiPage[];
  readonly visualforcePages: VisualforcePage[];
  readonly visualforceComponents: VisualforceComponent[];
  readonly customApplications: CustomApplication[];
  readonly emailTemplates: EmailTemplate[];
}

function routeDescriptor(
  descriptor: MetadataDescriptor,
  content: string,
  buckets: Buckets,
  projectRoot: string | undefined,
): void {
  const ctx = { descriptor, content, projectRoot };
  switch (descriptor.type) {
    case "CustomObject": {
      const o = extractObject(ctx);
      if (o !== undefined) buckets.objects.push(o);
      return;
    }
    case "CustomField": {
      const f = extractField(ctx);
      if (f !== undefined) buckets.fields.push(f);
      return;
    }
    case "ValidationRule": {
      const v = extractValidationRule(ctx);
      if (v !== undefined) buckets.validationRules.push(v);
      return;
    }
    case "Flow": {
      const f = extractFlow(ctx);
      if (f !== undefined) buckets.flows.push(f);
      return;
    }
    case "ApexClass": {
      const a = extractApexClass(ctx);
      if (a !== undefined) buckets.apexClasses.push(a);
      return;
    }
    case "ApexTrigger": {
      const t = extractApexTrigger(ctx);
      if (t !== undefined) buckets.apexTriggers.push(t);
      return;
    }
    case "PermissionSet": {
      const p = extractPermissionSet(ctx);
      if (p !== undefined) buckets.permissionSets.push(p);
      return;
    }
    case "Profile": {
      const p = extractProfile(ctx);
      if (p !== undefined) buckets.profiles.push(p);
      return;
    }
    case "RecordType": {
      const r = extractRecordType(ctx);
      if (r !== undefined) buckets.recordTypes.push(r);
      return;
    }
    case "ApprovalProcess": {
      const a = extractApprovalProcess(ctx);
      if (a !== undefined) buckets.approvalProcesses.push(a);
      return;
    }
    case "SharingRules": {
      const rules = extractSharingRules(ctx);
      for (const r of rules) buckets.sharingRules.push(r);
      return;
    }
    case "Layout": {
      const l = extractLayout(ctx);
      if (l !== undefined) buckets.layouts.push(l);
      return;
    }
    case "CustomMetadataRecord": {
      const c = extractCustomMetadataRecord(ctx);
      if (c !== undefined) buckets.customMetadataRecords.push(c);
      return;
    }
    case "NamedCredential": {
      const n = extractNamedCredential(ctx);
      if (n !== undefined) buckets.namedCredentials.push(n);
      return;
    }
    case "RemoteSiteSetting": {
      const r = extractRemoteSiteSetting(ctx);
      if (r !== undefined) buckets.remoteSiteSettings.push(r);
      return;
    }
    case "LightningWebComponent": {
      const c = extractLwc(ctx);
      if (c !== undefined) buckets.lwcs.push(c);
      return;
    }
    case "AuraBundle": {
      const a = extractAuraBundle(ctx);
      if (a !== undefined) buckets.auraBundles.push(a);
      return;
    }
    case "FlexiPage": {
      const f = extractFlexiPage(ctx);
      if (f !== undefined) buckets.flexiPages.push(f);
      return;
    }
    case "VisualforcePage": {
      const p = extractVisualforcePage(ctx);
      if (p !== undefined) buckets.visualforcePages.push(p);
      return;
    }
    case "VisualforceComponent": {
      const c = extractVisualforceComponent(ctx);
      if (c !== undefined) buckets.visualforceComponents.push(c);
      return;
    }
    case "CustomApplication": {
      const a = extractCustomApplication(ctx);
      if (a !== undefined) buckets.customApplications.push(a);
      return;
    }
    case "EmailTemplate": {
      const e = extractEmailTemplate(ctx);
      if (e !== undefined) buckets.emailTemplates.push(e);
      return;
    }
    default:
      return;
  }
}
