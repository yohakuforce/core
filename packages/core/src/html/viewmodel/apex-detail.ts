// ----------------------------------------------------------------------------
// Apex / Trigger 「処理詳細」セクション (詳細設計書向け)
//
// 既存の決定的アセットを HTML 設計書へ昇格させる:
//   1. メソッド統合表  ... buildMethodSummaryTable (SOQL/DML/分岐/ループ/呼出件数)
//   2. 処理ステップ概略 ... controlFlows を「入力→処理→分岐→計算→戻り値」の
//      日本語アウトラインへ平坦化 (Mermaid 図の文章版)
//
// LLM 解説 (各ステップの業務的意味) は Phase C で editable ブロックとして重ねる。
// 本モジュールは決定的部分のみを担う。
// ----------------------------------------------------------------------------

import type { buildMethodSummaryTable } from "../../render/method-summary-table.js";
import type { ApexBodyInfo, ApexControlFlowNode } from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import type { SectionViewModel } from "../types.js";

interface ProcessingDetailInput {
  readonly methodSummaryTable: ReturnType<typeof buildMethodSummaryTable>;
  readonly body: ApexBodyInfo | undefined;
  /** 前回 build / html-write で埋まった LLM 解説 (あれば再掲して preserve) */
  readonly preservedNarrative?: string;
}

const MAX_STMT_LEN = 160;

// LLM 解説ブロックの id (html-write / preserve-blocks が参照)
const NARRATIVE_BLOCK_ID = "processing-detail-narrative";
const PLACEHOLDER_TEXT = "このセクションは LLM で生成されます";
const NARRATIVE_PROMPT =
  "各メソッドが業務上何を達成するか、扱うデータ・主要な分岐条件・計算・戻り値を、下の決定的スケルトンを根拠に 1 メソッド数文で解説してください。事実はスケルトンに従い、推測は避けてください。";

/**
 * 決定的スケルトン (件数表 + 処理ステップ) の手前に、LLM 解説用の編集可能ブロックを
 * 埋め込む。マーカーは html-write / preserve-blocks がファイル全体走査で拾うため、
 * セクション全体ではなくこの領域だけが AI 編集対象になる。
 */
function narrativeBlock(preserved: string | undefined): string {
  const inner =
    preserved !== undefined && preserved.trim() !== ""
      ? `\n        ${preserved}\n        `
      : `
    <div class="llm-placeholder">
      <p class="muted">（${PLACEHOLDER_TEXT}）</p>
      <p class="hint">${escapeHtml(NARRATIVE_PROMPT)}</p>
    </div>`;
  return `<!-- yohaku:block kind="ai_managed" id="${NARRATIVE_BLOCK_ID}" start -->${inner}<!-- yohaku:block kind="ai_managed" id="${NARRATIVE_BLOCK_ID}" end -->`;
}

export function buildProcessingDetailSection(input: ProcessingDetailInput): SectionViewModel {
  const { methodSummaryTable, body, preservedNarrative } = input;
  if (methodSummaryTable.length === 0) {
    return {
      id: "processing-detail",
      title: "処理詳細",
      htmlContent: `${narrativeBlock(preservedNarrative)}
    <p class="muted">処理詳細を導出できるメソッドがありません (interface / 抽象クラス、または body 解析対象外)。</p>`,
    };
  }

  const controlFlows = body?.controlFlows ?? [];
  const flowByName = new Map(controlFlows.map((f) => [f.methodName, f] as const));

  return {
    id: "processing-detail",
    title: "処理詳細",
    htmlContent: `
    <p class="muted">各メソッドの処理内容・データ操作・分岐・戻り値を詳細設計の観点で展開します。冒頭は処理の業務的な解説 (AI)、続いて件数表と処理ステップ (決定的) を示します。</p>
    ${narrativeBlock(preservedNarrative)}
    ${renderSummaryTable(methodSummaryTable)}
    <h3>メソッド別 処理ステップ</h3>
    ${methodSummaryTable
      .map((row) => {
        const flow = flowByName.get(row.methodName);
        return renderMethodDetail(row, flow?.nodes ?? []);
      })
      .join("\n    ")}`,
  };
}

