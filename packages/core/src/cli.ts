#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContextProvider } from "./adapters/context/index.js";
import { DxMcpSourceAdapter } from "./adapters/dx-mcp/index.js";
import { LocalSourceAdapter } from "./adapters/local/index.js";
import { computeDiff } from "./diff/index.js";
import { EXPLAIN_KINDS, type ExplainKind, applyExplain } from "./explain/index.js";
import { KnowledgeGraphReader, SqliteGraphStore, buildGraph } from "./graph/index.js";
import {
  COMPONENT_TYPES,
  type ComponentType,
  HtmlAuditFailedError,
  renderHtmlAll,
  resolveHtmlOutDir,
} from "./html/index.js";
import {
  OrgRetrieveError,
  retrieveOrgSources,
} from "./adapters/org-retrieve/index.js";
import {
  DEFAULT_DOMAINS_PATH,
  lintDomains,
  loadDomainsYaml,
  saveDomainsYaml,
  suggestInitialDomains,
  syncDomains,
} from "./domains/index.js";
import {
  HtmlWriteInputError,
  applyHtmlWrite,
  validateHtmlWriteInput,
} from "./html-write/index.js";
import {
  buildExplainPrompts,
  type ExplainBlockKind,
} from "./explain-prompts/index.js";
import { createStaticServer, startWatch } from "./serve/index.js";
import {
  CoverageParseError,
  DEFAULT_COVERAGE_PATH,
  loadCoverageJson,
  parseCoverageJson,
  saveCoverageJson,
} from "./coverage/index.js";
import { type PrimaryLanguage, type Profile, type Segment, runInit } from "./init/index.js";
import { MetricsStore, summarize } from "./metrics/index.js";
import {
  OnboardingStateStore,
  PERSONA_IDS,
  type PersonaId,
  expandReadOrder,
  extractFaq,
  loadContextMap,
  renderFaqMarkdown,
} from "./onboarding/index.js";
import {
  renderAll,
  renderApex,
  renderApexTriggers,
  renderFlows,
  renderObjects,
  renderPermissions,
  renderSystemIndex,
  renderValidationRules,
} from "./render/index.js";
import {
  InvalidRenderFormatError,
  type RenderFormat,
  parseRenderFormats,
} from "./render/format.js";
import { parseSarifFile } from "./sarif/index.js";
import { loadGraphSchema, validateGraph } from "./schema/validate.js";
import { cleanStaleLock, releaseBuildLock, tryAcquireBuildLock } from "./util/build-lock.js";
import { PathGuardError, assertWithinRoot, resolveWithinRoot } from "./util/path-guard.js";
import { appendTimingLog, measureMsAsync } from "./util/timing-log.js";

const here = dirname(fileURLToPath(import.meta.url));
const BUNDLED_SCAFFOLD = resolve(here, "scaffold");

const YOHAKU_VERSION = "0.4.1";
const DEFAULT_API = "62.0";
const DEFAULT_DB = ".yohaku/graph.sqlite";
const DEFAULT_OUT = "docs/generated";
const DEFAULT_TIMING_LOG = ".yohaku/hook-timings.jsonl";
const DEFAULT_TIMING_WARN_MS = 2000;
const DEFAULT_BUILD_LOCK = ".yohaku/build.lock";
const DEFAULT_BUILD_DIRTY = ".yohaku/build.dirty";
const DEFAULT_ASYNC_LOG = ".yohaku/build-async.log";

interface ParsedArgs {
  readonly command: readonly string[];
  readonly flags: ReadonlyMap<string, string>;
  readonly positional: readonly string[];
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const command: string[] = [];
  const flags = new Map<string, string>();
  const positional: string[] = [];
  let inFlags = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      inFlags = true;
      const eqIdx = arg.indexOf("=");
      if (eqIdx > 0) {
        flags.set(arg.slice(2, eqIdx), arg.slice(eqIdx + 1));
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags.set(arg.slice(2), next);
          i++;
        } else {
          flags.set(arg.slice(2), "true");
        }
      }
    } else if (inFlags) {
      positional.push(arg);
    } else {
      command.push(arg);
    }
  }
  return { command, flags, positional };
}

interface BuildAndStoreOptions {
  readonly root: string;
  readonly dbPath: string;
  readonly apiVersion: string;
  readonly incremental: boolean;
  readonly quiet: boolean;
  readonly sourceKind?: "local" | "dx-mcp";
}

async function buildAndStore(options: BuildAndStoreOptions): Promise<{
  readonly objects: number;
  readonly fields: number;
  readonly flows: number;
  readonly apex: number;
}> {
  const adapter =
    options.sourceKind === "dx-mcp"
      ? new DxMcpSourceAdapter({ apiVersion: options.apiVersion })
      : new LocalSourceAdapter({ rootPath: options.root });
  const graph = await buildGraph(adapter, {
    yohakuVersion: YOHAKU_VERSION,
    salesforceApiVersion: options.apiVersion,
    projectRoot: options.root,
  });

  const store = new SqliteGraphStore({ dbPath: options.dbPath });
  store.writeAll(graph, options.incremental ? "incremental" : "full");
  store.close();

  const counts = {
    objects: graph.objects.length,
    fields: graph.fields.length,
    flows: graph.flows.length,
    apex: graph.apexClasses.length,
  };
  if (!options.quiet) {
    console.log(
      `[yohaku] graph build complete: objects=${counts.objects} fields=${counts.fields} flows=${counts.flows} apex=${counts.apex}`,
    );
  }
  return counts;
}

