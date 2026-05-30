// @yohakuforce/core — public API surface

export type * from "./types/graph.js";
export type * from "./types/source-adapter.js";
export type * from "./types/render.js";

export { LocalSourceAdapter, readSfdxProject, SfdxProjectError } from "./adapters/local/index.js";
export type {
  LocalSourceAdapterOptions,
  SfdxProjectConfig,
  PackageDirectory,
} from "./adapters/local/index.js";

export { DxMcpSourceAdapter, DxMcpNotImplementedError } from "./adapters/dx-mcp/index.js";
export type { DxMcpSourceAdapterOptions } from "./adapters/dx-mcp/index.js";

export {
  buildPackageManifest,
  DEFAULT_RETRIEVE_TYPES,
  retrieveOrgSources,
  OrgRetrieveError,
} from "./adapters/org-retrieve/index.js";
export type {
  BuildManifestOptions,
  OrgRetrieveOptions,
  OrgRetrieveResult,
} from "./adapters/org-retrieve/index.js";

export {
  buildGraph,
  SqliteGraphStore,
  KnowledgeGraphReader,
  parseXml,
} from "./graph/index.js";
export type {
  BuildOptions,
  SqliteStoreOptions,
  ReaderOptions,
} from "./graph/index.js";

export { renderSystemIndex, renderObjects, archiveDeleted } from "./render/index.js";
export type { RenderTarget, RenderResult } from "./render/index.js";

export {
  parseRenderFormats,
  isRenderFormat,
  resolveFormatOutputDir,
  InvalidRenderFormatError,
} from "./render/format.js";
export type { RenderFormat } from "./render/format.js";

export {
  renderHtmlAll,
  resolveHtmlOutDir,
  HtmlAuditFailedError,
  SECTION_SCHEMA,
  SECTION_IDS,
  COMPONENT_TYPES,
  auditSections,
  buildApexViewModel,
  buildTriggerViewModel,
  buildLwcViewModel,
  buildObjectViewModel,
  buildFlowViewModel,
  renderComponentPage,
  escapeHtml,
  escapeAttr,
  sanitizeFileName,
} from "./html/index.js";
export type {
  ComponentType,
  ComponentViewModel,
  HtmlRenderOptions,
  HtmlRenderResult,
  SectionAuditResult,
  SectionDescriptor,
  SectionId,
  SectionRequirement,
  SectionViewModel,
} from "./html/index.js";

export {
  mergeRender,
  mergeRenameAware,
  parseDocument,
  validateMarkers,
  MarkerCorruptionError,
} from "./merge/index.js";

export {
  validateGraph,
  loadGraphSchema,
  GraphSchemaValidationError,
} from "./schema/validate.js";

export {
  maskContent,
  DEFAULT_RULES,
  loadSecretsRules,
  SecretsRulesError,
} from "./secrets/index.js";
export type {
  SecretRule,
  SensitivityLevel,
  MaskingResult,
  MaskingHit,
  LoadOptions,
} from "./secrets/index.js";

export { sha256, combineHashes } from "./util/hash.js";

export { computeDiff } from "./diff/index.js";
export type {
  ComputeDiffOptions,
  ChangeKind as DiffChangeKind,
  ChangedFile,
  DiffCategory,
  RawDiff,
} from "./diff/index.js";

export {
  ai,
  human,
  deterministic,
  validateChangeSummary,
  loadChangeSummarySchema,
  ChangeSummaryValidationError,
} from "./change-summary/index.js";
export type {
  Source,
  Tracked,
  ChangeCategoryKind,
  ScopeSize,
  SarifFinding,
  ChangeEntry,
  CategorySection,
  HumanAnnotations,
  ChangeSummary,
} from "./change-summary/index.js";

export { parseSarifFile, normalizeSarif, SarifParseError } from "./sarif/index.js";
export type { NormalizedFinding, SarifLog, SarifLevel } from "./sarif/index.js";

export {
  runConsistencyCheck,
  expectMatchRate,
  ConsistencyAssertionError,
} from "./consistency/index.js";
export type {
  ConsistencyOptions,
  ConsistencyResult,
  ExpectMatchOptions,
} from "./consistency/index.js";

export {
  validateReleaseDoc,
  loadReleaseDocSchema,
  ReleaseDocValidationError,
  extractManualSteps,
} from "./release/index.js";
export type {
  ManualStep,
  ManualStepCategory,
  ReleaseDoc,
  GoNoGoVerdict,
} from "./release/index.js";

export {
  loadContextMap,
  expandReadOrder,
  ContextMapError,
  DEFAULT_CONTEXT_MAP,
  OnboardingStateStore,
  extractFaq,
  parseDialogLog,
  renderFaqMarkdown,
  PERSONA_IDS,
  EMPTY_STATE,
} from "./onboarding/index.js";
export type {
  PersonaId,
  PersonaDef,
  DepthMode,
  DomainDef,
  ContextMap,
  PersonaState,
  OnboardingStateFile,
  ExtractFaqOptions,
  FaqCandidate,
  LoadContextMapOptions,
  StateStoreOptions,
} from "./onboarding/index.js";

export { runInit, PROFILE_DEFAULTS } from "./init/index.js";
export type {
  InitOptions,
  InitResult,
  InitVariables,
  Profile as InitProfile,
  PrimaryLanguage,
  Segment,
} from "./init/index.js";

export {
  MetricsStore,
  summarize,
  estimateCost,
  inferModelKind,
  DEFAULT_PRICING,
  EMPTY_METRICS,
} from "./metrics/index.js";
export type {
  MetricsEvent,
  MetricsFile,
  MetricsTotals,
  MetricsStoreOptions,
  ModelKind,
  ModelPricing,
  Period,
  PeriodSummary,
} from "./metrics/index.js";
