import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../../../src/cli.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "yohaku-ctxcmd-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("yohaku context (CLI)", () => {
  it("--kind / --fqn 欠如で code 2", async () => {
    const code = await main(["context", "--project-root", root]);
    expect(code).toBe(2);
  });

  it("設定なし(None)では空 brief を出力して code 0", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      logs.push(String(msg));
    });
    const code = await main([
      "context",
      "--kind",
      "object",
      "--fqn",
      "Account",
      "--project-root",
      root,
    ]);
    expect(code).toBe(0);
    const brief = JSON.parse(logs.join("\n"));
    expect(brief.empty).toBe(true);
    expect(brief.snippets).toEqual([]);
    expect(brief.target).toEqual({ kind: "object", fqn: "Account" });
  });
});
