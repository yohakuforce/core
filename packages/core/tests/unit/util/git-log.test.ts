import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getGitLogForPath } from "../../../src/util/git-log.js";

function fakeSpawn(returns: Partial<SpawnSyncReturns<string>>) {
  return (() => ({
    pid: 0,
    output: [],
    stdout: returns.stdout ?? "",
    stderr: returns.stderr ?? "",
    status: returns.status ?? 0,
    signal: null,
    error: returns.error,
  })) as unknown as typeof import("node:child_process").spawnSync;
}

describe("getGitLogForPath", () => {
  it("git が動かない場合は null", () => {
    const result = getGitLogForPath("force-app/main/default/classes/X.cls", {
      spawnSyncFn: fakeSpawn({ status: 128, stderr: "not a git repository" }),
    });
    expect(result).toBeNull();
  });

  it("spawn error も null", () => {
    const result = getGitLogForPath("X.cls", {
      spawnSyncFn: fakeSpawn({ error: new Error("ENOENT") }),
    });
    expect(result).toBeNull();
  });

  it("空 stdout は空配列", () => {
    const result = getGitLogForPath("X.cls", {
      spawnSyncFn: fakeSpawn({ stdout: "", status: 0 }),
    });
    expect(result).toEqual([]);
  });

  it("コミット行を SHA / 日時 / Author / Subject にパース", () => {
    const sep = "\x1f";
    const line = ["abcdef1234567890", "2026-05-30T10:00:00+09:00", "Koya", "feat: add X"].join(sep);
    const result = getGitLogForPath("X.cls", {
      spawnSyncFn: fakeSpawn({ stdout: line, status: 0 }),
    });
    expect(result).toEqual([
      { sha: "abcdef1", date: "2026-05-30T10:00:00+09:00", author: "Koya", subject: "feat: add X" },
    ]);
  });

  it("複数コミットも正しくパース", () => {
    const sep = "\x1f";
    const lines = [
      ["aaaaaaa1234567", "2026-05-30T10:00:00Z", "Koya", "fix"].join(sep),
      ["bbbbbbb1234567", "2026-05-29T10:00:00Z", "Koya", "feat"].join(sep),
    ].join("\n");
    const result = getGitLogForPath("X.cls", {
      spawnSyncFn: fakeSpawn({ stdout: lines, status: 0 }),
    });
    expect(result).toHaveLength(2);
  });
});
