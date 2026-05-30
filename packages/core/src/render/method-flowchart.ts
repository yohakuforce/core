// メソッド単位の Mermaid フローチャート生成 (Phase 8-B2)
// ControlFlowNode のツリーを flowchart TD に書き下す。
//
// 表現:
//   Start([methodName])
//   stmt   → "<text>"  四角
//   soql   → /SOQL: <obj>/  パラレログラム
//   dml    → /DML <verb>: <target>/  パラレログラム
//   if     → {"cond"} ダイアモンド + true/false エッジ
//   for    → "for <header>" 角丸 + body と back-edge
//   while  → 同上
//   try    → "try" + catches を分岐として
//   return → ((return <expr>))  楕円 (exit)
//   throw  → ((throw <expr>))   楕円 (exit)
//   End([end])

import type {
  ApexControlFlowNode as ControlFlowNode,
  ApexMethodControlFlow as MethodControlFlow,
} from "../types/graph.js";

type IfNode = Extract<ControlFlowNode, { kind: "if" }>;

export interface MermaidFlowchart {
  readonly mermaid: string;
  readonly details: readonly NodeDetail[];
}

export interface NodeDetail {
  readonly id: string;
  readonly kind: string;
  /** Mermaid 内に出した短縮ラベル (truncate 後) */
  readonly label: string;
  /** 切られていない元テキスト */
  readonly fullText: string;
}

interface RenderContext {
  readonly lines: string[];
  readonly details: NodeDetail[];
  nextId: number;
}

interface RenderResult {
  /** 進入ノード id */
  readonly entryId: string;
  /** 通常終了 (= 後続に流れる) ノード id。null なら return/throw で終端済み */
  readonly exitId: string | null;
}

const END_LABEL = "End";
const LABEL_TRUNCATE = 80;

export function buildMethodFlowchart(flow: MethodControlFlow): MermaidFlowchart {
  const ctx: RenderContext = { lines: ["flowchart TD"], details: [], nextId: 1 };
  const startId = "n_start";
  const endId = "n_end";
  ctx.lines.push(`  ${startId}([${escapeLabel(flow.methodName)}])`);

  const result = renderSequence(flow.nodes, ctx);
  let endUsed = false;
  if (result.entryId === "") {
    // empty body: start → end のみ
    edge(ctx, startId, endId);
    endUsed = true;
  } else {
    edge(ctx, startId, result.entryId);
    if (result.exitId !== null) {
      // 通常の終端パスがある場合のみ end ノードを使う
      edge(ctx, result.exitId, endId);
      endUsed = true;
    }
  }
  // 全パスが return/throw で終端する場合は End ノードを描画しない (orphan 防止)
  if (endUsed) {
    ctx.lines.push(`  ${endId}([${END_LABEL}])`);
  }
  return { mermaid: ctx.lines.join("\n"), details: ctx.details };
}

/** 文の連なりを描画する。最初のノード id と最後のノード id (return/throw なら null) を返す */
function renderSequence(nodes: readonly ControlFlowNode[], ctx: RenderContext): RenderResult {
  if (nodes.length === 0) return { entryId: "", exitId: null };

  let firstId: string | undefined;
  let prevExit: string | null = null;
  for (const node of nodes) {
    const r = renderNode(node, ctx);
    if (r.entryId === "") continue;
    if (firstId === undefined) firstId = r.entryId;
    if (prevExit !== null) edge(ctx, prevExit, r.entryId);
    prevExit = r.exitId;
    if (prevExit === null) break; // return/throw の後は到達不能
  }
  if (firstId === undefined) return { entryId: "", exitId: null };
  return { entryId: firstId, exitId: prevExit };
}

function renderNode(node: ControlFlowNode, ctx: RenderContext): RenderResult {
  switch (node.kind) {
    case "soql": {
      const id = nextId(ctx);
      const obj = node.primaryObject ?? "?";
      const label = `SOQL: ${obj}`;
      ctx.lines.push(`  ${id}[/"${escapeLabel(label)}"/]`);
      pushDetail(ctx, id, "soql", label, node.raw);
      return { entryId: id, exitId: id };
    }
    case "dml": {
      const id = nextId(ctx);
      const path = node.viaDatabaseClass ? "Database" : "DML";
      const label = `${path} ${node.verb}: ${node.target}`;
      ctx.lines.push(`  ${id}[/"${escapeLabel(label)}"/]`);
      pushDetail(ctx, id, "dml", label, label);
      return { entryId: id, exitId: id };
    }
    case "return": {
      const id = nextId(ctx);
      const labelExpr = truncate(node.expression, 30);
      const label = `return ${labelExpr}`;
      ctx.lines.push(`  ${id}(("${escapeLabel(label)}"))`);
      pushDetail(ctx, id, "return", label, `return ${node.expression}`);
      return { entryId: id, exitId: null };
    }
    case "throw": {
      const id = nextId(ctx);
      const labelExpr = truncate(node.expression, 30);
      const label = `throw ${labelExpr}`;
      ctx.lines.push(`  ${id}(("${escapeLabel(label)}"))`);
      pushDetail(ctx, id, "throw", label, `throw ${node.expression}`);
      return { entryId: id, exitId: null };
    }
    case "if":
      return renderIf(node, ctx);
    case "for":
    case "while":
      return renderLoop(node, ctx);
    case "try":
      return renderTry(node, ctx);
    case "stmt": {
      const id = nextId(ctx);
      const label = truncate(node.text, LABEL_TRUNCATE);
      ctx.lines.push(`  ${id}["${escapeLabel(label)}"]`);
      pushDetail(ctx, id, "stmt", label, node.text);
      return { entryId: id, exitId: id };
    }
  }
}