async function cmdGraphBuild(args: ParsedArgs): Promise<number> {
  let root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const sourceFlag = args.flags.get("source") ?? "local";
  const incremental = args.flags.get("incremental") === "true";
  const apiVersion = args.flags.get("api") ?? DEFAULT_API;
  const quiet = args.flags.get("quiet") === "true";
  const noTimingLog = args.flags.get("no-timing-log") === "true";
  const asyncMode = args.flags.get("async") === "true";
  const asyncWorker = args.flags.get("async-worker") === "true";

  if (sourceFlag !== "local" && sourceFlag !== "dx-mcp" && sourceFlag !== "org") {
    console.error(`Unknown source: ${sourceFlag}. Use --source local|dx-mcp|org.`);
    return 2;
  }

  // --source=org: 事前に sf CLI で manifest 一括 retrieve し、root をその出力に差し替える
  if (sourceFlag === "org") {
    try {
      const typesRaw = args.flags.get("types");
      const types =
        typesRaw === undefined || typesRaw.trim() === ""
          ? undefined
          : typesRaw
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
      const targetDir = args.flags.get("retrieve-to");
      if (!quiet) console.log("[yohaku] org retrieve start (sf project retrieve start)...");
      const result = await retrieveOrgSources({
        apiVersion,
        ...(types !== undefined ? { types } : {}),
        ...(targetDir !== undefined ? { targetDir: resolve(root, targetDir) } : {}),
      });
      root = result.targetDir;
      if (!quiet) console.log(`[yohaku] org retrieve complete: targetDir=${root}`);
    } catch (err) {
      if (err instanceof OrgRetrieveError) {
        console.error(`[yohaku] ${err.message}`);
        return 1;
      }
      throw err;
    }
  }

  // 以降の buildAndStore には常に "local" として渡す (org は事前 retrieve で local に統合済み)
  const sourceKind: "local" | "dx-mcp" = sourceFlag === "dx-mcp" ? "dx-mcp" : "local";

  const lockPaths = {
    lockPath: resolve(root, args.flags.get("lock-file") ?? DEFAULT_BUILD_LOCK),
    dirtyPath: resolve(root, args.flags.get("dirty-file") ?? DEFAULT_BUILD_DIRTY),
  };
  const timingPath = resolve(root, args.flags.get("timing-log") ?? DEFAULT_TIMING_LOG);

  // --async: 子プロセスを detach して即座に戻る (Claude Code hook の wall-clock を最小化)
  if (asyncMode && !asyncWorker) {
    return spawnAsyncBuildWorker({ args, root });
  }

  // --async-worker: detach された子プロセス。ロックを取って実行。
  if (asyncWorker) {
    cleanStaleLock(lockPaths);
    const acq = tryAcquireBuildLock(lockPaths);
    if (!acq.acquired) {
      // 既に別 build が走っている。dirty を立てた (tryAcquireBuildLock 内) ので終了。
      if (!quiet) {
        console.error(
          `[yohaku] async build skipped: another build is in progress (${acq.heldBy}). Marked dirty for re-run.`,
        );
      }
      return 0;
    }
    try {
      // 「並行 Edit で取りこぼした最後の変更を 1 回だけ拾う」ループ。無限再実行は防ぐ。
      const maxReruns = 1;
      let rerunCount = 0;
      let keepGoing = true;
      while (keepGoing) {
        const { result: counts, durationMs } = await measureMsAsync(() =>
          buildAndStore({ root, dbPath, apiVersion, incremental, quiet: true, sourceKind }),
        );
        if (!noTimingLog) {
          appendTimingLog(
            timingPath,
            {
              timestamp: new Date().toISOString(),
              command: "graph build",
              durationMs: Math.round(durationMs),
              mode: incremental ? "incremental" : "full",
              extra: {
                objects: counts.objects,
                fields: counts.fields,
                flows: counts.flows,
                apex: counts.apex,
                source: sourceKind,
                async: true,
                rerun: rerunCount > 0,
              },
            },
            { warnThresholdMs: DEFAULT_TIMING_WARN_MS, silent: true },
          );
        }
        // dirty が立っていれば 1 回だけ再実行
        const release = releaseBuildLock(lockPaths);
        if (!release.rerunNeeded || rerunCount >= maxReruns) {
          keepGoing = false;
          break;
        }
        rerunCount++;
        // 次のループに備えて lock を取り直す
        const next = tryAcquireBuildLock(lockPaths);
        if (!next.acquired) keepGoing = false;
      }
    } catch (err) {
      // worker は detach されているので親への通知経路がない。ログだけ残す。
      releaseBuildLock(lockPaths);
      try {
        const errPath = resolve(root, DEFAULT_ASYNC_LOG);
        mkdirSync(dirname(errPath), { recursive: true });
        const fd = openSync(errPath, "a");
        const msg = `${new Date().toISOString()} [error] ${(err as Error).message}\n`;
        try {
          writeSync(fd, msg);
        } finally {
          closeSync(fd);
        }
      } catch {
        // ignore
      }
      return 1;
    }
    return 0;
  }

  // 通常 (同期) 実行
  const { result: counts, durationMs } = await measureMsAsync(() =>
    buildAndStore({ root, dbPath, apiVersion, incremental, quiet, sourceKind }),
  );

  if (!noTimingLog) {
    appendTimingLog(
      timingPath,
      {
        timestamp: new Date().toISOString(),
        command: "graph build",
        durationMs: Math.round(durationMs),
        mode: incremental ? "incremental" : "full",
        extra: {
          objects: counts.objects,
          fields: counts.fields,
          flows: counts.flows,
          apex: counts.apex,
          source: sourceKind,
        },
      },
      { warnThresholdMs: DEFAULT_TIMING_WARN_MS, silent: quiet },
    );
  }
  return 0;
}

/**
 * --async モードの起動口: detach された子プロセスに --async-worker を付けて起動し、即座に戻る。
 * stdout/stderr は `.yohaku/build-async.log` にリダイレクト。
 */
function spawnAsyncBuildWorker(opts: { args: ParsedArgs; root: string }): number {
  const { args, root } = opts;
  const logPath = resolve(root, DEFAULT_ASYNC_LOG);
  mkdirSync(dirname(logPath), { recursive: true });
  const out = openSync(logPath, "a");

  // 引数を組み立て直し: --async → --async-worker, それ以外は保持
  const childArgs: string[] = ["graph", "build", "--async-worker"];
  for (const [k, v] of args.flags) {
    if (k === "async" || k === "async-worker") continue;
    if (v === "true") childArgs.push(`--${k}`);
    else childArgs.push(`--${k}`, v);
  }

  // 自分自身 (cli.js) を node で再起動する
  const selfPath = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [selfPath, ...childArgs], {
    detached: true,
    stdio: ["ignore", out, out],
    cwd: root,
    env: process.env,
  });
  child.unref();
  // 親プロセスは即座に戻る (hook の wall-clock を最小化)
  return 0;
}

async function cmdSync(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const outDir = resolve(root, args.flags.get("output") ?? DEFAULT_OUT);
  const apiVersion = args.flags.get("api") ?? DEFAULT_API;
  const quiet = args.flags.get("quiet") === "true";
  // sync はデフォルトで incremental (full は --full-rebuild で明示)
  const incremental = args.flags.get("full-rebuild") !== "true";

  const formats = parseFormatsOrError(args);
  if (formats === null) return 2;

  await buildAndStore({ root, dbPath, apiVersion, incremental, quiet });

  const graph = readGraphFromStore(dbPath);
  if (formats.includes("md")) {
    // Phase 7-A: sync で全種 Markdown 化
    reportRender(renderAll(graph, outDir));
  }
  if (formats.includes("html")) {
    if (!runHtmlOrReport(graph, outDir, args)) return 1;
  }
  return 0;
}

/**
 * `--format md|html|md,html` を解釈する共通ヘルパ。
 * 不正値の場合は stderr に出力して null を返す (呼び側が exit code 2 を返す)。
 */
function parseFormatsOrError(args: ParsedArgs): readonly RenderFormat[] | null {
  try {
    return parseRenderFormats(args.flags.get("format"));
  } catch (err) {
    if (err instanceof InvalidRenderFormatError) {
      console.error(`[yohaku] ${err.message}`);
      return null;
    }
    throw err;
  }
}

/**
 * `--strict` / `--types` を ParsedArgs から組み立てる。
 * --types は CSV、空白許容、不正値はエラー扱い (stderr に警告して空 filter)。
 */
function buildHtmlOptions(args: ParsedArgs): {
  strict?: boolean;
  typesFilter?: readonly ComponentType[];
  domainsConfig?: ReturnType<typeof loadDomainsYaml>;
  gitCwd?: string;
  coverage?: ReturnType<typeof loadCoverageJson>;
} {
  const opt: {
    strict?: boolean;
    typesFilter?: readonly ComponentType[];
    domainsConfig?: ReturnType<typeof loadDomainsYaml>;
    gitCwd?: string;
    coverage?: ReturnType<typeof loadCoverageJson>;
  } = {};
  opt.gitCwd = args.flags.get("root") ?? process.cwd();
  if (args.flags.get("strict") === "true") opt.strict = true;
  const typesRaw = args.flags.get("types");
  if (typesRaw !== undefined && typesRaw.trim() !== "") {
    const parsed = typesRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    const valid: ComponentType[] = [];
    for (const p of parsed) {
      if ((COMPONENT_TYPES as readonly string[]).includes(p)) {
        valid.push(p as ComponentType);
      } else {
        console.warn(`[yohaku] --types: unknown component type "${p}" ignored`);
      }
    }
    if (valid.length > 0) opt.typesFilter = valid;
  }
  const root = args.flags.get("root") ?? process.cwd();
  const domainsPath = resolve(root, args.flags.get("domains-path") ?? DEFAULT_DOMAINS_PATH);
  if (existsSync(domainsPath)) {
    try {
      opt.domainsConfig = loadDomainsYaml(domainsPath);
    } catch (err) {
      console.warn(`[yohaku] domains.yaml load failed, falling back to tags: ${(err as Error).message}`);
    }
  }
  const coveragePath = resolve(root, args.flags.get("coverage-path") ?? DEFAULT_COVERAGE_PATH);
  if (existsSync(coveragePath)) {
    try {
      opt.coverage = loadCoverageJson(coveragePath);
    } catch (err) {
      console.warn(`[yohaku] coverage.json load failed: ${(err as Error).message}`);
    }
  }
  return opt;
}

