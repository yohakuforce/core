import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractBusinessMeanings } from "../../../src/html/business-meaning-extractor.js";

const PLACEHOLDER_HTML = `<!doctype html><html><body>
<!-- yohaku:block kind="ai_managed" id="business-meaning" start -->
<div class="llm-placeholder">
  <p class="muted">（このセクションは LLM で生成されます）</p>
  <p class="hint">このクラスが業務的に何を解決しているかを 2〜3 文で記述してください。</p>
</div>
<!-- yohaku:block kind="ai_managed" id="business-meaning" end -->
</body></html>`;

const FILLED_HTML = `<!doctype html><html><body>
<!-- yohaku:block kind="ai_managed" id="business-meaning" start -->
<p>このクラスは口座残高を再計算する勘定系の中核です。</p>
<!-- yohaku:block kind="ai_managed" id="business-meaning" end -->
</body></html>`;

describe("extractBusinessMeanings", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "yohaku-bme-"));
    mkdirSync(join(dir, "component", "apex"), { recursive: true });
    mkdirSync(join(dir, "component", "object"), { recursive: true });
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("filled な business-meaning を取り出す", () => {
    writeFileSync(join(dir, "component", "apex", "Foo.html"), FILLED_HTML, "utf8");
    const m = extractBusinessMeanings(dir);
    expect(m.get("apex:Foo")).toContain("勘定系の中核");
  });

  it("placeholder は filled として扱わない", () => {
    writeFileSync(join(dir, "component", "apex", "Foo.html"), PLACEHOLDER_HTML, "utf8");
    const m = extractBusinessMeanings(dir);
    expect(m.get("apex:Foo")).toBeUndefined();
  });

  it("マーカーが無いファイルは無視", () => {
    writeFileSync(join(dir, "component", "apex", "Foo.html"), "<p>no markers</p>", "utf8");
    const m = extractBusinessMeanings(dir);
    expect(m.size).toBe(0);
  });

  it("index.html は対象外", () => {
    writeFileSync(join(dir, "component", "apex", "index.html"), FILLED_HTML, "utf8");
    const m = extractBusinessMeanings(dir);
    expect(m.size).toBe(0);
  });

  it("type をまたいで複数取り出せる", () => {
    writeFileSync(join(dir, "component", "apex", "A.html"), FILLED_HTML, "utf8");
    writeFileSync(
      join(dir, "component", "object", "B.html"),
      FILLED_HTML.replace("勘定系の中核", "請求書本体"),
      "utf8",
    );
    const m = extractBusinessMeanings(dir);
    expect(m.size).toBe(2);
    expect(m.get("object:B")).toContain("請求書本体");
  });

  it("htmlOutDir 不在なら空 Map", () => {
    const m = extractBusinessMeanings("/nonexistent/path/12345");
    expect(m.size).toBe(0);
  });
});
