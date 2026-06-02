import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  FetchOptions,
  MetadataDescriptor,
  SourceAdapter,
} from "../../types/source-adapter.js";
import { combineHashes, sha256 } from "../../util/hash.js";
import { walkFiles } from "../../util/walk.js";
import { readSfdxProject } from "./sfdx-project.js";

export interface LocalSourceAdapterOptions {
  readonly rootPath: string;
  /**
   * パッケージディレクトリの明示指定。指定なしの場合 sfdx-project.json を読む。
   * sfdx-project.json も無ければ ["force-app"] にフォールバック。
   */
  readonly packageDirectories?: readonly string[];
}

export class LocalSourceAdapter implements SourceAdapter {
  readonly kind = "local" as const;
  readonly #rootPath: string;
  readonly #packageDirectories: readonly string[];

  constructor(options: LocalSourceAdapterOptions) {
    this.#rootPath = options.rootPath;
    this.#packageDirectories = resolvePackageDirectories(options);
  }

  get packageDirectories(): readonly string[] {
    return this.#packageDirectories;
  }

  async list(options?: FetchOptions): Promise<readonly MetadataDescriptor[]> {
    const allowedTypes = options?.types ? new Set(options.types) : undefined;
    const seen = new Map<string, MetadataDescriptor>();

    for (const pkgDir of this.#packageDirectories) {
      const sourceRoot = resolve(this.#rootPath, pkgDir);
      if (!existsSync(sourceRoot)) continue;

      for (const filePath of walkFiles(sourceRoot)) {
        const descriptor = describeFile(filePath, this.#rootPath);
        if (descriptor === undefined) continue;
        if (allowedTypes !== undefined && !allowedTypes.has(descriptor.type)) continue;
        if (!seen.has(descriptor.sourcePath)) {
          seen.set(descriptor.sourcePath, descriptor);
        }
      }
    }

    return Array.from(seen.values()).toSorted((a, b) =>
      a.fullyQualifiedName.localeCompare(b.fullyQualifiedName),
    );
  }

  async loadContent(descriptor: MetadataDescriptor): Promise<string> {
    const path = isAbsolute(descriptor.sourcePath)
      ? descriptor.sourcePath
      : resolve(this.#rootPath, descriptor.sourcePath);
    return readFileSync(path, "utf8");
  }

  async computeSourceHash(): Promise<string> {
    const descriptors = await this.list();
    const parts = descriptors.map((d) => `${d.fullyQualifiedName}|${d.contentHash}`);
    const dirsPart = `pkgDirs:${[...this.#packageDirectories].toSorted().join(",")}`;
    return combineHashes([...parts, dirsPart]);
  }
}

function resolvePackageDirectories(options: LocalSourceAdapterOptions): readonly string[] {
  if (options.packageDirectories !== undefined && options.packageDirectories.length > 0) {
    return options.packageDirectories;
  }
  const config = readSfdxProject(options.rootPath);
  return config.packageDirectories.map((d) => d.path);
}

interface FileClassification {
  readonly type: string;
  readonly directoryHint: string;
}

const EXTENSION_CLASSIFIERS: ReadonlyArray<{
  readonly suffix: string;
  readonly type: string;
  readonly directoryHint: string;
}> = [
  { suffix: ".object-meta.xml", type: "CustomObject", directoryHint: "objects" },
  { suffix: ".field-meta.xml", type: "CustomField", directoryHint: "fields" },
  { suffix: ".validationRule-meta.xml", type: "ValidationRule", directoryHint: "validationRules" },
  { suffix: ".flow-meta.xml", type: "Flow", directoryHint: "flows" },
  { suffix: ".cls", type: "ApexClass", directoryHint: "classes" },
  { suffix: ".trigger", type: "ApexTrigger", directoryHint: "triggers" },
  { suffix: ".permissionset-meta.xml", type: "PermissionSet", directoryHint: "permissionsets" },
  { suffix: ".profile-meta.xml", type: "Profile", directoryHint: "profiles" },
  { suffix: ".recordType-meta.xml", type: "RecordType", directoryHint: "recordTypes" },
  {
    suffix: ".approvalProcess-meta.xml",
    type: "ApprovalProcess",
    directoryHint: "approvalProcesses",
  },
  { suffix: ".sharingRules-meta.xml", type: "SharingRules", directoryHint: "sharingRules" },
  { suffix: ".layout-meta.xml", type: "Layout", directoryHint: "layouts" },
  { suffix: ".md-meta.xml", type: "CustomMetadataRecord", directoryHint: "customMetadata" },
  {
    suffix: ".namedCredential-meta.xml",
    type: "NamedCredential",
    directoryHint: "namedCredentials",
  },
  {
    suffix: ".remoteSite-meta.xml",
    type: "RemoteSiteSetting",
    directoryHint: "remoteSiteSettings",
  },
  // LWC bundle 起点
  { suffix: ".js-meta.xml", type: "LightningWebComponent", directoryHint: "lwc" },
  // Aura bundle 起点 (3 種を 1 タイプに集約)
  { suffix: ".cmp-meta.xml", type: "AuraBundle", directoryHint: "aura" },
  { suffix: ".app-meta.xml", type: "AuraBundle", directoryHint: "aura" },
  { suffix: ".evt-meta.xml", type: "AuraBundle", directoryHint: "aura" },
  // FlexiPage
  { suffix: ".flexipage-meta.xml", type: "FlexiPage", directoryHint: "flexipages" },
  // Visualforce
  { suffix: ".page-meta.xml", type: "VisualforcePage", directoryHint: "pages" },
  { suffix: ".component-meta.xml", type: "VisualforceComponent", directoryHint: "components" },
  // Lightning App / CustomApplication (in applications/, AuraBundle と区別)
  // suffix .app-meta.xml は AuraBundle と衝突するので、classifyFile でディレクトリ判別
  // EmailTemplate
  { suffix: ".email-meta.xml", type: "EmailTemplate", directoryHint: "email" },
];

function classifyFile(
  fileName: string,
  segments: readonly string[],
): FileClassification | undefined {
  // .cls-meta.xml と .trigger-meta.xml は ApexClass/Trigger 本体ではないので除外
  if (fileName.endsWith(".cls-meta.xml") || fileName.endsWith(".trigger-meta.xml")) {
    return undefined;
  }
  // CustomApplication: applications/<Name>.app-meta.xml は AuraBundle ではなく Lightning App
  if (fileName.endsWith(".app-meta.xml") && segments.includes("applications")) {
    return { type: "CustomApplication", directoryHint: "applications" };
  }
  for (const c of EXTENSION_CLASSIFIERS) {
    if (fileName.endsWith(c.suffix)) {
      return { type: c.type, directoryHint: c.directoryHint };
    }
  }
  return undefined;
}

function describeFile(absolutePath: string, projectRoot: string): MetadataDescriptor | undefined {
  // Windows 互換: relative() は OS のパス区切りを返すため、保存・分割前に
  // forward slash に正規化する。これにより sourcePath が OS 間で再現可能になる。
  const relativePath = relative(projectRoot, absolutePath).replaceAll("\\", "/");
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? "";

  const classification = classifyFile(fileName, segments);
  if (classification === undefined) return undefined;

  const fqn = inferFullyQualifiedName(classification.type, segments);
  if (fqn === undefined) return undefined;

  let content: string;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    return undefined;
  }

  return {
    type: classification.type,
    fullyQualifiedName: fqn,
    sourcePath: relativePath,
    contentHash: sha256(content),
  };
}

function inferFullyQualifiedName(type: string, segments: readonly string[]): string | undefined {
  const fileName = segments.at(-1) ?? "";
  switch (type) {
    case "CustomObject": {
      const idx = segments.indexOf("objects");
      return segments[idx + 1];
    }
    case "CustomField": {
      const idx = segments.indexOf("objects");
      const objectName = segments[idx + 1];
      const fieldFile = fileName.replace(/\.field-meta\.xml$/, "");
      if (objectName === undefined) return undefined;
      return `${objectName}.${fieldFile}`;
    }
    case "ValidationRule": {
      const idx = segments.indexOf("objects");
      const objectName = segments[idx + 1];
      const ruleFile = fileName.replace(/\.validationRule-meta\.xml$/, "");
      if (objectName === undefined) return undefined;
      return `${objectName}.${ruleFile}`;
    }
    case "Flow":
      return fileName.replace(/\.flow-meta\.xml$/, "");
    case "ApexClass":
      return fileName.replace(/\.cls(-meta\.xml)?$/, "");
    case "ApexTrigger":
      return fileName.replace(/\.trigger(-meta\.xml)?$/, "");
    case "PermissionSet":
      return fileName.replace(/\.permissionset-meta\.xml$/, "");
    case "Profile":
      return fileName.replace(/\.profile-meta\.xml$/, "");
    case "RecordType": {
      const idx = segments.indexOf("objects");
      const objectName = segments[idx + 1];
      const rtFile = fileName.replace(/\.recordType-meta\.xml$/, "");
      if (objectName === undefined) return undefined;
      return `${objectName}.${rtFile}`;
    }
    case "ApprovalProcess":
      // 命名: <Object>.<ProcessName>.approvalProcess-meta.xml
      return fileName.replace(/\.approvalProcess-meta\.xml$/, "");
    case "SharingRules":
      // SharingRules ファイルは <Object>.sharingRules-meta.xml の形 (1 オブジェクト 1 ファイル)
      return fileName.replace(/\.sharingRules-meta\.xml$/, "");
    case "Layout":
      // 命名: <Object>-<LayoutName>.layout-meta.xml
      return fileName.replace(/\.layout-meta\.xml$/, "");
    case "CustomMetadataRecord":
      // 命名: <Type>.<RecordDeveloperName>.md-meta.xml
      return fileName.replace(/\.md-meta\.xml$/, "");
    case "NamedCredential":
      return fileName.replace(/\.namedCredential-meta\.xml$/, "");
    case "RemoteSiteSetting":
      return fileName.replace(/\.remoteSite-meta\.xml$/, "");
    case "LightningWebComponent":
      return fileName.replace(/\.js-meta\.xml$/, "");
    case "AuraBundle":
      return fileName.replace(/\.(cmp|app|evt)-meta\.xml$/, "");
    case "FlexiPage":
      return fileName.replace(/\.flexipage-meta\.xml$/, "");
    case "VisualforcePage":
      return fileName.replace(/\.page-meta\.xml$/, "");
    case "VisualforceComponent":
      return fileName.replace(/\.component-meta\.xml$/, "");
    case "CustomApplication":
      return fileName.replace(/\.app-meta\.xml$/, "");
    case "EmailTemplate": {
      // 命名: email/<folder>/<Name>.email-meta.xml → fqn = <folder>/<Name>
      const idx = segments.indexOf("email");
      const base = fileName.replace(/\.email-meta\.xml$/, "");
      const folder = idx >= 0 ? segments[idx + 1] : undefined;
      return folder !== undefined && folder !== fileName ? `${folder}/${base}` : base;
    }
    default:
      return undefined;
  }
}
