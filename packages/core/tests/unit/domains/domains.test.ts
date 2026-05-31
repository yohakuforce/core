import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DomainsYamlError,
  lintDomains,
  loadDomainsYaml,
  saveDomainsYaml,
  suggestInitialDomains,
  syncDomains,
} from "../../../src/domains/index.js";
import type { DomainsConfig } from "../../../src/domains/types.js";
import type { ApexClass, KnowledgeGraph } from "../../../src/types/graph.js";

const META: KnowledgeGraph["meta"] = {
  yohakuVersion: "test",
  builtAt: "2026-05-30T00:00:00Z",
  sourceAdapter: "local",
  salesforceApiVersion: "62.0",
  sourceHash: "h",
};

const BASE = {
  meta: META,
  objects: [],
  fields: [],
  validationRules: [],
  flows: [],
  apexClasses: [],
  apexTriggers: [],
  permissionSets: [],
  profiles: [],
  recordTypes: [],
  approvalProcesses: [],
  sharingRules: [],
  layouts: [],
  customMetadataRecords: [],
  namedCredentials: [],
  remoteSiteSettings: [],
  lwcs: [],
  auraBundles: [],
  flexiPages: [],
  visualforcePages: [],
  visualforceComponents: [],
  customApplications: [],
  dependencies: [],
  tags: [],
} as const;

function apex(name: string, isTest = false): ApexClass {
  return {
    fullyQualifiedName: name,
    apiVersion: "62.0",
    isTest,
    sourcePath: `${name}.cls`,
    contentHash: "h",
  };
}

describe("suggestInitialDomains", () => {
  it("同一プレフィックス >=2 件で 1 ドメインに束ねる", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("AccountService"), apex("AccountController"), apex("OrderService")],
    };
    const cfg = suggestInitialDomains(graph);
    const accountDomain = cfg.domains.find((d) => d.id === "account");
    expect(accountDomain).toBeDefined();
    expect(accountDomain?.members).toHaveLength(2);
  });

  it("孤立クラスは Unclassified に集約", () => {
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("OneOff")] };
    const cfg = suggestInitialDomains(graph);
    expect(cfg.domains.find((d) => d.id === "unclassified")).toBeDefined();
  });

  it("テストクラスは候補から除外", () => {
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("Foo"), apex("FooTest", true)],
    };
    const cfg = suggestInitialDomains(graph);
    const allMembers = cfg.domains.flatMap((d) => d.members.map((m) => m.name));
    expect(allMembers).not.toContain("FooTest");
  });
});

describe("loadDomainsYaml / saveDomainsYaml", () => {
  let outRoot: string;
  beforeEach(() => {
    outRoot = mkdtempSync(join(tmpdir(), "yohaku-domains-test-"));
  });
  afterEach(() => {
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("round trip で同じ構造が得られる", () => {
    const cfg: DomainsConfig = {
      version: 1,
      domains: [{ id: "sales", label: "Sales", members: [{ type: "apex", name: "X" }] }],
    };
    const p = join(outRoot, "d.yaml");
    saveDomainsYaml(p, cfg);
    const loaded = loadDomainsYaml(p);
    expect(loaded).toEqual(cfg);
  });

  it("不在ファイルは null", () => {
    expect(loadDomainsYaml(join(outRoot, "nope.yaml"))).toBeNull();
  });

  it("version 不一致でエラー", () => {
    const p = join(outRoot, "bad.yaml");
    saveDomainsYaml(p, { version: 1, domains: [] });
    // tweak file
    const raw = readFileSync(p, "utf8").replace("version: 1", "version: 2");
    require("node:fs").writeFileSync(p, raw, "utf8");
    expect(() => loadDomainsYaml(p)).toThrow(DomainsYamlError);
  });

  it("type が不正でエラー", () => {
    const p = join(outRoot, "bad.yaml");
    require("node:fs").writeFileSync(
      p,
      "version: 1\ndomains:\n  - id: x\n    label: X\n    members:\n      - type: invalid\n        name: y\n",
      "utf8",
    );
    expect(() => loadDomainsYaml(p)).toThrow(DomainsYamlError);
  });
});

describe("lintDomains", () => {
  const baseGraph: KnowledgeGraph = {
    ...BASE,
    apexClasses: [apex("Foo"), apex("Bar")],
  };

  it("クリーンな設定は finding 無し", () => {
    const cfg: DomainsConfig = {
      version: 1,
      domains: [
        {
          id: "primary",
          label: "Primary",
          members: [
            { type: "apex", name: "Foo" },
            { type: "apex", name: "Bar" },
          ],
        },
      ],
    };
    const report = lintDomains(cfg, baseGraph);
    expect(report.findings).toEqual([]);
    expect(report.hasErrors).toBe(false);
  });

  it("複数 primary 所属は error", () => {
    const cfg: DomainsConfig = {
      version: 1,
      domains: [
        { id: "a", label: "A", members: [{ type: "apex", name: "Foo" }] },
        { id: "b", label: "B", members: [{ type: "apex", name: "Foo" }] },
      ],
    };
    const report = lintDomains(cfg, baseGraph);
    expect(report.findings.some((f) => f.code === "member_in_multiple_primary")).toBe(true);
    expect(report.hasErrors).toBe(true);
  });

  it("孤立メンバ参照は warning", () => {
    const cfg: DomainsConfig = {
      version: 1,
      domains: [{ id: "x", label: "X", members: [{ type: "apex", name: "NotInGraph" }] }],
    };
    const report = lintDomains(cfg, baseGraph);
    expect(report.findings.some((f) => f.code === "orphan_member")).toBe(true);
  });

  it("未分類メンバは info", () => {
    const cfg: DomainsConfig = { version: 1, domains: [] };
    const report = lintDomains(cfg, baseGraph);
    expect(report.findings.filter((f) => f.code === "uncovered_member").length).toBe(2);
    expect(report.hasErrors).toBe(false);
  });
});

describe("syncDomains", () => {
  it("graph にあって yaml に無いものを Unclassified に追記", () => {
    const cfg: DomainsConfig = {
      version: 1,
      domains: [{ id: "a", label: "A", members: [{ type: "apex", name: "Foo" }] }],
    };
    const graph: KnowledgeGraph = {
      ...BASE,
      apexClasses: [apex("Foo"), apex("New1")],
    };
    const synced = syncDomains(cfg, graph);
    const unclassified = synced.domains.find((d) => d.id === "unclassified");
    expect(unclassified?.members.map((m) => m.name)).toContain("New1");
  });

  it("追加対象なしなら同一インスタンスを返す", () => {
    const cfg: DomainsConfig = {
      version: 1,
      domains: [{ id: "a", label: "A", members: [{ type: "apex", name: "Foo" }] }],
    };
    const graph: KnowledgeGraph = { ...BASE, apexClasses: [apex("Foo")] };
    const synced = syncDomains(cfg, graph);
    expect(synced).toBe(cfg);
  });
});