/**
 * HTML レンダ実行 + 失敗報告。
 * - HtmlAuditFailedError が出れば失敗として false を返す。
 * - それ以外は reportHtmlRender でサマリを出して true。
 */
function runHtmlOrReport(
  graph: ReturnType<typeof readGraphFromStore>,
  outDir: string,
  args: ParsedArgs,
): boolean {
  try {
    reportHtmlRender(
      renderHtmlAll(graph, resolveHtmlOutDir(outDir), buildHtmlOptions(args)),
    );
    return true;
  } catch (err) {
    if (err instanceof HtmlAuditFailedError) {
      console.error(`[yohaku] html render aborted (strict): ${err.failures.length} audit failures`);
      for (const f of err.failures) {
        console.error(
          `  audit_failure: ${f.type}/${f.componentName} missing=[${f.missing.join(",")}]`,
        );
      }
      return false;
    }
    throw err;
  }
}

function reportHtmlRender(result: {
  written: readonly string[];
  skipped: readonly string[];
  auditFailures: readonly { type: string; componentName: string; missing: readonly string[] }[];
  warnings: readonly { code: string; message: string }[];
}): void {
  console.log(
    `[yohaku] html render complete: written=${result.written.length} skipped=${result.skipped.length} audit_failures=${result.auditFailures.length}`,
  );
  for (const w of result.warnings) {
    console.warn(`  ${w.code}: ${w.message}`);
  }
  for (const f of result.auditFailures) {
    console.warn(
      `  audit_failure: ${f.type}/${f.componentName} missing=[${f.missing.join(",")}]`,
    );
  }
}

async function cmdGraphQuery(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  // SQL は "graph query" の後ろ (command[2]+) と positional のどちらにも来うる
  const sqlFromCommand = args.command.slice(2).join(" ");
  const sqlFromPositional = args.positional.join(" ");
  const sql = [sqlFromCommand, sqlFromPositional]
    .filter((s) => s !== "")
    .join(" ")
    .trim();
  if (sql === "") {
    console.error('Usage: yohaku graph query "<SQL>"');
    return 2;
  }
  // 外部入力 SQL は readonly モード + SELECT allowlist の二重防御で実行する
  const store = new SqliteGraphStore({ dbPath, readonly: true });
  let rows: readonly unknown[];
  try {
    rows = store.queryUntrusted(sql);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[yohaku] graph query rejected: ${msg}`);
    // 「PRAGMA を試そうとした」「複文」のような典型誤りには専用ヒントを出す
    if (/Untrusted query rejected/.test(msg) && /pragma/i.test(sql)) {
      console.error(
        "Hint: PRAGMA is intentionally blocked on this path. Use `yohaku graph schema --tables` to inspect tables/columns.",
      );
    }
    // SQLite エラーから「該当しないテーブル/カラム名」を抽出し、近い候補を提案する
    const hint = buildGraphQueryHint(store, msg);
    if (hint) console.error(hint);
    store.close();
    return 2;
  }
  store.close();
  console.log(JSON.stringify(rows, null, 2));
  return 0;
}

/**
 * SQLite の "no such column: X" / "no such table: X" エラー時に
 * 近い候補を提案するヒントメッセージを生成する。
 * camelCase → snake_case の典型誤推測も明示的に検出する。
 */
function buildGraphQueryHint(store: SqliteGraphStore, errorMsg: string): string | null {
  const colMatch = errorMsg.match(/no such column:\s*([A-Za-z_][\w.]*)/);
  const tblMatch = errorMsg.match(/no such table:\s*([A-Za-z_][\w.]*)/);
  if (colMatch) {
    const bad = colMatch[1] ?? "";
    const last = bad.includes(".") ? (bad.split(".").pop() ?? bad) : bad;
    let candidates: readonly string[];
    try {
      candidates = store.getAllColumnNames();
    } catch {
      return null;
    }
    const snake = camelToSnake(last);
    const lines: string[] = [];
    if (snake !== last && candidates.includes(snake)) {
      lines.push(`Hint: did you mean "${snake}"? Column names in this graph are snake_case.`);
    }
    const near = nearestNames(last, candidates, 3);
    if (near.length > 0) lines.push(`Hint: similar columns → ${near.join(", ")}`);
    lines.push("Hint: run `yohaku graph schema --tables` to see all tables and columns.");
    return lines.join("\n");
  }
  if (tblMatch) {
    const bad = tblMatch[1] ?? "";
    let candidates: readonly string[];
    try {
      candidates = store.getAllTableNames();
    } catch {
      return null;
    }
    const snake = camelToSnake(bad);
    const lines: string[] = [];
    if (snake !== bad && candidates.includes(snake)) {
      lines.push(`Hint: did you mean "${snake}"? Table names in this graph are snake_case.`);
    }
    const near = nearestNames(bad, candidates, 3);
    if (near.length > 0) lines.push(`Hint: similar tables → ${near.join(", ")}`);
    lines.push("Hint: run `yohaku graph schema --tables` to see all tables and columns.");
    return lines.join("\n");
  }
  return null;
}

function camelToSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function nearestNames(target: string, candidates: readonly string[], limit: number): string[] {
  const t = target.toLowerCase();
  const scored = candidates
    .map((c) => ({ name: c, d: levenshtein(t, c.toLowerCase()) }))
    .filter((x) => x.d <= Math.max(2, Math.floor(t.length / 2)))
    .sort((a, b) => a.d - b.d);
  return scored.slice(0, limit).map((x) => x.name);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

async function cmdGraphSchema(args: ParsedArgs): Promise<number> {
  const format = args.flags.get("format") ?? "json";
  // --tables: 実 SQLite テーブル定義を返す (PRAGMA 経由できない LLM 向けの安全な経路)
  if (args.flags.has("tables")) {
    const root = args.flags.get("root") ?? process.cwd();
    const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
    // `--tables objects` (filterとして) と `--tables --table=objects` の両方を許容
    const tablesVal = args.flags.get("tables");
    const tableFilter =
      args.flags.get("table") ?? (tablesVal && tablesVal !== "true" ? tablesVal : undefined);
    const store = new SqliteGraphStore({ dbPath, readonly: true });
    let schemas: ReturnType<SqliteGraphStore["getTableSchemas"]>;
    try {
      schemas = store.getTableSchemas(tableFilter);
    } catch (err) {
      console.error(`[yohaku] graph schema --tables failed: ${(err as Error).message}`);
      store.close();
      return 2;
    }
    store.close();
    if (format === "markdown") {
      console.log("# Knowledge Graph Tables\n");
      for (const s of schemas) {
        console.log(`## \`${s.table}\`\n`);
        console.log("| Column | Type | Not Null | Default | PK |");
        console.log("|---|---|---|---|---|");
        for (const c of s.columns) {
          const dflt = c.defaultValue ?? "";
          console.log(
            `| \`${c.name}\` | ${c.type} | ${c.notNull ? "Y" : ""} | ${dflt} | ${c.primaryKey ? "Y" : ""} |`,
          );
        }
        console.log("");
      }
    } else {
      console.log(JSON.stringify(schemas, null, 2));
    }
    return 0;
  }
  // 後方互換: 引数なしは meta スキーマ (既存挙動)
  const schema = loadGraphSchema();
  if (format === "markdown") {
    console.log("# Knowledge Graph Schema\n");
    console.log("```json");
    console.log(JSON.stringify(schema, null, 2));
    console.log("```");
  } else {
    console.log(JSON.stringify(schema, null, 2));
  }
  return 0;
}