function pushDetail(
  ctx: RenderContext,
  id: string,
  kind: string,
  label: string,
  fullText: string,
): void {
  ctx.details.push({ id, kind, label, fullText: collapseWhitespace(fullText) });
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function renderIf(node: IfNode, ctx: RenderContext): RenderResult {
  const condId = nextId(ctx);
  const condLabel = truncate(node.condition, LABEL_TRUNCATE);
  ctx.lines.push(`  ${condId}{"${escapeLabel(condLabel)}"}`);
  pushDetail(ctx, condId, "if", condLabel, node.condition);
  const thenR = renderSequence(node.thenNodes, ctx);
  const elseR = renderSequence(node.elseNodes, ctx);

  // true 側
  if (thenR.entryId !== "") {
    ctx.lines.push(`  ${condId} -->|true| ${thenR.entryId}`);
  }
  // false 側
  if (elseR.entryId !== "") {
    ctx.lines.push(`  ${condId} -->|false| ${elseR.entryId}`);
  }

  // 合流ノード: どちらか片方でも exit があれば共通の合流点を作る
  const thenExits = thenR.exitId;
  const elseExits = elseR.entryId === "" ? condId : elseR.exitId;
  // else 節が無い場合は cond の false 側が直接合流点になる
  if (thenExits === null && elseExits === null) {
    return { entryId: condId, exitId: null };
  }
  const joinId = nextId(ctx);
  ctx.lines.push(`  ${joinId}(( ))`);
  if (thenExits !== null && thenExits !== "") edge(ctx, thenExits, joinId);
  if (node.elseNodes.length === 0) {
    // false 側の経路 cond → join (ラベル false)
    ctx.lines.push(`  ${condId} -->|false| ${joinId}`);
  } else if (elseExits !== null && elseExits !== "") {
    edge(ctx, elseExits, joinId);
  }
  return { entryId: condId, exitId: joinId };
}

function renderLoop(
  node: { kind: "for" | "while"; header: string; body: readonly ControlFlowNode[] },
  ctx: RenderContext,
): RenderResult {
  const headerId = nextId(ctx);
  const label = node.kind === "for" ? `for ${node.header}` : `while ${node.header}`;
  const shortLabel = truncate(label, LABEL_TRUNCATE);
  ctx.lines.push(`  ${headerId}["${escapeLabel(shortLabel)}"]`);
  pushDetail(ctx, headerId, node.kind, shortLabel, label);
  const bodyR = renderSequence(node.body, ctx);
  if (bodyR.entryId === "") {
    return { entryId: headerId, exitId: headerId };
  }
  edge(ctx, headerId, bodyR.entryId);
  if (bodyR.exitId !== null) {
    // back-edge を点線で
    ctx.lines.push(`  ${bodyR.exitId} -.->|loop| ${headerId}`);
  }
  return { entryId: headerId, exitId: headerId };
}

function renderTry(
  node: {
    kind: "try";
    tryNodes: readonly ControlFlowNode[];
    catches: readonly { exceptionType: string; nodes: readonly ControlFlowNode[] }[];
    finallyNodes: readonly ControlFlowNode[];
  },
  ctx: RenderContext,
): RenderResult {
  const tryId = nextId(ctx);
  ctx.lines.push(`  ${tryId}[["try"]]`);
  pushDetail(ctx, tryId, "try", "try", "try");
  const tryR = renderSequence(node.tryNodes, ctx);
  if (tryR.entryId !== "") edge(ctx, tryId, tryR.entryId);

  // catches 各々を分岐として描画
  const branchExits: string[] = [];
  if (tryR.exitId !== null && tryR.exitId !== "") branchExits.push(tryR.exitId);
  for (const c of node.catches) {
    const cId = nextId(ctx);
    const cLabel = `catch ${c.exceptionType}`;
    ctx.lines.push(`  ${cId}["${escapeLabel(cLabel)}"]`);
    pushDetail(ctx, cId, "catch", cLabel, cLabel);
    ctx.lines.push(`  ${tryId} -.->|throw| ${cId}`);
    const cr = renderSequence(c.nodes, ctx);
    if (cr.entryId !== "") edge(ctx, cId, cr.entryId);
    if (cr.exitId !== null && cr.exitId !== "") branchExits.push(cr.exitId);
    else if (cr.entryId === "") branchExits.push(cId);
  }

  // finally
  let lastExit: string | null = null;
  if (node.finallyNodes.length > 0) {
    const fId = nextId(ctx);
    ctx.lines.push(`  ${fId}[["finally"]]`);
    pushDetail(ctx, fId, "finally", "finally", "finally");
    for (const ex of branchExits) edge(ctx, ex, fId);
    const fr = renderSequence(node.finallyNodes, ctx);
    if (fr.entryId !== "") edge(ctx, fId, fr.entryId);
    lastExit = fr.exitId ?? fId;
  } else if (branchExits.length > 0) {
    // 各分岐の出口は呼び出し側に複数渡せないので合流点を作る
    const joinId = nextId(ctx);
    ctx.lines.push(`  ${joinId}(( ))`);
    for (const ex of branchExits) edge(ctx, ex, joinId);
    lastExit = joinId;
  }
  return { entryId: tryId, exitId: lastExit };
}

function nextId(ctx: RenderContext): string {
  const id = `n${ctx.nextId}`;
  ctx.nextId += 1;
  return id;
}

function edge(ctx: RenderContext, from: string, to: string): void {
  ctx.lines.push(`  ${from} --> ${to}`);
}

function escapeLabel(s: string): string {
  // Mermaid のラベルは引用符内に置くので、" だけエスケープすれば十分
  // ただし中括弧内は別。
  return s.replace(/"/g, "&quot;").replace(/\n/g, " ");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
