import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../../../src/init/index.js";
import type { InitVariables, Profile } from "../../../src/init/types.js";

// scaffold/ はリポジトリ root にある (packages/core/tests/unit/init から 5 階層上)
const here = resolve(fileURLToPath(import.meta.url), "..");
const SCAFFOLD_DIR = resolve(here, "../../../../../scaffold");

// v0.5.0 で追加された HTML 設計書パイプラインのスラッシュコマンド (.md.eta → .md)
const HTML_PIPELINE_COMMANDS = [
  "yohaku-html-build",
  "yohaku-serve",
  "yohaku-domains",
  "yohaku-explain-prompts",
  "yohaku-html-write",
] as const;
const RELEASE_ONLY_COMMANDS = ["yohaku-diff-html", "yohaku-coverage-import"] as const;

function makeVariables(profile: Profile): InitVariables {
  return {
    projectName: "ProfileTest",
    profile,
    primaryLanguage: "ja",
    salesforceApiVersion: "62.0",
    yohakuVersion: "0.5.0",
    segment: "unspecified",
    repoUrl: "https://example.com/repo",
    now: "2026-05-31",
    // 空にすると runInit が PROFILE_DEFAULTS から補完する (実運用と同じ経路)
    enabledCommands: [],
    enabledAgents: [],
    includeDxMcpAdapter: false,
    includeStaticAnalysis: false,
  };
}

describe("runInit profile → HTML パイプラインコマンド配置", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "yohaku-init-profile-"));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  async function placedCommands(profile: Profile): Promise<string[]> {
    await runInit({
      targetDir: tmpRoot,
      scaffoldDir: SCAFFOLD_DIR,
      variables: makeVariables(profile),
    });
    return readdirSync(join(tmpRoot, ".claude", "commands")).map((f) => f.replace(/\.md$/, ""));
  }

  it("standard は日常 HTML パイプラインコマンドを配置する", async () => {
    const placed = await placedCommands("standard");
    for (const cmd of HTML_PIPELINE_COMMANDS) {
      expect(placed).toContain(cmd);
    }
  });

  it("standard はリリース専用コマンドを配置しない", async () => {
    const placed = await placedCommands("standard");
    for (const cmd of RELEASE_ONLY_COMMANDS) {
      expect(placed).not.toContain(cmd);
    }
  });

  it("full は全 HTML パイプラインコマンド (リリース専用含む) を配置する", async () => {
    const placed = await placedCommands("full");
    for (const cmd of [...HTML_PIPELINE_COMMANDS, ...RELEASE_ONLY_COMMANDS]) {
      expect(placed).toContain(cmd);
    }
  });

  it("minimal は HTML パイプラインコマンドを配置しない (リーンに保つ)", async () => {
    const placed = await placedCommands("minimal");
    for (const cmd of [...HTML_PIPELINE_COMMANDS, ...RELEASE_ONLY_COMMANDS]) {
      expect(placed).not.toContain(cmd);
    }
  });
});
