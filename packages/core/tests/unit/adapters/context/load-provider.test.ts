import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ContextConfigError,
  createContextProvider,
  parseContextConfig,
} from "../../../../src/adapters/context/load-provider.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "yohaku-ctx-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeConfig(obj: object): void {
  mkdirSync(join(root, ".yohaku"), { recursive: true });
  writeFileSync(join(root, ".yohaku", "config.json"), JSON.stringify(obj));
}

describe("parseContextConfig", () => {
  it("設定ファイルが無ければ null", () => {
    expect(parseContextConfig(root)).toBeNull();
  });

  it("contextProvider セクションが無ければ null", () => {
    writeConfig({ somethingElse: true });
    expect(parseContextConfig(root)).toBeNull();
  });

  it("kind 省略は none 扱い", () => {
    writeConfig({ contextProvider: {} });
    expect(parseContextConfig(root)).toEqual({ kind: "none" });
  });

  it("kind=none をそのまま返す", () => {
    writeConfig({ contextProvider: { kind: "none" } });
    expect(parseContextConfig(root)).toEqual({ kind: "none" });
  });

  it("正しい context-hub 設定をパースする", () => {
    writeConfig({
      contextProvider: {
        kind: "context-hub",
        command: "python",
        args: ["-m", "context_hub.mcp.server"],
        cwd: "/abs/Context-Hub",
        projectId: "proj-001",
        topK: 8,
      },
    });
    expect(parseContextConfig(root)).toEqual({
      kind: "context-hub",
      command: "python",
      args: ["-m", "context_hub.mcp.server"],
      cwd: "/abs/Context-Hub",
      projectId: "proj-001",
      topK: 8,
    });
  });

  it("context-hub で command 欠如は ContextConfigError", () => {
    writeConfig({ contextProvider: { kind: "context-hub", projectId: "p" } });
    expect(() => parseContextConfig(root)).toThrow(ContextConfigError);
  });

  it("context-hub で projectId 欠如は ContextConfigError", () => {
    writeConfig({ contextProvider: { kind: "context-hub", command: "python" } });
    expect(() => parseContextConfig(root)).toThrow(ContextConfigError);
  });

  it("未知の kind は ContextConfigError", () => {
    writeConfig({ contextProvider: { kind: "weird" } });
    expect(() => parseContextConfig(root)).toThrow(ContextConfigError);
  });

  it("不正な JSON は ContextConfigError", () => {
    mkdirSync(join(root, ".yohaku"), { recursive: true });
    writeFileSync(join(root, ".yohaku", "config.json"), "{ not json");
    expect(() => parseContextConfig(root)).toThrow(ContextConfigError);
  });
});

describe("createContextProvider", () => {
  it("null は NoneContextProvider", async () => {
    const p = createContextProvider(null);
    expect(p.kind).toBe("none");
    const brief = await p.relatedContext({ kind: "object", fqn: "Account" });
    expect(brief.empty).toBe(true);
    await p.close();
  });

  it("kind=none は NoneContextProvider", () => {
    expect(createContextProvider({ kind: "none" }).kind).toBe("none");
  });
});
