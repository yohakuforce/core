import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * /analyze-batch-limits パック (4 agents + 1 command) が scaffold に同梱されており、
 * 内容が知識グラフの実スキーマに合っていることを担保する。
 *
 * 大前提: graph query は snake_case (`fqn`, `object`, `events_json`, `triggering_object`,
 * `type`, `status`) のみ受け付ける。camelCase / 別名カラム名で書かれていると CLI が拒否する。
 */

const scaffoldRoot = resolve(__dirname, "../../../../..", "scaffold");

const AGENTS = ["cascade-tracer", "apex-query-tracer", "flow-query-tracer", "batch-calculator"];

describe("/analyze-batch-limits pack — files exist", () => {
  it.each(AGENTS)("agent %s.md.eta is present in scaffold", (name) => {
    const p = resolve(scaffoldRoot, ".claude/agents", `${name}.md.eta`);
    expect(existsSync(p)).toBe(true);
  });

  it("command analyze-batch-limits.md.eta is present in scaffold", () => {
    const p = resolve(scaffoldRoot, ".claude/commands/analyze-batch-limits.md.eta");
    expect(existsSync(p)).toBe(true);
  });
});

describe("/analyze-batch-limits pack — front-matter shape", () => {
  it.each(AGENTS)("%s has valid agent front-matter (name, description, tools, model)", (name) => {
    const text = readFileSync(resolve(scaffoldRoot, ".claude/agents", `${name}.md.eta`), "utf8");
    expect(text).toMatch(/^---\s*$/m);
    expect(text).toMatch(new RegExp(`^name:\\s*${name}\\s*$`, "m"));
    expect(text).toMatch(/^description:.*<%=\s*it\.projectName\s*%>/m);
    expect(text).toMatch(/^tools:\s*/m);
    expect(text).toMatch(/^model:\s*(haiku|sonnet|opus)\s*$/m);
  });

  it("command front-matter has description and argument-hint", () => {
    const text = readFileSync(
      resolve(scaffoldRoot, ".claude/commands/analyze-batch-limits.md.eta"),
      "utf8",
    );
    expect(text).toMatch(/^description:/m);
    expect(text).toMatch(/^argument-hint:\s*<ObjectApiName>/m);
  });
});

describe("/analyze-batch-limits pack — SQL uses snake_case schema", () => {
  function loadAll(): Map<string, string> {
    const m = new Map<string, string>();
    for (const a of AGENTS) {
      m.set(
        `agents/${a}`,
        readFileSync(resolve(scaffoldRoot, ".claude/agents", `${a}.md.eta`), "utf8"),
      );
    }
    m.set(
      "commands/analyze-batch-limits",
      readFileSync(resolve(scaffoldRoot, ".claude/commands/analyze-batch-limits.md.eta"), "utf8"),
    );
    return m;
  }

  it("does not reference legacy / wrong column names", () => {
    const all = loadAll();
    // ref 由来の古い・推測カラム名は scaffold には残してはいけない
    const forbidden = [
      /\bapi_name\b/, // objects.fqn / fields.fqn が正
      /\bobject_api_name\b/, // apex_triggers.object が正
      /\bobject_id\b/, // fields.object が正 (JOIN は object→fqn)
      /\bfield_type\b/, // fields.type が正
      /\bevent_type\b/, // apex_triggers.events_json が正
      /\bprocess_type\b/, // flows.type が正
      /\btrigger_type\b/, // flows.* に該当カラム無し
    ];
    for (const [file, text] of all) {
      for (const pat of forbidden) {
        // 実コードや日本語コメントとの誤検出を避けるため、
        // `yohaku graph query "..."` のクオート内のみ走査する
        const queries = text.match(/yohaku graph query\s+"[\s\S]*?"/g) ?? [];
        for (const q of queries) {
          expect(q, `${file}: ${pat} appears in query ${q}`).not.toMatch(pat);
        }
      }
    }
  });

  it("uses required snake_case columns in graph queries", () => {
    const all = loadAll();
    // /analyze-batch-limits は実スキーマの代表 3 クエリを必ず含む
    const cmd = all.get("commands/analyze-batch-limits");
    if (cmd === undefined) throw new Error("analyze-batch-limits command not found");
    expect(cmd).toMatch(/FROM objects WHERE fqn\s*=/);
    expect(cmd).toMatch(/FROM apex_triggers WHERE object\s*=/);
    expect(cmd).toMatch(/FROM flows WHERE triggering_object\s*=/);
    expect(cmd).toMatch(/AND status\s*=\s*'Active'/);
  });
});

describe("/analyze-batch-limits pack — Salesforce-specific correctness", () => {
  it("apex-query-tracer judges __mdt LTA via type='LongTextArea' (not Textarea/length)", () => {
    const text = readFileSync(
      resolve(scaffoldRoot, ".claude/agents/apex-query-tracer.md.eta"),
      "utf8",
    );
    expect(text).toMatch(/type\s*=\s*'LongTextArea'/);
    // 「Textarea + length 32768」式の判定が残っていたら誤り
    expect(text).not.toMatch(/length\s*=\s*32768/);
  });

  it("flow-query-tracer keeps the bulkification rule (loop-outer Get Records = class B)", () => {
    const text = readFileSync(
      resolve(scaffoldRoot, ".claude/agents/flow-query-tracer.md.eta"),
      "utf8",
    );
    expect(text).toMatch(/ループ外.*B\s*分類|B\s*分類.*ループ外/);
    expect(text).toMatch(/バルク化/);
  });

  it("cascade-tracer references events_json (not event_type) for trigger event detection", () => {
    const text = readFileSync(
      resolve(scaffoldRoot, ".claude/agents/cascade-tracer.md.eta"),
      "utf8",
    );
    expect(text).toMatch(/events_json/);
    expect(text).not.toMatch(/\bevent_type\b/);
  });

  it("batch-calculator preserves SOQL=100 / DML=150 governor caps", () => {
    const text = readFileSync(
      resolve(scaffoldRoot, ".claude/agents/batch-calculator.md.eta"),
      "utf8",
    );
    expect(text).toMatch(/SOQL.*100/);
    expect(text).toMatch(/DML.*150/);
    expect(text).toMatch(/×\s*0\.8/); // 安全マージン
  });
});