function renderSummaryTable(rows: ReturnType<typeof buildMethodSummaryTable>): string {
  return `
    <table class="data-table processing-summary">
      <thead><tr>
        <th>メソッド</th><th>可視性</th><th>戻り値</th>
        <th>SOQL</th><th>DML</th><th>分岐</th><th>ループ</th><th>try</th>
        <th>内部呼出</th><th>外部呼出</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td><code>${escapeHtml(r.methodName)}</code></td>
          <td>${escapeHtml(r.visibility)}${r.isStatic ? " static" : ""}</td>
          <td><code>${escapeHtml(r.returnType)}</code></td>
          <td class="num${r.soqlCount > 0 ? " hot" : ""}">${r.soqlCount}</td>
          <td class="num${r.dmlCount > 0 ? " hot" : ""}">${r.dmlCount}</td>
          <td class="num">${r.branchCount}</td>
          <td class="num">${r.loopCount}</td>
          <td class="num">${r.tryCount}</td>
          <td>${callList(r.intraClassCalls)}</td>
          <td>${callList(r.externalCalls)}</td>
        </tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>`;
}

function callList(calls: readonly string[]): string {
  if (calls.length === 0) return "—";
  return calls.map((c) => `<code>${escapeHtml(c)}</code>`).join(", ");
}

function renderMethodDetail(
  row: ReturnType<typeof buildMethodSummaryTable>[number],
  nodes: readonly ApexControlFlowNode[],
): string {
  const signature = `${row.returnType} ${row.methodName}(${row.parameters})`;
  const input =
    row.parameters.trim() === ""
      ? `<li><span class="step-kind step-in">入力</span> なし</li>`
      : `<li><span class="step-kind step-in">入力</span> <code>${escapeHtml(row.parameters)}</code></li>`;
  const steps = nodes.length === 0 ? "" : renderNodes(nodes);
  return `<details class="method-detail">
      <summary><code>${escapeHtml(signature)}</code></summary>
      <ul class="step-list">
        ${input}
        ${steps}
      </ul>
    </details>`;
}

function renderNodes(nodes: readonly ApexControlFlowNode[]): string {
  return nodes.map(renderNode).join("\n        ");
}

function renderNode(node: ApexControlFlowNode): string {
  switch (node.kind) {
    case "soql":
      return `<li><span class="step-kind step-soql">SOQL</span> ${
        node.primaryObject !== null
          ? `<code>${escapeHtml(node.primaryObject)}</code> を取得`
          : "データ取得"
      }${rawCode(node.raw)}</li>`;
    case "dml":
      return `<li><span class="step-kind step-dml">DML</span> <code>${escapeHtml(node.verb)}</code> → <code>${escapeHtml(node.target)}</code>${
        node.viaDatabaseClass ? ' <span class="muted">(Database クラス経由)</span>' : ""
      }</li>`;
    case "if":
      return `<li><span class="step-kind step-if">分岐</span> もし <code>${escapeHtml(truncate(node.condition))}</code> なら
        <ul class="step-list">${renderNodes(node.thenNodes)}</ul>${
          node.elseNodes.length > 0
            ? `<div class="step-else">それ以外:</div><ul class="step-list">${renderNodes(node.elseNodes)}</ul>`
            : ""
        }</li>`;
    case "for":
    case "while":
      return `<li><span class="step-kind step-loop">繰り返し</span> <code>${escapeHtml(truncate(node.header))}</code>
        <ul class="step-list">${renderNodes(node.body)}</ul></li>`;
    case "try":
      return `<li><span class="step-kind step-try">例外処理</span> try
        <ul class="step-list">${renderNodes(node.tryNodes)}</ul>${node.catches
          .map(
            (c) =>
              `<div class="step-else">catch <code>${escapeHtml(c.exceptionType)}</code>:</div><ul class="step-list">${renderNodes(c.nodes)}</ul>`,
          )
          .join("")}${
          node.finallyNodes.length > 0
            ? `<div class="step-else">finally:</div><ul class="step-list">${renderNodes(node.finallyNodes)}</ul>`
            : ""
        }</li>`;
    case "return":
      return `<li><span class="step-kind step-return">戻り値</span> ${
        node.expression.trim() === ""
          ? "(なし)"
          : `<code>${escapeHtml(truncate(node.expression))}</code>`
      }</li>`;
    case "throw":
      return `<li><span class="step-kind step-throw">例外送出</span> <code>${escapeHtml(truncate(node.expression))}</code></li>`;
    case "stmt":
      return `<li><span class="step-kind step-stmt">処理</span> <code>${escapeHtml(truncate(node.text))}</code></li>`;
  }
}

function rawCode(raw: string): string {
  const t = truncate(raw.replace(/\s+/g, " ").trim());
  if (t === "") return "";
  return ` <code class="step-raw">${escapeHtml(t)}</code>`;
}

function truncate(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > MAX_STMT_LEN ? `${t.slice(0, MAX_STMT_LEN)}…` : t;
}
