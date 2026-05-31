import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HtmlWriteInputError,
  applyHtmlWrite,
  validateHtmlWriteInput,
} from "../../../src/html-write/index.js";

const SAMPLE_HTML = `<!doctype html><html><body>
<!-- yohaku:block kind="ai_managed" id="business-meaning" start -->
<p>(placeholder)</p>
<!-- yohaku:block kind="ai_managed" id="business-meaning" end -->
</body></html>`;

describe("validateHtmlWriteInput", () => {
  it("正常入力をそのまま通す", () => {
    const input = {
      version: 1,
      components: [
        {
          type: "apex",
          name: "AccountService",
          blocks: { "business-meaning": "<p>x</p>" },
        },
      ],
    };
    const parsed = validateHtmlWriteInput(input);
    expect(parsed.components[0]?.type).toBe("apex");
  });

  it("version 不一致でエラー", () => {
    expect(() => validateHtmlWriteInput({ version: 2, components: [] })).toThrow(
      HtmlWriteInputError,
    );
  });

  it("不正な type でエラー", () => {
    expect(() =>
      validateHtmlWriteInput({
        version: 1,
        components: [{ type: "xxx", name: "A", blocks: {} }],
      }),
    ).toThrow(HtmlWriteInputError);
  });

  it("blocks の値が文字列でなければエラー", () => {
    expect(() =>
      validateHtmlWriteInput({
        version: 1,
        components: [{ type: "apex", name: "A", blocks: { x: 123 } }],
      }),
    ).toThrow(HtmlWriteInputError);
  });
});

describe("applyHtmlWrite", () => {
  let htmlOutDir: string;
  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), "yohaku-html-write-"));
    htmlOutDir = root;
    mkdirSync(join(root, "component", "apex"), { recursive: true });
    writeFileSync(join(root, "component", "apex", "AccountService.html"), SAMPLE_HTML, "utf8");
  });
  afterEach(() => {
    rmSync(htmlOutDir, { recursive: true, force: true });
  });

  it("対象ファイルの ai_managed ブロックを書き換える", () => {
    const result = applyHtmlWrite({
      htmlOutDir,
      input: {
        version: 1,
        components: [
          {
            type: "apex",
            name: "AccountService",
            blocks: { "business-meaning": "<p>業務的意味</p>" },
          },
        ],
      },
    });
    expect(result.updated).toHaveLength(1);
    expect(result.missingComponents).toHaveLength(0);
    const html = readFileSync(join(htmlOutDir, "component", "apex", "AccountService.html"), "utf8");
    expect(html).toContain("<p>業務的意味</p>");
    expect(html).not.toContain("(placeholder)");
  });

  it("dryRun では書き戻さないが結果は返す", () => {
    const result = applyHtmlWrite({
      htmlOutDir,
      input: {
        version: 1,
        components: [
          {
            type: "apex",
            name: "AccountService",
            blocks: { "business-meaning": "<p>X</p>" },
          },
        ],
      },
      dryRun: true,
    });
    expect(result.updated).toHaveLength(1);
    const html = readFileSync(join(htmlOutDir, "component", "apex", "AccountService.html"), "utf8");
    expect(html).toContain("(placeholder)");
    expect(html).not.toContain("<p>X</p>");
  });

  it("存在しない component は missingComponents", () => {
    const result = applyHtmlWrite({
      htmlOutDir,
      input: {
        version: 1,
        components: [{ type: "apex", name: "NoSuch", blocks: { "business-meaning": "<p>x</p>" } }],
      },
    });
    expect(result.missingComponents).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
  });

  it("ファイル名サニタイズ (Foo/Bar → Foo_Bar) が効く", () => {
    writeFileSync(join(htmlOutDir, "component", "apex", "Foo_Bar.html"), SAMPLE_HTML, "utf8");
    const result = applyHtmlWrite({
      htmlOutDir,
      input: {
        version: 1,
        components: [{ type: "apex", name: "Foo/Bar", blocks: { "business-meaning": "<p>z</p>" } }],
      },
    });
    expect(result.updated).toHaveLength(1);
  });
});