async function cmdRender(args: ParsedArgs): Promise<number> {
  const target = args.command[1];
  const root = args.flags.get("root") ?? process.cwd();
  const outDir = resolve(root, args.flags.get("output") ?? DEFAULT_OUT);
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const renderAllFlag = args.flags.get("all") === "true";

  const formats = parseFormatsOrError(args);
  if (formats === null) return 2;

  if (!existsSync(dbPath)) {
    console.error(`Knowledge graph not found at ${dbPath}. Run "yohaku graph build" first.`);
    return 2;
  }

  const graph = readGraphFromStore(dbPath);

  // HTML はターゲット指定に依らず graph 全体から生成する (Phase 0 stub)。
  // ターゲット別の HTML 部分生成は Phase 3 で domain/component フィルタとして再設計する。
  let htmlFailed = false;
  const runHtml = (): void => {
    if (formats.includes("html")) {
      if (!runHtmlOrReport(graph, outDir, args)) htmlFailed = true;
    }
  };
  const includeMd = formats.includes("md");

  if (target === undefined && renderAllFlag) {
    if (includeMd) reportRender(renderAll(graph, outDir));
    runHtml();
    return htmlFailed ? 1 : 0;
  }
  if (target === undefined) {
    if (includeMd) {
      // 後方互換: 引数省略時は system-index + objects (Phase 2.5 仕様)
      const r1 = renderSystemIndex(graph, outDir);
      const r2 = renderObjects(graph, outDir);
      reportRender({
        written: [...r1.written, ...r2.written],
        archived: [...r1.archived, ...r2.archived],
        warnings: [...r1.warnings, ...r2.warnings],
      });
    }
    runHtml();
    return htmlFailed ? 1 : 0;
  }
  if (target === "all") {
    if (includeMd) reportRender(renderAll(graph, outDir));
    runHtml();
    return htmlFailed ? 1 : 0;
  }
  // 単一ターゲット指定: md レンダラを呼び、その後で html も走らせる。
  const singleTargetMd = (): boolean => {
    if (!includeMd) return true; // md 不要なら success とみなす
    if (target === "system-index") {
      reportRender(renderSystemIndex(graph, outDir));
      return true;
    }
    if (target === "objects") {
      reportRender(renderObjects(graph, outDir));
      return true;
    }
    if (target === "flows") {
      reportRender(renderFlows(graph, outDir));
      return true;
    }
    if (target === "apex") {
      reportRender(renderApex(graph, outDir));
      return true;
    }
    if (target === "triggers") {
      reportRender(renderApexTriggers(graph, outDir));
      return true;
    }
    if (target === "permissions") {
      reportRender(renderPermissions(graph, outDir));
      return true;
    }
    if (target === "validation-rules") {
      reportRender(renderValidationRules(graph, outDir));
      return true;
    }
    return false;
  };
  if (!singleTargetMd()) {
    console.error(`Unknown render target: ${target}`);
    return 2;
  }
  runHtml();
  return htmlFailed ? 1 : 0;
}

function reportRender(result: {
  written: readonly string[];
  archived: readonly string[];
  warnings: readonly { code: string; blockId?: string }[];
}): void {
  console.log(
    `[yohaku] render complete: written=${result.written.length} archived=${result.archived.length} warnings=${result.warnings.length}`,
  );
  for (const w of result.warnings) {
    console.warn(`  warning: ${w.code} ${w.blockId ?? ""}`);
  }
}

function readGraphFromStore(dbPath: string) {
  const reader = new KnowledgeGraphReader({ dbPath });
  try {
    return reader.read();
  } finally {
    reader.close();
  }
}

async function cmdDiff(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const fromRef = args.flags.get("from");
  const toRef = args.flags.get("to") ?? "HEAD";
  if (fromRef === undefined) {
    console.error("Usage: yohaku diff --from <ref> [--to <ref>] [--path-prefix force-app/]");
    return 2;
  }
  const fileLimitRaw = args.flags.get("limit");
  const fileLimit =
    fileLimitRaw !== undefined && !Number.isNaN(Number(fileLimitRaw))
      ? Number(fileLimitRaw)
      : undefined;
  const pathPrefix = args.flags.get("path-prefix");

  const diff = computeDiff({
    fromRef,
    toRef,
    cwd: root,
    ...(fileLimit !== undefined ? { fileLimit } : {}),
    ...(pathPrefix !== undefined ? { pathPrefix } : {}),
  });

  const sarifPath = args.flags.get("include-static-analysis");
  const findings = sarifPath !== undefined ? parseSarifFile(resolve(root, sarifPath)) : [];

  const json = args.flags.get("json") === "true";
  const format = args.flags.get("format");

  // Phase 13: --format html — release-review.html を出力
  if (format === "html") {
    const outRoot = resolve(root, args.flags.get("out") ?? DEFAULT_OUT);
    const htmlOutDir = resolve(outRoot, "html");
    const outputPath =
      args.flags.get("output") !== undefined
        ? resolve(root, args.flags.get("output") as string)
        : resolve(htmlOutDir, "release-review.html");

    // graph (任意): あれば component leaf へのリンクを生成
    let graph: ReturnType<typeof readGraphFromStore> | undefined;
    const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
    if (existsSync(dbPath)) graph = readGraphFromStore(dbPath);

    // diff.css を assets/ に出す (idempotent)
    const assetsDir = resolve(htmlOutDir, "assets");
    if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });
    writeFileSync(resolve(assetsDir, "diff.css"), (await import("./diff/index.js")).DIFF_CSS, "utf8");

    const html = (await import("./diff/index.js")).renderDiffHtml(diff, {
      title: `Release Review (${fromRef}..${toRef})`,
      ...(graph !== undefined ? { graph } : {}),
    });
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, html, "utf8");
    console.log(
      `[yohaku] diff ${fromRef}..${toRef}: files=${diff.totals.files} +${diff.totals.addedLines} -${diff.totals.removedLines} → ${outputPath}`,
    );
    return 0;
  }

  if (json) {
    console.log(JSON.stringify({ ...diff, staticAnalysisFindings: findings }, null, 2));
  } else {
    console.log(
      `[yohaku] diff ${fromRef}..${toRef}: files=${diff.totals.files} +${diff.totals.addedLines} -${diff.totals.removedLines} truncated=${diff.truncated}`,
    );
    for (const [cat, count] of Object.entries(diff.totals.byCategory)) {
      if (count === 0) continue;
      console.log(`  ${cat}: ${count}`);
    }
    if (findings.length > 0) {
      console.log(`  static_analysis: ${findings.length} findings`);
    }
  }
  return 0;
}

async function cmdOnboardContext(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const role = (args.flags.get("role") ?? "new_joiner").replace(/-/g, "_") as PersonaId;
  if (!PERSONA_IDS.includes(role)) {
    console.error(`Unknown role: ${role}. Use one of: ${PERSONA_IDS.join(", ")}`);
    return 2;
  }
  const contextMap = loadContextMap({ rootPath: root });
  const persona = contextMap.personas[role];
  const expanded = expandReadOrder(persona, contextMap);
  const output = {
    project: contextMap.project.name,
    role,
    goal: persona.goal,
    depth: persona.depth,
    primaryAgent: persona.primaryAgent,
    readOrder: expanded,
    domains: contextMap.project.domains,
  };
  console.log(JSON.stringify(output, null, 2));
  return 0;
}

