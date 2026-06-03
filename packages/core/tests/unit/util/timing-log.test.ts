import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendTimingLog, measureMs, measureMsAsync } from "../../../src/util/timing-log.js";

describe("timing-log", () => {
  let dir: string;
  let logPath: string;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "yohaku-timing-"));
    logPath = join(dir, "deep", "hook-timings.jsonl");
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates parent dirs and appends a JSON line", () => {
    appendTimingLog(
      logPath,
      {
        timestamp: "2026-05-15T00:00:00Z",
        command: "graph build",
        durationMs: 800,
        mode: "incremental",
      },
      { silent: true },
    );
    expect(existsSync(logPath)).toBe(true);
    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const firstLine = lines[0];
    if (firstLine === undefined) throw new Error("expected first log line");
    const parsed = JSON.parse(firstLine);
    expect(parsed.command).toBe("graph build");
    expect(parsed.durationMs).toBe(800);
  });

  it("multiple appends create multiple lines", () => {
    appendTimingLog(logPath, { timestamp: "t1", command: "x", durationMs: 1 }, { silent: true });
    appendTimingLog(logPath, { timestamp: "t2", command: "x", durationMs: 2 }, { silent: true });
    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("warns when durationMs exceeds threshold", () => {
    appendTimingLog(
      logPath,
      { timestamp: "t", command: "graph build", durationMs: 3500 },
      { warnThresholdMs: 2000 },
    );
    const stderrText = errSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(stderrText).toMatch(/warning.*graph build took 3\.50s/);
    expect(stderrText).toMatch(/--async|Stop hook/);
  });

  it("does not warn when silent=true", () => {
    appendTimingLog(
      logPath,
      { timestamp: "t", command: "x", durationMs: 9999 },
      { warnThresholdMs: 1000, silent: true },
    );
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("swallows write errors silently (never throws)", () => {
    // /dev/null/sub is invalid path. Should not throw.
    expect(() =>
      appendTimingLog(
        "/dev/null/sub/x.jsonl",
        { timestamp: "t", command: "x", durationMs: 1 },
        { silent: true },
      ),
    ).not.toThrow();
  });
});

describe("measureMs", () => {
  it("returns result and a non-negative duration", () => {
    const { result, durationMs } = measureMs(() => 42);
    expect(result).toBe(42);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it("async variant works", async () => {
    const { result, durationMs } = await measureMsAsync(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return "ok";
    });
    expect(result).toBe("ok");
    expect(durationMs).toBeGreaterThanOrEqual(4);
  });
});
