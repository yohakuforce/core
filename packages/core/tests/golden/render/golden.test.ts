import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MarkerCorruptionError, mergeRenameAware, mergeRender } from "../../../src/merge/index.js";
import { archiveDeleted } from "../../../src/render/archive.js";

const here = dirname(fileURLToPath(import.meta.url));

interface MergeCase {
  readonly kind: "merge";
  readonly templatePath: string;
  readonly expectExistingFile: boolean;
}

interface RenameCase {
  readonly kind: "rename";
  readonly templatePath: string;
  readonly oldFilePath: string;
  readonly expectExistingFile: boolean;
}

interface ArchiveCase {
  readonly kind: "archive";
  readonly existingPath: string;
  readonly archiveBaseDir: string;
  readonly renderDate: string;
}

interface CorruptionSubCase {
  readonly name: string;
  readonly expectedCode: string;
}

interface CorruptionCase {
  readonly kind: "corruption";
  readonly subCases: readonly CorruptionSubCase[];
}

type CaseSpec = MergeCase | RenameCase | ArchiveCase | CorruptionCase;

function loadJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadOptional(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

describe("HUMAN_MANAGED merge — golden tests", () => {
  describe("Case 1: 既存ファイルなし", () => {
    const dir = join(here, "case-1-no-existing-file");
    const spec = loadJSON<MergeCase>(join(dir, "input/case.json"));
    const template = readFileSync(join(dir, "input/template.md"), "utf8");
    const expected = readFileSync(join(dir, "expected/result.md"), "utf8");
    const expectedWarnings = loadJSON<unknown[]>(join(dir, "expected/warnings.json"));

    it("テンプレートをそのまま出力し、warnings は空", () => {
      const result = mergeRender(template, undefined, { templatePath: spec.templatePath });
      expect(result.content).toBe(expected);
      expect(result.warnings).toEqual(expectedWarnings);
      expect(result.preserved).toBe(false);
    });
  });

  describe("Case 2: 3 種ブロックが共存", () => {
    const dir = join(here, "case-2-blocks-coexist");
    const spec = loadJSON<MergeCase>(join(dir, "input/case.json"));
    const template = readFileSync(join(dir, "input/template.md"), "utf8");
    const existing = readFileSync(join(dir, "input/existing.md"), "utf8");
    const expected = readFileSync(join(dir, "expected/result.md"), "utf8");

    it("DETERMINISTIC/AI_MANAGED は新規描画、HUMAN_MANAGED は既存を保持", () => {
      const result = mergeRender(template, existing, { templatePath: spec.templatePath });
      expect(result.content).toBe(expected);
      expect(result.warnings).toEqual([]);
      expect(result.preserved).toBe(true);
    });
  });

  describe("Case 3: HUMAN_MANAGED ブロック消失", () => {
    const dir = join(here, "case-3-human-block-missing");
    const spec = loadJSON<MergeCase>(join(dir, "input/case.json"));
    const template = readFileSync(join(dir, "input/template.md"), "utf8");
    const existing = readFileSync(join(dir, "input/existing.md"), "utf8");
    const expected = readFileSync(join(dir, "expected/result.md"), "utf8");

    it("空ブロックが再挿入され、警告が記録される", () => {
      const result = mergeRender(template, existing, { templatePath: spec.templatePath });
      expect(result.content).toBe(expected);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe("human_block_missing");
      expect(result.warnings[0]?.blockId).toBe("business-context");
    });
  });

  describe("Case 4: エンティティリネーム", () => {
    const dir = join(here, "case-4-entity-rename");
    const spec = loadJSON<RenameCase>(join(dir, "input/case.json"));
    const template = readFileSync(join(dir, "input/template.md"), "utf8");
    const oldContent = readFileSync(join(dir, "input/old.md"), "utf8");
    const expected = readFileSync(join(dir, "expected/result.md"), "utf8");

    it("旧ファイルから HUMAN_MANAGED を移植する", () => {
      const result = mergeRenameAware(template, undefined, oldContent, spec.oldFilePath, {
        templatePath: spec.templatePath,
      });
      expect(result.content).toBe(expected);
      const warning = result.warnings.find((w) => w.code === "human_migrated_from_renamed_entity");
      expect(warning).toBeDefined();
      expect(warning?.blockId).toBe("business-context");
      expect(warning?.originPath).toBe(spec.oldFilePath);
    });
  });

  describe("Case 5: エンティティ削除 (archive)", () => {
    const dir = join(here, "case-5-entity-deleted");
    const spec = loadJSON<ArchiveCase>(join(dir, "input/case.json"));
    const expectedArchivePath = readFileSync(join(dir, "expected/archivedPath.txt"), "utf8").trim();

    it("既存ファイルを _archive/<date>/<original> へ移動する論理パスを返す", () => {
      const archived = archiveDeleted(spec.existingPath, spec.archiveBaseDir, spec.renderDate);
      expect(archived).toBe(expectedArchivePath);
    });
  });

  describe("Case 6: マーカー破損", () => {
    const dir = join(here, "case-6-marker-corruption");
    const spec = loadJSON<CorruptionCase>(join(dir, "input/case.json"));

    for (const sub of spec.subCases) {
      it(`${sub.name} を MarkerCorruptionError として弾く`, () => {
        const corrupt = readFileSync(join(dir, `input/${sub.name}.md`), "utf8");
        try {
          mergeRender(corrupt, undefined, { templatePath: "x.md" });
          expect.fail("Expected MarkerCorruptionError to be thrown");
        } catch (err) {
          expect(err).toBeInstanceOf(MarkerCorruptionError);
          expect((err as MarkerCorruptionError).code).toBe(sub.expectedCode);
        }
      });
    }
  });
});
