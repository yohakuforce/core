import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHtmlAll, resolveHtmlOutDir } from "../../../src/html/index.js";
import type { KnowledgeGraph } from "../../../src/types/graph.js";

function emptyGraph(): KnowledgeGraph {
  return {
    meta: {
      yohakuVersion: "test",
      builtAt: "2026-05-30T00:00:00Z",
      sourceAdapter: "local",
      salesforceApiVersion: "62.0",
      sourceHash: "h",
    },
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
  };
}

describe("renderHtmlAll (Phase 0 stub)", () => {
  let outRoot: string;
  beforeEach(() => {
    outRoot = mkdtempSync(join(tmpdir(), "yohaku-html-test-"));
  });
  afterEach(() => {
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("index.html / sections-schema.json / styles.css を生成する", () => {
    const htmlOut = resolveHtmlOutDir(outRoot);
    const result = renderHtmlAll(emptyGraph(), htmlOut);
    expect(result.written.length).toBeGreaterThanOrEqual(3);
    expect(existsSync(join(htmlOut, "index.html"))).toBe(true);
    expect(existsSync(join(htmlOut, "data", "sections-schema.json"))).toBe(true);
    expect(existsSync(join(htmlOut, "assets", "styles.css"))).toBe(true);
  });

  it("sections-schema.json は 12 セクション + 5 コンポーネントタイプを含む", () => {
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(emptyGraph(), htmlOut);
    const schema = JSON.parse(
      readFileSync(join(htmlOut, "data", "sections-schema.json"), "utf8"),
    );
    expect(schema.version).toBe(1);
    expect(schema.componentTypes).toHaveLength(5);
    expect(schema.sections).toHaveLength(12);
  });

  it("index.html はタブ UI と JSON データ参照を含む", () => {
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(emptyGraph(), htmlOut);
    const indexHtml = readFileSync(join(htmlOut, "index.html"), "utf8");
    expect(indexHtml).toContain("Knowledge Hub");
    expect(indexHtml).toContain('data-tab="stats"');
    expect(indexHtml).toContain('data-tab="architecture"');
    expect(indexHtml).toContain('data-tab="domains"');
    expect(indexHtml).toContain('data-tab="hotspots"');
    expect(indexHtml).toContain("./assets/home.js");
    expect(indexHtml).toContain("./assets/home.css");
  });

  it("data/ 配下に stats/architecture/domains/hotspots JSON を生成する", () => {
    const htmlOut = resolveHtmlOutDir(outRoot);
    renderHtmlAll(emptyGraph(), htmlOut);
    expect(existsSync(join(htmlOut, "data", "stats.json"))).toBe(true);
    expect(existsSync(join(htmlOut, "data", "architecture.json"))).toBe(true);
    expect(existsSync(join(htmlOut, "data", "domains.json"))).toBe(true);
    expect(existsSync(join(htmlOut, "data", "hotspots.json"))).toBe(true);
  });

  it("warnings に phase_notice コードが入る", () => {
    const htmlOut = resolveHtmlOutDir(outRoot);
    const result = renderHtmlAll(emptyGraph(), htmlOut);
    expect(result.warnings.some((w) => w.code === "phase_notice")).toBe(true);
  });
});