async function cmdOnboardState(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const sub = args.command[2] ?? "show";
  const store = new OnboardingStateStore({ rootPath: root });

  if (sub === "show") {
    console.log(JSON.stringify(store.read(), null, 2));
    return 0;
  }
  if (sub === "record-step") {
    const role = (args.flags.get("role") ?? "").replace(/-/g, "_") as PersonaId;
    const step = args.flags.get("step");
    if (!PERSONA_IDS.includes(role) || step === undefined) {
      console.error(
        "Usage: yohaku onboard state record-step --role <persona> --step <step-id> [--entities a,b,c]",
      );
      return 2;
    }
    const entitiesRaw = args.flags.get("entities");
    const entities = entitiesRaw ? entitiesRaw.split(",").map((s) => s.trim()) : [];
    const result = store.recordStep(role, step, entities);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (sub === "increment-questions") {
    const role = (args.flags.get("role") ?? "").replace(/-/g, "_") as PersonaId;
    if (!PERSONA_IDS.includes(role)) {
      console.error("Usage: yohaku onboard state increment-questions --role <persona>");
      return 2;
    }
    const result = store.incrementQuestions(role);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (sub === "reset") {
    const roleFlag = args.flags.get("role");
    const role = roleFlag !== undefined ? (roleFlag.replace(/-/g, "_") as PersonaId) : undefined;
    if (role !== undefined && !PERSONA_IDS.includes(role)) {
      console.error(`Unknown role: ${role}`);
      return 2;
    }
    store.reset(role);
    console.log(`[yohaku] reset ${role ?? "all"}`);
    return 0;
  }
  console.error(`Unknown subcommand: state ${sub}. Use show|record-step|increment-questions|reset`);
  return 2;
}

async function cmdOnboardFaqExtract(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const inputFile = args.flags.get("input");
  const topic = args.flags.get("topic") ?? "general";
  const minOcc = Number(args.flags.get("min-occurrences") ?? 1);
  if (inputFile === undefined) {
    console.error(
      "Usage: yohaku onboard faq extract --input <dialog-log.md> [--topic <name>] [--min-occurrences 1]",
    );
    return 2;
  }
  let inputAbs: string;
  try {
    inputAbs = resolveWithinRoot(root, inputFile, "--input");
  } catch (err) {
    console.error(`[yohaku] ${(err as Error).message}`);
    return 2;
  }
  const content = readFileSync(inputAbs, "utf8");
  const candidates = extractFaq(content, { minOccurrences: Number.isNaN(minOcc) ? 1 : minOcc });
  const md = renderFaqMarkdown(topic, candidates);
  console.log(md);
  return 0;
}

async function cmdValidate(args: ParsedArgs): Promise<number> {
  const targetPath = args.flags.get("target");
  if (targetPath === undefined) {
    console.error("Usage: yohaku validate --target <path-to-json-graph>");
    return 2;
  }
  let resolvedTarget: string;
  try {
    resolvedTarget = resolveWithinRoot(process.cwd(), targetPath, "--target");
  } catch (err) {
    console.error(`[yohaku] ${(err as Error).message}`);
    return 2;
  }
  let raw: string;
  try {
    raw = readFileSync(resolvedTarget, "utf8");
  } catch (err) {
    console.error(`[yohaku] cannot read --target: ${(err as Error).message}`);
    return 1;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[yohaku] --target is not valid JSON: ${(err as Error).message}`);
    return 1;
  }
  try {
    validateGraph(data);
    console.log("[yohaku] validate: OK");
    return 0;
  } catch (err) {
    console.error(`[yohaku] validate: FAILED — ${(err as Error).message}`);
    return 1;
  }
}

async function cmdVersion(): Promise<number> {
  console.log(YOHAKU_VERSION);
  return 0;
}

async function cmdMetricsShow(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const period = (args.flags.get("period") ?? "month") as "day" | "week" | "month" | "all";
  const store = new MetricsStore({ rootPath: root });
  const summary = summarize(store.read(), period);
  const output = {
    period: summary.period,
    since: summary.since,
    totals: summary.totals,
    byModel: Object.fromEntries(summary.byModel),
    byCommand: Object.fromEntries(summary.byCommand),
  };
  console.log(JSON.stringify(output, null, 2));
  return 0;
}

async function cmdMetricsRecord(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const model = args.flags.get("model");
  const command = args.flags.get("command");
  const tokensIn = Number(args.flags.get("in") ?? 0);
  const tokensOut = Number(args.flags.get("out") ?? 0);
  const note = args.flags.get("note");

  if (
    model === undefined ||
    command === undefined ||
    Number.isNaN(tokensIn) ||
    Number.isNaN(tokensOut)
  ) {
    console.error(
      'Usage: yohaku metrics record --model <id> --command <name> --in <tokens> --out <tokens> [--note "<text>"]',
    );
    return 2;
  }

  const store = new MetricsStore({ rootPath: root });
  const event = store.record({
    model,
    command,
    tokensIn,
    tokensOut,
    ...(note !== undefined ? { note } : {}),
  });
  console.log(JSON.stringify(event, null, 2));
  return 0;
}

async function cmdInit(args: ParsedArgs): Promise<number> {
  const targetDir = args.flags.get("target") ?? args.flags.get("root") ?? process.cwd();
  const profile = (args.flags.get("profile") ?? "standard") as Profile;
  const projectName =
    args.flags.get("project-name") ?? args.flags.get("name") ?? defaultProjectName(targetDir);
  const language = (args.flags.get("language") ?? "ja") as PrimaryLanguage;
  const apiVersion = args.flags.get("api") ?? DEFAULT_API;
  const segment = (args.flags.get("segment") ?? "unspecified") as Segment;
  const repoUrl = args.flags.get("repo") ?? "";
  const conflict = (args.flags.get("conflict") ?? "skip") as "skip" | "overwrite" | "rename";
  const scaffoldDir = args.flags.get("scaffold") ?? BUNDLED_SCAFFOLD;

  if (!existsSync(scaffoldDir)) {
    console.error(`[yohaku] init: scaffold directory not found at ${scaffoldDir}`);
    return 1;
  }

  const result = await runInit({
    targetDir: resolve(targetDir),
    scaffoldDir,
    conflict,
    variables: {
      projectName,
      profile,
      primaryLanguage: language,
      salesforceApiVersion: apiVersion,
      yohakuVersion: YOHAKU_VERSION,
      segment,
      repoUrl,
      now: new Date().toISOString(),
      enabledCommands: [],
      enabledAgents: [],
      includeDxMcpAdapter: false,
      includeStaticAnalysis: false,
    },
  });

  console.log(
    `[yohaku] init complete: written=${result.written.length} skipped=${result.skipped.length} renamed=${result.renamed.length}`,
  );
  if (args.flags.get("verbose") === "true") {
    console.log(JSON.stringify(result, null, 2));
  }

  if (args.flags.get("bootstrap") === "true") {
    const root = resolve(targetDir);
    const dbPath = resolve(root, DEFAULT_DB);
    const outDir = resolve(root, DEFAULT_OUT);
    console.log("[yohaku] bootstrap: graph build ...");
    await buildAndStore({ root, dbPath, apiVersion, incremental: false, quiet: false });
    console.log("[yohaku] bootstrap: render (all) ...");
    const graph = readGraphFromStore(dbPath);
    reportRender(renderAll(graph, outDir));
    console.log("[yohaku] bootstrap: complete. Open Claude Code and try /onboard.");
  }
  return 0;
}

function defaultProjectName(targetDir: string): string {
  // Windows 互換: パス区切りは OS 依存。両方を受け入れる
  const segments = resolve(targetDir).split(/[/\\]/);
  return segments.at(-1) ?? "salesforce-project";
}

interface CommandHandler {
  readonly handler: (args: ParsedArgs) => Promise<number>;
}

const COMMANDS: ReadonlyMap<string, CommandHandler> = new Map([
  ["init", { handler: cmdInit }],
  ["sync", { handler: cmdSync }],
  ["graph build", { handler: cmdGraphBuild }],
  ["graph query", { handler: cmdGraphQuery }],
  ["graph schema", { handler: cmdGraphSchema }],
  ["render", { handler: cmdRender }],
  ["diff", { handler: cmdDiff }],
  ["validate", { handler: cmdValidate }],
  ["metrics show", { handler: cmdMetricsShow }],
  ["metrics record", { handler: cmdMetricsRecord }],
  ["metrics", { handler: cmdMetricsShow }],
  ["onboard context", { handler: cmdOnboardContext }],
  ["onboard state", { handler: cmdOnboardState }],
  ["onboard faq", { handler: cmdOnboardFaqExtract }],
  ["explain-write", { handler: cmdExplainWrite }],
  ["context", { handler: cmdContext }],
  ["domains init", { handler: cmdDomainsInit }],
  ["domains sync", { handler: cmdDomainsSync }],
  ["domains lint", { handler: cmdDomainsLint }],
  ["html-write", { handler: cmdHtmlWrite }],
  ["explain-prompts", { handler: cmdExplainPrompts }],
  ["serve", { handler: cmdServe }],
  ["coverage import", { handler: cmdCoverageImport }],
  ["coverage show", { handler: cmdCoverageShow }],
  ["version", { handler: cmdVersion }],
]);

async function cmdExplainWrite(args: ParsedArgs): Promise<number> {
  const kindRaw = args.flags.get("kind");
  const fqn = args.flags.get("fqn");
  const projectRoot = args.flags.get("project-root") ?? process.cwd();
  const inputPath = args.flags.get("input");
  const outputDir = args.flags.get("output-dir");

  if (kindRaw === undefined || fqn === undefined || inputPath === undefined) {
    console.error(
      `[yohaku] explain-write requires --kind <${EXPLAIN_KINDS.join("|")}> --fqn <name> --input <file.json>`,
    );
    return 2;
  }
  const validKinds = new Set<string>(EXPLAIN_KINDS);
  if (!validKinds.has(kindRaw)) {
    console.error(`[yohaku] invalid --kind: ${kindRaw} (allowed: ${EXPLAIN_KINDS.join(" | ")})`);
    return 2;
  }
  const kind = kindRaw as ExplainKind;

  let inputAbs: string;
  try {
    inputAbs = resolveWithinRoot(projectRoot, inputPath, "--input");
  } catch (err) {
    console.error(`[yohaku] ${(err as Error).message}`);
    return 2;
  }
  if (!existsSync(inputAbs)) {
    console.error(`[yohaku] input file not found: ${inputAbs}`);
    return 1;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(inputAbs, "utf8"));
  } catch (e) {
    console.error(`[yohaku] invalid JSON: ${(e as Error).message}`);
    return 1;
  }
  if (typeof parsed !== "object" || parsed === null) {
    console.error("[yohaku] input JSON must be an object: { blockId: content, ... }");
    return 1;
  }
  const blocks: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string") {
      console.error(`[yohaku] block "${k}" must be a string`);
      return 1;
    }
    blocks[k] = v;
  }

  const result = applyExplain({ kind, fqn, projectRoot, outputDir }, { blocks });
  console.log(
    `[yohaku] explain-write: updated=${result.updated.length} skipped=${result.skipped.length} → ${result.markdownPath}`,
  );
  if (result.skipped.length > 0) {
    console.log(`[yohaku]   skipped ids: ${result.skipped.join(", ")}`);
  }
  return 0;
}

async function cmdContext(args: ParsedArgs): Promise<number> {
  const kind = args.flags.get("kind");
  const fqn = args.flags.get("fqn");
  const projectRoot = args.flags.get("project-root") ?? process.cwd();

  if (kind === undefined || fqn === undefined) {
    console.error("[yohaku] context requires --kind <metadataKind> --fqn <name>");
    return 2;
  }

  const provider = loadContextProvider(projectRoot);
  try {
    const brief = await provider.relatedContext({ kind, fqn });
    // explain-writer / change-summary が材料として読む。空でも安全な形で出力する。
    console.log(JSON.stringify(brief, null, 2));
    return 0;
  } finally {
    await provider.close();
  }
}

function findCommand(args: ParsedArgs): { key: string; handler: CommandHandler } | undefined {
  const candidates = [args.command.slice(0, 2).join(" "), args.command[0] ?? ""];
  for (const candidate of candidates) {
    const cmd = COMMANDS.get(candidate);
    if (cmd !== undefined) return { key: candidate, handler: cmd };
  }
  return undefined;
}

// ----------------------------------------------------------------------------
// domains init / sync / lint
// ----------------------------------------------------------------------------

async function cmdDomainsInit(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const path = resolve(root, args.flags.get("path") ?? DEFAULT_DOMAINS_PATH);
  const force = args.flags.get("force") === "true";
  if (!existsSync(dbPath)) {
    console.error(`Knowledge graph not found at ${dbPath}. Run "yohaku graph build" first.`);
    return 2;
  }
  if (existsSync(path) && !force) {
    console.error(`${path} already exists. Use --force to overwrite.`);
    return 2;
  }
  const graph = readGraphFromStore(dbPath);
  const config = suggestInitialDomains(graph);
  saveDomainsYaml(path, config);
  console.log(
    `[yohaku] domains init: wrote ${config.domains.length} domain(s) to ${path}`,
  );
  return 0;
}

async function cmdDomainsSync(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const path = resolve(root, args.flags.get("path") ?? DEFAULT_DOMAINS_PATH);
  if (!existsSync(dbPath)) {
    console.error(`Knowledge graph not found at ${dbPath}. Run "yohaku graph build" first.`);
    return 2;
  }
  const existing = loadDomainsYaml(path);
  if (existing === null) {
    console.error(`${path} not found. Run "yohaku domains init" first.`);
    return 2;
  }
  const graph = readGraphFromStore(dbPath);
  const synced = syncDomains(existing, graph);
  saveDomainsYaml(path, synced);
  const beforeCount = countMembers(existing);
  const afterCount = countMembers(synced);
  console.log(
    `[yohaku] domains sync: members ${beforeCount} → ${afterCount} (added ${afterCount - beforeCount})`,
  );
  return 0;
}

async function cmdDomainsLint(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const path = resolve(root, args.flags.get("path") ?? DEFAULT_DOMAINS_PATH);
  if (!existsSync(dbPath)) {
    console.error(`Knowledge graph not found at ${dbPath}. Run "yohaku graph build" first.`);
    return 2;
  }
  const config = loadDomainsYaml(path);
  if (config === null) {
    console.error(`${path} not found. Run "yohaku domains init" first.`);
    return 2;
  }
  const graph = readGraphFromStore(dbPath);
  const report = lintDomains(config, graph);
  for (const f of report.findings) {
    const where = f.domain !== undefined ? ` [${f.domain}]` : "";
    console.log(`  ${f.severity.toUpperCase()} ${f.code}${where}: ${f.message}`);
  }
  console.log(
    `[yohaku] domains lint: ${report.findings.length} finding(s), errors=${report.hasErrors ? "yes" : "no"}`,
  );
  return report.hasErrors ? 1 : 0;
}

function countMembers(config: { domains: readonly { members: readonly unknown[] }[] }): number {
  return config.domains.reduce((sum, d) => sum + d.members.length, 0);
}

// ----------------------------------------------------------------------------
// html-write (Phase 8)
// ----------------------------------------------------------------------------

async function cmdHtmlWrite(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const inputPath = args.flags.get("input");
  if (inputPath === undefined) {
    console.error(
      'Usage: yohaku html-write --input <fill.json> [--out <docs/generated>] [--dry-run]',
    );
    return 2;
  }
  const absInput = resolve(root, inputPath);
  if (!existsSync(absInput)) {
    console.error(`[yohaku] input not found: ${absInput}`);
    return 2;
  }
  const outRoot = resolve(root, args.flags.get("out") ?? DEFAULT_OUT);
  const htmlOutDir = resolve(outRoot, "html");
  if (!existsSync(htmlOutDir)) {
    console.error(`[yohaku] html output dir not found: ${htmlOutDir}. Run "yohaku render --format html" first.`);
    return 2;
  }
  const dryRun = args.flags.get("dry-run") === "true";

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absInput, "utf8"));
  } catch (err) {
    console.error(`[yohaku] JSON parse error: ${(err as Error).message}`);
    return 2;
  }
  let input: ReturnType<typeof validateHtmlWriteInput>;
  try {
    input = validateHtmlWriteInput(raw);
  } catch (err) {
    if (err instanceof HtmlWriteInputError) {
      console.error(`[yohaku] ${err.message}`);
      return 2;
    }
    throw err;
  }

  const result = applyHtmlWrite({ htmlOutDir, input, dryRun });
  console.log(
    `[yohaku] html-write ${dryRun ? "(dry-run) " : ""}complete: updated=${result.updated.length} missing_components=${result.missingComponents.length} missing_blocks=${result.missingBlocks.length} rejected=${result.rejectedBlocks.length}`,
  );
  for (const m of result.missingComponents) {
    console.warn(`  missing_component: ${m.type}/${m.name}`);
  }
  for (const m of result.missingBlocks) {
    console.warn(`  missing_block: ${m.componentName}#${m.blockId}`);
  }
  for (const r of result.rejectedBlocks) {
    console.warn(`  rejected: ${r.componentName}#${r.blockId} (${r.reason})`);
  }
  return 0;
}

// ----------------------------------------------------------------------------
// explain-prompts (Phase 9)
// ----------------------------------------------------------------------------

async function cmdExplainPrompts(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  if (!existsSync(dbPath)) {
    console.error(`Knowledge graph not found at ${dbPath}. Run "yohaku graph build" first.`);
    return 2;
  }

  const kindsRaw = args.flags.get("kind");
  const typesRaw = args.flags.get("types");
  const namesRaw = args.flags.get("names");
  const maxItemsRaw = args.flags.get("max-items");
  const outputPath = args.flags.get("output");

  const kinds =
    kindsRaw === undefined || kindsRaw.trim() === ""
      ? undefined
      : (kindsRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s === "business-meaning" || s === "concerns") as ExplainBlockKind[]);

  const typesFilter =
    typesRaw === undefined || typesRaw.trim() === ""
      ? undefined
      : (typesRaw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) =>
            (COMPONENT_TYPES as readonly string[]).includes(s),
          ) as ComponentType[]);

  const namesFilter =
    namesRaw === undefined || namesRaw.trim() === ""
      ? undefined
      : namesRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const maxItems = maxItemsRaw !== undefined ? Number(maxItemsRaw) : undefined;
  if (maxItems !== undefined && Number.isNaN(maxItems)) {
    console.error("--max-items must be a number");
    return 2;
  }

  const graph = readGraphFromStore(dbPath);
  const result = buildExplainPrompts(graph, {
    ...(kinds !== undefined ? { kinds } : {}),
    ...(typesFilter !== undefined ? { typesFilter } : {}),
    ...(namesFilter !== undefined ? { namesFilter } : {}),
    ...(maxItems !== undefined ? { maxItems } : {}),
  });

  const json = JSON.stringify(result, null, 2);
  if (outputPath !== undefined) {
    const abs = resolve(root, outputPath);
    writeFileSync(abs, json, "utf8");
    console.log(
      `[yohaku] explain-prompts: ${result.items.length} item(s) written to ${abs}`,
    );
  } else {
    process.stdout.write(json);
  }
  return 0;
}

