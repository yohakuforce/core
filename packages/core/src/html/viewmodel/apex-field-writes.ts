// ----------------------------------------------------------------------------
// Apex / Trigger 「項目値の割り当て」セクション (詳細設計書向け)
//
// 1 クラスが複数オブジェクトへ DML / 項目設定を行うケースに対応し、
// 触れているオブジェクトごとに「タブ切替」で項目割り当てを確認できるようにする。
//
// タブ構造 (どのオブジェクトに触れているか) は決定的に導出する:
//   - SOQL の primaryObject
//   - 本体テキスト中の `new <SObject>(...)` 生成パターン
//   - (トリガの場合) 対象オブジェクト
// 各タブの中身 (項目 ← 値 / 条件 / insert/update) は決定的には取り切れないため、
// ai_managed ブロックとして LLM が原文から「掴み取って」充填する。
// ----------------------------------------------------------------------------

import type { ApexBodyInfo, ApexControlFlowNode } from "../../types/graph.js";
import { renderRefInline } from "../display.js";
import { escapeAttr, escapeHtml } from "../escape.js";
import type { SectionViewModel } from "../types.js";
import { aiManagedBlock } from "./ai-block.js";

const MAX_TABS = 8; // CSS radio タブの対応上限

export interface FieldWritesInput {
  readonly componentName: string;
  readonly body: ApexBodyInfo | undefined;
  /** トリガの対象オブジェクト (常に書き込み対象) */
  readonly triggerObject?: string;
  /** graph 上に実在する SObject 名の集合 (new 判定の照合用) */
  readonly knownObjects: ReadonlySet<string>;
  /** ブロック id → preserve 済み内容 を引く関数 */
  readonly getPreserved: (id: string) => string | undefined;
  /** オブジェクト API 名 → 日本語ラベル (タブ/見出しの主表示用、任意) */
  readonly resolveObjectLabel?: (apiName: string) => string | undefined;
}

export function buildFieldWritesSection(input: FieldWritesInput): SectionViewModel {
  const objects = touchedObjects(input);
  if (objects.length === 0) {
    return {
      id: "field-writes",
      title: "項目値の割り当て",
      htmlContent: `<p class="muted">このクラスはオブジェクトへの項目設定 (DML / new SObject) を行いません。</p>`,
    };
  }

  const tabs = objects.slice(0, MAX_TABS);
  const overflowNote =
    objects.length > MAX_TABS
      ? `<p class="muted">※ タブ表示は先頭 ${MAX_TABS} オブジェクトまで (検出 ${objects.length})。</p>`
      : "";

  const inputs = tabs
    .map(
      (o, i) =>
        `<input type="radio" name="fw-tabs" id="fw-${escapeAttr(o)}"${i === 0 ? " checked" : ""} />`,
    )
    .join("\n      ");
  const labels = tabs
    .map(
      (o) =>
        `<label for="fw-${escapeAttr(o)}">${renderRefInline(input.resolveObjectLabel?.(o), o)}</label>`,
    )
    .join("\n        ");
  const panels = tabs
    .map((o) => renderPanel(o, input.getPreserved, input.resolveObjectLabel?.(o)))
    .join("\n      ");

  return {
    id: "field-writes",
    title: "項目値の割り当て",
    htmlContent: `
    <p class="muted">このクラスが触れるオブジェクトごとに、設定する項目・値・条件を確認できます (タブ切替)。各タブの内訳は原文から AI が抽出します。</p>
    ${overflowNote}
    <div class="obj-tabs">
      ${inputs}
      <div class="obj-tablist">
        ${labels}
      </div>
      ${panels}
    </div>`,
  };
}

function renderPanel(
  object: string,
  getPreserved: (id: string) => string | undefined,
  objectLabel?: string,
): string {
  const id = `field-writes:${object}`;
  const block = aiManagedBlock({
    id,
    preserved: getPreserved(id),
    heading: object,
    prompt: `${object} について、このクラスが設定する項目を原文から抽出し、表で記述してください: 項目(API名) / 設定値(式) / 設定条件 / 操作(insert|update)。設定がなく参照のみなら「参照のみ・項目設定なし」と明記。推測は避け、原文の代入のみを記載してください。`,
  });
  return `<section class="obj-tabpanel">
        <h4>${renderRefInline(objectLabel, object)} への項目設定</h4>
        ${block}
      </section>`;
}

// ---------- 触れているオブジェクトの決定的導出 ----------

function touchedObjects(input: FieldWritesInput): readonly string[] {
  const found = new Set<string>();
  if (input.triggerObject !== undefined && input.triggerObject !== "") {
    found.add(input.triggerObject);
  }
  const body = input.body;
  if (body !== undefined) {
    for (const q of body.soqlQueries) {
      if (q.primaryObject !== null && input.knownObjects.has(q.primaryObject)) {
        found.add(q.primaryObject);
      }
    }
    for (const name of newSObjectTypes(collectText(body.controlFlows ?? []), input.knownObjects)) {
      found.add(name);
    }
  }
  return [...found].toSorted((a, b) => a.localeCompare(b));
}

const NEW_PATTERN = /new\s+([A-Za-z_][\w]*)\s*\(/g;

function newSObjectTypes(text: string, known: ReadonlySet<string>): readonly string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null = NEW_PATTERN.exec(text);
  while (m !== null) {
    const name = m[1];
    if (name !== undefined && known.has(name)) out.push(name);
    m = NEW_PATTERN.exec(text);
  }
  return out;
}

function collectText(flows: readonly { readonly nodes: readonly ApexControlFlowNode[] }[]): string {
  const parts: string[] = [];
  const visit = (nodes: readonly ApexControlFlowNode[]): void => {
    for (const n of nodes) {
      switch (n.kind) {
        case "stmt":
          parts.push(n.text);
          break;
        case "return":
        case "throw":
          parts.push(n.expression);
          break;
        case "if":
          parts.push(n.condition);
          visit(n.thenNodes);
          visit(n.elseNodes);
          break;
        case "for":
        case "while":
          parts.push(n.header);
          visit(n.body);
          break;
        case "try":
          visit(n.tryNodes);
          for (const c of n.catches) visit(c.nodes);
          visit(n.finallyNodes);
          break;
        default:
          break;
      }
    }
  };
  for (const f of flows) visit(f.nodes);
  return parts.join("\n");
}
