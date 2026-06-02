import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// scaffold/.claude/settings.json.eta が想定通りの hook 構成になっていることを担保する。
// このテストは「気付かず Edit/Write 全部に hook をかける構成に戻してしまう」事故を防ぐ。
describe("scaffold settings.json.eta — hook hygiene", () => {
  const root = resolve(__dirname, "../../..");
  // core からみた scaffold は repo ルートの ../../scaffold
  const scaffoldPath = resolve(root, "../../scaffold/.claude/settings.json.eta");
  const text = readFileSync(scaffoldPath, "utf8");

  it("uses --async for the PostToolUse graph build hook", () => {
    expect(text).toMatch(/yohaku graph build --incremental --quiet --async/);
  });

  it("PostToolUse pathMatcher is restricted to Salesforce metadata extensions (not blanket force-app/**)", () => {
    // 旧構成の 'force-app/**' のみのマッチャは禁止
    expect(text).not.toMatch(/"pathMatcher":\s*"force-app\/\*\*"\s*,/);
    // 新構成: 拡張子で絞り込んでいる
    expect(text).toMatch(/force-app\/\*\*\/\*\.\{[^}]*cls[^}]*\}/);
  });

  it("Stop hook runs graph build synchronously as a final reconcile", () => {
    expect(text).toMatch(/"Stop"\s*:/);
    // Stop フックの中で sync (--async ではない) build が動く
    const stopBlockMatch = text.match(/"Stop"\s*:\s*\[[\s\S]*?\]/);
    expect(stopBlockMatch).not.toBeNull();
    if (stopBlockMatch === null) throw new Error("Stop block not found");
    const stopBlock = stopBlockMatch[0];
    expect(stopBlock).toMatch(/yohaku graph build --incremental --quiet/);
    expect(stopBlock).not.toMatch(/--async/);
  });

  it("does not run yohaku validate on every docs/generated edit (was a perf hot spot)", () => {
    expect(text).not.toMatch(/yohaku validate --target/);
  });

  it("is valid JSON template (EJS markers stripped renders valid JSON)", () => {
    // EJS タグは "..." 内に埋め込まれているので、タグだけを除去すれば JSON として valid
    const stripped = text.replace(/<%[\s\S]*?%>/g, "placeholder");
    expect(() => JSON.parse(stripped)).not.toThrow();
  });
});

describe("scaffold .gitignore — async/timing artifacts are excluded", () => {
  const root = resolve(__dirname, "../../..");
  const gitignorePath = resolve(root, "../../scaffold/.gitignore");
  const text = readFileSync(gitignorePath, "utf8");

  it("ignores build.lock / build.dirty / build-async.log / hook-timings.jsonl", () => {
    expect(text).toMatch(/\.yohaku\/build\.lock/);
    expect(text).toMatch(/\.yohaku\/build\.dirty/);
    expect(text).toMatch(/\.yohaku\/build-async\.log/);
    expect(text).toMatch(/\.yohaku\/hook-timings\.jsonl/);
  });

  it("ignores SQLite WAL/SHM files", () => {
    expect(text).toMatch(/graph\.sqlite-wal/);
    expect(text).toMatch(/graph\.sqlite-shm/);
  });
});