// ----------------------------------------------------------------------------
// serve (Phase 10)
// ----------------------------------------------------------------------------

async function cmdServe(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const outRoot = resolve(root, args.flags.get("out") ?? DEFAULT_OUT);
  const explicitDir = args.flags.get("dir");
  const rootDir = explicitDir !== undefined
    ? resolve(root, explicitDir)
    : resolve(outRoot, "html");
  if (!existsSync(rootDir)) {
    console.error(`[yohaku] serve: directory not found: ${rootDir}`);
    console.error(`Hint: run "yohaku render --format html" first, or pass --dir <path>.`);
    return 2;
  }
  const portRaw = args.flags.get("port");
  const port = portRaw !== undefined ? Number(portRaw) : 4000;
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    console.error(`[yohaku] serve: invalid port: ${portRaw}`);
    return 2;
  }
  const host = args.flags.get("host") ?? "127.0.0.1";
  const quiet = args.flags.get("quiet") === "true";
  const watchMode = args.flags.get("watch") === "true";
  const watchDir = args.flags.get("watch-dir")
    ? resolve(root, args.flags.get("watch-dir") as string)
    : resolve(root, "force-app");
  const dbPath = resolve(root, args.flags.get("db") ?? DEFAULT_DB);
  const apiVersion = args.flags.get("api") ?? DEFAULT_API;

  let watchHandle: ReturnType<typeof startWatch> | null = null;
  if (watchMode) {
    if (!existsSync(watchDir)) {
      console.error(`[yohaku] serve --watch: watchDir not found: ${watchDir}`);
      return 2;
    }
    watchHandle = startWatch({
      watchDir,
      log: quiet ? undefined : (m) => console.log(m),
      rebuild: async () => {
        // 1. incremental graph rebuild
        await buildAndStore({
          root,
          dbPath,
          apiVersion,
          incremental: true,
          quiet: true,
        });
        // 2. HTML 再生成 (md は serve では使わないので skip)
        const graph = readGraphFromStore(dbPath);
        const domainsPath = resolve(root, DEFAULT_DOMAINS_PATH);
        const domainsConfig = existsSync(domainsPath) ? loadDomainsYaml(domainsPath) : null;
        renderHtmlAll(graph, resolveHtmlOutDir(outRoot), {
          ...(domainsConfig !== null ? { domainsConfig } : {}),
          gitCwd: root,
        });
      },
    });
  }

  const handle = createStaticServer({
    rootDir,
    host,
    port,
    logRequests: !quiet,
    ...(watchHandle !== null ? { sse: watchHandle.sse } : {}),
  });
  console.log(`[yohaku] serving ${rootDir}`);
  console.log(`[yohaku] → ${handle.url}`);
  if (watchMode) {
    console.log(`[yohaku] watching ${watchDir} (changes trigger graph+html rebuild + browser reload)`);
  }
  if (host === "0.0.0.0") {
    console.log("[yohaku] WARNING: bound to 0.0.0.0 — accessible to your LAN");
  }
  console.log("[yohaku] press Ctrl+C to stop");

  // SIGINT / SIGTERM できれいに閉じる
  await new Promise<void>((resolveFn) => {
    let closing = false;
    const shutdown = (signal: string): void => {
      if (closing) return;
      closing = true;
      console.log(`\n[yohaku] received ${signal}, shutting down...`);
      if (watchHandle !== null) watchHandle.close();
      handle.close().then(() => resolveFn()).catch(() => resolveFn());
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });
  return 0;
}

