// Apex クラスの「メソッド統合表」builder (Phase 13-A)
// controlFlows を再帰的に集計し、各メソッドの SOQL/DML/分岐/ループ/try/呼び出し先件数を出す。

import type {
  ApexBodyInfo,
  ApexControlFlowNode,
  ApexMethodControlFlow,
  ApexMethodInfo,
} from "../types/graph.js";

export interface MethodSummaryRow {
  readonly methodName: string;
  readonly visibility: string;
  readonly isStatic: boolean;
  readonly returnType: string;
  readonly parameters: string;
  readonly soqlCount: number;
  readonly dmlCount: number;
  readonly branchCount: number;
  readonly loopCount: number;
  readonly tryCount: number;
  readonly intraClassCalls: readonly string[];
  readonly externalCalls: readonly string[];
}

// ApexClass / ApexTrigger いずれも body を持つため構造的型で受ける
export function buildMethodSummaryTable(source: {
  readonly body?: ApexBodyInfo;
}): readonly MethodSummaryRow[] {
  const body = source.body;
  if (body === undefined) return [];

  const flowsByName = new Map<string, ApexMethodControlFlow>();
  for (const f of body.controlFlows ?? []) flowsByName.set(f.methodName, f);

  const ownMethodNames = new Set(body.methods.map((m) => m.name));

  return body.methods.map((m) => {
    const flow = flowsByName.get(m.name);
    if (flow === undefined) {
      return baseRowFromMeta(m);
    }
    const stats = walkNodes(flow.nodes);
    const calls = collectCallSites(flow.nodes);
    const intra: string[] = [];
    const external: string[] = [];
    for (const c of calls) {
      if (c.isQualified) {
        external.push(c.fullSite);
      } else if (ownMethodNames.has(c.target) && c.target !== m.name) {
        intra.push(c.target);
      } else if (!ownMethodNames.has(c.target)) {
        // 修飾なし呼び出しでも自クラスに無いなら外部とみなす (例: System.debug, Datetime.now)
        external.push(c.fullSite);
      }
    }
    return {
      methodName: m.name,
      visibility: m.visibility,
      isStatic: m.isStatic,
      returnType: m.returnType,
      parameters: m.parameters,
      soqlCount: stats.soql,
      dmlCount: stats.dml,
      branchCount: stats.branch,
      loopCount: stats.loop,
      tryCount: stats.tryBlocks,
      intraClassCalls: dedup(intra),
      externalCalls: dedup(external),
    };
  });
}

function baseRowFromMeta(m: ApexMethodInfo): MethodSummaryRow {
  return {
    methodName: m.name,
    visibility: m.visibility,
    isStatic: m.isStatic,
    returnType: m.returnType,
    parameters: m.parameters,
    soqlCount: 0,
    dmlCount: 0,
    branchCount: 0,
    loopCount: 0,
    tryCount: 0,
    intraClassCalls: [],
    externalCalls: [],
  };
}

interface NodeStats {
  soql: number;
  dml: number;
  branch: number;
  loop: number;
  tryBlocks: number;
}

function walkNodes(nodes: readonly ApexControlFlowNode[]): NodeStats {
  const stats: NodeStats = { soql: 0, dml: 0, branch: 0, loop: 0, tryBlocks: 0 };
  for (const n of nodes) {
    switch (n.kind) {
      case "soql":
        stats.soql += 1;
        break;
      case "dml":
        stats.dml += 1;
        break;
      case "if": {
        stats.branch += 1;
        const t = walkNodes(n.thenNodes);
        const e = walkNodes(n.elseNodes);
        stats.soql += t.soql + e.soql;
        stats.dml += t.dml + e.dml;
        stats.branch += t.branch + e.branch;
        stats.loop += t.loop + e.loop;
        stats.tryBlocks += t.tryBlocks + e.tryBlocks;
        break;
      }
      case "for":
      case "while": {
        stats.loop += 1;
        const inner = walkNodes(n.body);
        stats.soql += inner.soql;
        stats.dml += inner.dml;
        stats.branch += inner.branch;
        stats.loop += inner.loop;
        stats.tryBlocks += inner.tryBlocks;
        break;
      }
      case "try": {
        stats.tryBlocks += 1;
        const t = walkNodes(n.tryNodes);
        stats.soql += t.soql;
        stats.dml += t.dml;
        stats.branch += t.branch;
        stats.loop += t.loop;
        stats.tryBlocks += t.tryBlocks;
        for (const c of n.catches) {
          const cs = walkNodes(c.nodes);
          stats.soql += cs.soql;
          stats.dml += cs.dml;
          stats.branch += cs.branch;
          stats.loop += cs.loop;
          stats.tryBlocks += cs.tryBlocks;
        }
        const f = walkNodes(n.finallyNodes);
        stats.soql += f.soql;
        stats.dml += f.dml;
        stats.branch += f.branch;
        stats.loop += f.loop;
        stats.tryBlocks += f.tryBlocks;
        break;
      }
      default:
        break;
    }
  }
  return stats;
}

interface CallSite {
  readonly target: string; // 末端のメソッド名 (例: "computeRiskTier" / "now")
  readonly fullSite: string; // "System.debug" / "computeRiskTier" / "Database.update"
  readonly isQualified: boolean; // foo.bar() の形か
}

// `<identifier>(...)` 系のパターンを stmt テキストから抽出
const CALL_REGEX = /(?:([A-Za-z_$][\w$.]*)\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\(/g;
const RESERVED = new Set(["if", "for", "while", "switch", "return", "throw", "catch", "new", "do"]);

function collectCallSites(nodes: readonly ApexControlFlowNode[]): readonly CallSite[] {
  const out: CallSite[] = [];
  function visit(ns: readonly ApexControlFlowNode[]): void {
    for (const n of ns) {
      switch (n.kind) {
        case "stmt":
          out.push(...parseCallSites(n.text));
          break;
        case "if":
          out.push(...parseCallSites(n.condition));
          visit(n.thenNodes);
          visit(n.elseNodes);
          break;
        case "for":
        case "while":
          out.push(...parseCallSites(n.header));
          visit(n.body);
          break;
        case "try":
          visit(n.tryNodes);
          for (const c of n.catches) visit(c.nodes);
          visit(n.finallyNodes);
          break;
        case "return":
        case "throw":
          out.push(...parseCallSites(n.expression));
          break;
        default:
          break;
      }
    }
  }
  visit(nodes);
  return out;
}

function parseCallSites(text: string): readonly CallSite[] {
  const out: CallSite[] = [];
  const re = new RegExp(CALL_REGEX.source, "g");
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const qualifier = m[1];
    const name = m[2] ?? "";
    if (RESERVED.has(name)) {
      m = re.exec(text);
      continue;
    }
    const isQualified = qualifier !== undefined && qualifier !== "";
    out.push({
      target: name,
      fullSite: isQualified ? `${qualifier}.${name}` : name,
      isQualified,
    });
    m = re.exec(text);
  }
  return out;
}

function dedup(items: readonly string[]): readonly string[] {
  return [...new Set(items)].toSorted((a, b) => a.localeCompare(b));
}
