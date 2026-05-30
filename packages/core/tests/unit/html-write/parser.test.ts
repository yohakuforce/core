import { describe, expect, it } from "vitest";
import {
  HtmlBlockParseError,
  applyBlockUpdates,
  parseBlocks,
} from "../../../src/html-write/parser.js";

const SAMPLE = `<!doctype html>
<html><body>
<section id="business-meaning">
  <!-- yohaku:block kind="ai_managed" id="business-meaning" start -->
  <p>(placeholder)</p>
  <!-- yohaku:block kind="ai_managed" id="business-meaning" end -->
</section>
<section id="concerns">
  <!-- yohaku:block kind="ai_managed" id="concerns" start -->
  <p>(placeholder concerns)</p>
  <!-- yohaku:block kind="ai_managed" id="concerns" end -->
</section>
</body></html>`;

describe("parseBlocks", () => {
  it("ai_managed ブロックを全件検出する", () => {
    const blocks = parseBlocks(SAMPLE);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.id).toBe("business-meaning");
    expect(blocks[0]?.kind).toBe("ai_managed");
    expect(blocks[1]?.id).toBe("concerns");
  });

  it("マーカー無しの HTML では空配列", () => {
    expect(parseBlocks("<p>no markers</p>")).toEqual([]);
  });

  it("同 id が複数あればエラー", () => {
    const dup = SAMPLE.replaceAll('id="concerns"', 'id="business-meaning"');
    expect(() => parseBlocks(dup)).toThrow(HtmlBlockParseError);
  });

  it("start のみで end が無いとエラー", () => {
    const broken = `<!-- yohaku:block kind="ai_managed" id="x" start --><p>orphan</p>`;
    expect(() => parseBlocks(broken)).toThrow(HtmlBlockParseError);
  });
});

describe("applyBlockUpdates", () => {
  it("既存ブロック content を置換し、マーカーは保持", () => {
    const result = applyBlockUpdates(SAMPLE, {
      "business-meaning": "<p>このクラスは口座残高を再計算する。</p>",
    });
    expect(result.updatedIds).toEqual(["business-meaning"]);
    expect(result.missingIds).toEqual([]);
    expect(result.updatedHtml).toContain(
      "<p>このクラスは口座残高を再計算する。</p>",
    );
    expect(result.updatedHtml).toContain(
      'yohaku:block kind="ai_managed" id="business-meaning" start',
    );
    expect(result.updatedHtml).toContain(
      'yohaku:block kind="ai_managed" id="business-meaning" end',
    );
    expect(result.updatedHtml).not.toContain("(placeholder)");
  });

  it("複数 id を 1 パスで更新できる", () => {
    const result = applyBlockUpdates(SAMPLE, {
      "business-meaning": "<p>A</p>",
      concerns: "<p>B</p>",
    });
    expect(result.updatedIds).toEqual(["business-meaning", "concerns"]);
    expect(result.updatedHtml).toContain("<p>A</p>");
    expect(result.updatedHtml).toContain("<p>B</p>");
    expect(result.updatedHtml).not.toContain("(placeholder)");
    expect(result.updatedHtml).not.toContain("(placeholder concerns)");
  });

  it("存在しない id は missing として報告", () => {
    const result = applyBlockUpdates(SAMPLE, { "no-such-block": "<p>x</p>" });
    expect(result.updatedIds).toEqual([]);
    expect(result.missingIds).toEqual(["no-such-block"]);
  });

  it("kind=deterministic のブロックには書き込まない", () => {
    const html = `<!-- yohaku:block kind="deterministic" id="overview" start -->
data
<!-- yohaku:block kind="deterministic" id="overview" end -->`;
    const result = applyBlockUpdates(html, { overview: "tampered" });
    expect(result.rejectedIds).toHaveLength(1);
    expect(result.rejectedIds[0]?.id).toBe("overview");
    expect(result.updatedHtml).toContain("data");
    expect(result.updatedHtml).not.toContain("tampered");
  });

  it("マーカー外の HTML は不変", () => {
    const result = applyBlockUpdates(SAMPLE, {
      "business-meaning": "<p>X</p>",
    });
    expect(result.updatedHtml).toContain("<!doctype html>");
    expect(result.updatedHtml).toContain("</body></html>");
    expect(result.updatedHtml).toContain('section id="business-meaning"');
  });
});