// ----------------------------------------------------------------------------
// coverage (Phase 14)
// ----------------------------------------------------------------------------

async function cmdCoverageImport(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const inputPath = args.flags.get("input");
  if (inputPath === undefined) {
    console.error('Usage: yohaku coverage import --input <coverage.json> [--out .yohaku/coverage.json]');
    return 2;
  }
  const absInput = resolve(root, inputPath);
  if (!existsSync(absInput)) {
    console.error(`[yohaku] input not found: ${absInput}`);
    return 2;
  }
  const outPath = resolve(root, args.flags.get("out") ?? DEFAULT_COVERAGE_PATH);
  let report: ReturnType<typeof parseCoverageJson>;
  try {
    report = parseCoverageJson(readFileSync(absInput, "utf8"), inputPath);
  } catch (err) {
    if (err instanceof CoverageParseError) {
      console.error(`[yohaku] ${err.message}`);
      return 2;
    }
    throw err;
  }
  saveCoverageJson(outPath, report);
  console.log(
    `[yohaku] coverage import: ${report.entries.length} entries → ${outPath} (orgWide=${report.orgWideCoverage ?? "n/a"}, run=${report.testRunCoverage ?? "n/a"})`,
  );
  return 0;
}

async function cmdCoverageShow(args: ParsedArgs): Promise<number> {
  const root = args.flags.get("root") ?? process.cwd();
  const path = resolve(root, args.flags.get("path") ?? DEFAULT_COVERAGE_PATH);
  const report = loadCoverageJson(path);
  if (report === null) {
    console.error(`[yohaku] coverage not found at ${path}. Run "yohaku coverage import" first.`);
    return 2;
  }
  console.log(
    `[yohaku] coverage: ${report.entries.length} entries (source=${report.source}, generatedAt=${report.generatedAt})`,
  );
  if (report.orgWideCoverage !== undefined) console.log(`  org-wide: ${report.orgWideCoverage}%`);
  if (report.testRunCoverage !== undefined) console.log(`  test-run: ${report.testRunCoverage}%`);
  for (const e of report.entries.slice().sort((a, b) => a.coveredPercent - b.coveredPercent).slice(0, 10)) {
    console.log(`  ${e.coveredPercent}%  ${e.type}  ${e.apexName}  (covered=${e.numLinesCovered} / uncovered=${e.numLinesUncovered})`);
  }
  if (report.entries.length > 10) console.log(`  …他 ${report.entries.length - 10} 件 (低カバレッジ順 10 件のみ表示)`);
  return 0;
}

