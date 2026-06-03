import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../../../src/cli.js";
import { SqliteGraphStore } from "../../../src/graph/sqlite-store.js";

describe("CLI — yohaku graph query error hints", () => {
  let dir: string;
  let dbPath: string;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let outSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "yohaku-cli-hints-"));
    dbPath = join(dir, "graph.sqlite");
    // 空でも SCHEMA_DDL を流すために一度書き込みで開いて close する
    const seeder = new SqliteGraphStore({ dbPath });
    seeder.close();
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    outSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
    outSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  function stderrText(): string {
    return errSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
  }

  it("PRAGMA を投げると 'use yohaku graph schema --tables' のヒントが出る", async () => {
    const code = await main(["graph", "query", "PRAGMA table_info(objects)", "--db", dbPath]);
    expect(code).toBe(2);
    const text = stderrText();
    expect(text).toMatch(/Untrusted query rejected/);
    expect(text).toMatch(/PRAGMA is intentionally blocked/);
    expect(text).toMatch(/yohaku graph schema --tables/);
  });

  it("存在しないカラムを叩くと最低限 schema --tables を案内する", async () => {
    // `fullyQualifiedName` は実カラム `fqn` と語形が遠すぎて Levenshtein 候補に乗らないが、
    // 「`yohaku graph schema --tables` を見ろ」という普遍ヒントは必ず出る。
    const code = await main([
      "graph",
      "query",
      "SELECT fullyQualifiedName FROM objects",
      "--db",
      dbPath,
    ]);
    expect(code).toBe(2);
    const text = stderrText();
    expect(text).toMatch(/no such column/i);
    expect(text).toMatch(/yohaku graph schema --tables/);
  });

  it("triggeringObject → triggering_object の sake_case 修正提案が出る", async () => {
    const code = await main([
      "graph",
      "query",
      "SELECT triggeringObject FROM flows",
      "--db",
      dbPath,
    ]);
    expect(code).toBe(2);
    const text = stderrText();
    expect(text).toMatch(/triggering_object/);
    expect(text).toMatch(/did you mean.*triggering_object/i);
  });

  it("存在しないテーブル名にも候補が出る", async () => {
    const code = await main(["graph", "query", "SELECT * FROM apexTriggers", "--db", dbPath]);
    expect(code).toBe(2);
    const text = stderrText();
    expect(text).toMatch(/apex_triggers/);
  });
});

describe("CLI — yohaku graph schema --tables", () => {
  let dir: string;
  let dbPath: string;
  let outSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "yohaku-cli-tables-"));
    dbPath = join(dir, "graph.sqlite");
    const seeder = new SqliteGraphStore({ dbPath });
    seeder.close();
    outSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    outSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  function stdoutText(): string {
    return outSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
  }

  it("--tables で全テーブルが JSON 出力される", async () => {
    const code = await main(["graph", "schema", "--tables", "--db", dbPath]);
    expect(code).toBe(0);
    const text = stdoutText();
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed)).toBe(true);
    const tableNames = parsed.map((s: { table: string }) => s.table);
    expect(tableNames).toContain("objects");
    expect(tableNames).toContain("apex_triggers");
  });

  it("--tables --table objects で特定テーブルのみ出る", async () => {
    const code = await main(["graph", "schema", "--tables", "--table", "objects", "--db", dbPath]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutText());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].table).toBe("objects");
    const colNames = parsed[0].columns.map((c: { name: string }) => c.name);
    expect(colNames).toContain("fqn");
  });

  it("--tables --format markdown でテーブル表が出る", async () => {
    const code = await main([
      "graph",
      "schema",
      "--tables",
      "--format",
      "markdown",
      "--db",
      dbPath,
    ]);
    expect(code).toBe(0);
    const text = stdoutText();
    expect(text).toMatch(/^# Knowledge Graph Tables/m);
    expect(text).toMatch(/## `objects`/);
    expect(text).toMatch(/\| Column \| Type \|/);
  });

  it("引数なしの `graph schema` は従来通り meta schema を返す (後方互換)", async () => {
    const code = await main(["graph", "schema", "--format", "json"]);
    expect(code).toBe(0);
    const text = stdoutText();
    // meta schema は JSON Schema 形式
    const parsed = JSON.parse(text);
    expect(typeof parsed).toBe("object");
    expect(Array.isArray(parsed)).toBe(false);
  });
});