function printHelp(): void {
  console.log(`yohaku ${YOHAKU_VERSION} — Salesforce AI-driven knowledge graph CLI

Quick start (recommended):
  yohaku init --bootstrap [--profile minimal|standard|full] [--project-name <name>]
            [--language ja|en] [--api <version>]
            # init + graph build + render を 1 コマンドで実行
  yohaku sync [--full-rebuild] [--quiet]
            # 日常運用: graph build --incremental + render を 1 コマンドで実行

Setup:
  yohaku init [--bootstrap] [--target <dir>] [--profile minimal|standard|full]
            [--project-name <name>] [--language ja|en] [--api <version>]
            [--segment enterprise|smb|vendor] [--conflict skip|overwrite|rename]

Knowledge graph:
  yohaku graph build [--incremental] [--source local|dx-mcp|org] [--quiet]
                   [--types ApexClass,Flow,...] [--retrieve-to <dir>]
                   # --source=org: sf CLI 認証済みの defaultusername から
                   #                package.xml 一括 retrieve (Phase 4)
                   [--async] [--no-timing-log]
                   # --async: 子プロセスを detach、即座に戻る (Claude Code hook 向け)
                   # 実行時間ログ: .yohaku/hook-timings.jsonl (--no-timing-log で抑止)
  yohaku graph query "<SQL>"
  yohaku graph schema [--format json|markdown]
                    # meta schema (validation 用)
  yohaku graph schema --tables [--table <name>] [--format json|markdown]
                    # 実 SQLite テーブル定義 (LLM 向けの PRAGMA 代替)

Render (Phase 1〜7-A 全 7 ターゲット):
  yohaku render                       # system-index + objects (後方互換)
  yohaku render all                   # 全種を一括 (Phase 7-A)
  yohaku render system-index          # プロジェクト全体像
  yohaku render objects               # SObject 個別 (+ field / VR / dependencies)
  yohaku render flows                 # Flow 個別 (Phase 7-A1)
  yohaku render apex                  # ApexClass 個別 (Phase 7-A2)
  yohaku render triggers              # ApexTrigger 個別 (Phase 7-A3)
  yohaku render permissions           # PermissionSet + Profile (Phase 7-A4)
  yohaku render validation-rules      # ValidationRule 個別 (Phase 7-A4)
  yohaku render --output <dir>
  yohaku render --format md|html|md,html
                                       # 既定: md (後方互換)。html は <output>/html/ に配置。
                                       # Phase 0 時点で html はホーム plate + sections schema のみ生成。

Diff (Phase 3 / 13):
  yohaku diff --from <ref> [--to <ref>] [--json] [--path-prefix force-app/]
            [--limit 1000] [--include-static-analysis <sarif-file>]
            [--format html] [--output release-review.html]
                                       # --format html: リリースレビュー用 HTML 出力
                                       # 各 changed file から component leaf へリンク

Onboarding (Phase 5):
  yohaku onboard context --role <new_joiner|reviewer|release_manager|customer_facing>
  yohaku onboard state show
  yohaku onboard state record-step --role <persona> --step <id> [--entities a,b,c]
  yohaku onboard state increment-questions --role <persona>
  yohaku onboard state reset [--role <persona>]
  yohaku onboard faq extract --input <dialog.md> [--topic <name>] [--min-occurrences 1]

Explain (Phase 8 — /yohaku-explain skill 連携):
  yohaku explain-write --kind apexClass|apexTrigger|flow --fqn <name>
                     --input <blocks.json> [--project-root <dir>] [--output-dir <dir>]
                     # AI_MANAGED ブロックだけを安全に上書き。他ブロックには触らない。

Context (opt-in — Context-Hub 連携):
  yohaku context --kind <metadataKind> --fqn <name> [--project-root <dir>]
                     # 対象に関連するプロジェクト/顧客コンテキストを Context-Hub から取得し
                     # JSON(ContextBrief)で出力。.yohaku/config.json の contextProvider を参照。
                     # 未設定なら空 brief を返す(従来動作のまま)。

HTML edit (Phase 8):
  yohaku html-write --input <fill.json> [--out docs/generated] [--dry-run]
                                       # AI-managed ブロック (<!-- yohaku:block kind="ai_managed" ... -->)
                                       # を JSON 入力で安全に上書き

Coverage (Phase 14):
  yohaku coverage import --input <coverage.json> [--out .yohaku/coverage.json]
                                       # sf apex run test --code-coverage --result-format json
                                       # の出力を取り込み正規化
  yohaku coverage show [--path .yohaku/coverage.json]
                                       # 取り込み済カバレッジサマリ (低カバレッジ順 top 10)

Local preview (Phase 10 / 12):
  yohaku serve [--port 4000] [--host 127.0.0.1] [--dir docs/generated/html] [--quiet]
              [--watch] [--watch-dir force-app]
                                       # docs/generated/html を配信する軽量 HTTP サーバ
                                       # --watch: ソース変更時に graph+HTML 再生成 + ブラウザ auto-reload (SSE)

LLM prompts (Phase 9):
  yohaku explain-prompts [--kind business-meaning,concerns]
                         [--types apex,trigger,...] [--names X,Y,...]
                         [--max-items N] [--output prompts.json]
                                       # 空 AI-managed ブロックを LLM に埋めてもらうための
                                       # prompt + context を JSON 出力。
                                       # 受け取った fill.json は html-write で適用。

Domains (Phase 5):
  yohaku domains init [--path <yaml>] [--force]
                                       # graph からヒューリスティックで初期 domains.yaml を生成
  yohaku domains sync [--path <yaml>]  # graph に追加されたメンバを Unclassified に追記
  yohaku domains lint [--path <yaml>]  # 重複 id / 多重所属 / 孤立メンバ / 未分類を検出

Other:
  yohaku validate --target <graph.json>
  yohaku metrics show [--period day|week|month|all]
  yohaku metrics record --model <id> --command <name> --in <tokens> --out <tokens>
  yohaku version
`);
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return 0;
  }
  const args = parseArgs(argv);
  const cmd = findCommand(args);
  if (cmd === undefined) {
    printHelp();
    return 2;
  }
  try {
    return await cmd.handler.handler(args);
  } catch (err) {
    console.error(`[yohaku] error: ${(err as Error).message}`);
    return 1;
  }
}

function isDirectInvoke(): boolean {
  const argvPath = process.argv[1];
  if (argvPath === undefined) return false;
  try {
    const resolvedArgv = realpathSync(argvPath);
    const resolvedMeta = realpathSync(fileURLToPath(import.meta.url));
    return resolvedArgv === resolvedMeta;
  } catch {
    return false;
  }
}

if (isDirectInvoke()) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
