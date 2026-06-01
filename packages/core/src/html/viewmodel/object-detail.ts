// ----------------------------------------------------------------------------
// Object (SObject) 「項目値の割り当て」「計算項目・入力規則」セクション (詳細設計書向け)
//
// 設計方針 (抜け漏れ・記載ミスを許さないため):
//   - 決定的に「値の決まり方」が確定する項目 (数式/参照/選択リスト/初期値/集計) は
//     決定的テーブルで完全に記載する。曖昧な「—」は出さない。
//   - それ以外 (入力 or 処理で設定) は決定的には field 単位で取り切れないため、
//     ai_managed ブロックに「残りの項目リスト(=完全性保証のスケルトン)」と
//     「このオブジェクトに触れる処理一覧(=LLM が原文を辿る手掛かり)」を与え、
//     LLM が 入力/処理設定 を判定し設定元・値・条件を充填する。
//   - calculation-rules には LLM レビュー用ブロックを設け、決定的出力 (数式項目/
//     入力規則) の抜け漏れ・誤りを LLM が検証・追記できるようにする。
// ----------------------------------------------------------------------------

import type { Field, KnowledgeGraph, SObject, ValidationRule } from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import { formulaToHtml, rawFormulaDetails } from "../formula-html.js";
import type { SectionViewModel } from "../types.js";
import { aiManagedBlock } from "./ai-block.js";

type GetPreserved = (id: string) => string | undefined;

function hasText(s: string | undefined): s is string {
  return s !== undefined && s.trim() !== "";
}

// ---------- 値の決まり方の決定的判定 ----------

interface ValueOrigin {
  readonly label: string;
  readonly detail: string;
}

/** 決定的に確定する「値の決まり方」を返す。確定できなければ null (= 入力/処理、LLM 判定対象) */
function deterministicOrigin(f: Field): ValueOrigin | null {
  if (hasText(f.formula)) {
    return { label: "数式で自動計算", detail: "下の「計算項目・入力規則」を参照" };
  }
  if (f.referenceTo !== undefined && f.referenceTo.length > 0) {
    const targets = f.referenceTo.map((r) => `<code>${escapeHtml(r)}</code>`).join(", ");
    return { label: "参照 (lookup)", detail: `参照先: ${targets}` };
  }
  if (f.picklistValues !== undefined && f.picklistValues.length > 0) {
    const vals = f.picklistValues.map((v) => `<code>${escapeHtml(v)}</code>`).join(" / ");
    return { label: `選択リスト (${f.picklistValues.length}値)`, detail: vals };
  }
  if (hasText(f.defaultValue)) {
    return { label: "初期値あり", detail: `<code>${escapeHtml(f.defaultValue.trim())}</code>` };
  }
  if (/summary|rollup/i.test(f.type)) {
    return { label: "積み上げ集計 (自動)", detail: "子レコードからの集計値" };
  }
  return null;
}

function classifiedRow(f: Field, origin: ValueOrigin): string {
  return `<tr>
    <td><code>${escapeHtml(f.fullyQualifiedName)}</code><br /><span class="muted">${escapeHtml(f.label ?? "—")}</span></td>
    <td><code>${escapeHtml(f.type)}</code></td>
    <td>${f.required === true ? "✓" : ""}</td>
    <td><span class="value-origin">${escapeHtml(origin.label)}</span></td>
    <td>${origin.detail}</td>
  </tr>`;
}

/** 残項目 (入力/処理) の完全性保証スケルトン: LLM 未充填でも全項目が見える */
function residualSkeleton(residual: readonly Field[]): string {
  return `
      <table class="data-table">
        <thead><tr><th>項目</th><th>型</th><th>必須</th><th>区分 (入力/処理)</th><th>設定元・値・条件</th></tr></thead>
        <tbody>
          ${residual
            .map(
              (f) => `<tr>
            <td><code>${escapeHtml(f.fullyQualifiedName)}</code><br /><span class="muted">${escapeHtml(f.label ?? "—")}</span></td>
            <td><code>${escapeHtml(f.type)}</code></td>
            <td>${f.required === true ? "✓" : ""}</td>
            <td class="muted">要確認</td>
            <td class="muted">要確認</td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>`;
}

export function buildFieldAssignmentSection(
  obj: SObject,
  fields: readonly Field[],
  graph: KnowledgeGraph,
  getPreserved: GetPreserved,
): SectionViewModel {
  if (fields.length === 0) {
    return {
      id: "field-assignment",
      title: "項目値の割り当て",
      htmlContent: `<p class="muted">項目は検出されませんでした。</p>`,
    };
  }

  const classified: Array<{ f: Field; origin: ValueOrigin }> = [];
  const residual: Field[] = [];
  for (const f of fields) {
    const origin = deterministicOrigin(f);
    if (origin === null) residual.push(f);
    else classified.push({ f, origin });
  }

  const classifiedTable =
    classified.length === 0
      ? ""
      : `
    <h3>値の決まり方が確定する項目 (${classified.length})</h3>
    <table class="data-table field-assignment">
      <thead><tr><th>項目</th><th>型</th><th>必須</th><th>値の決まり方</th><th>詳細</th></tr></thead>
      <tbody>
        ${classified.map(({ f, origin }) => classifiedRow(f, origin)).join("\n        ")}
      </tbody>
    </table>`;

  const residualBlock =
    residual.length === 0
      ? `<p class="muted">入力/処理で設定される項目はありません (全項目が決定的に分類済)。</p>`
      : `<div class="ai-detail">
      <div class="ai-detail-head"><span class="ai-tag">AI</span> 入力/処理の判定・設定詳細</div>
      ${aiManagedBlock({
        id: "field-assignment-detail",
        preserved: getPreserved("field-assignment-detail"),
        heading: "入力・処理による設定",
        prompt: `${obj.fullyQualifiedName} の下記「要確認」項目について、ユーザー入力か処理による設定かを判定し、処理設定なら 設定元(クラス/トリガ/フロー) / 設定値(式) / 設定条件 / 操作 を原文から記述してください。全項目を漏れなく分類すること。`,
        skeleton: `
      <p class="muted">下記は決定的に分類できなかった項目です。各項目が「ユーザー入力」か「処理で設定」かを AI が原文から判定・追記します。</p>
      <p class="muted">このオブジェクトに触れる処理: ${touchedByList(obj, graph)}</p>
      ${residualSkeleton(residual)}`,
      })}
    </div>`;

  return {
    id: "field-assignment",
    title: "項目値の割り当て",
    htmlContent: `
    <p class="muted">各項目の値がどのように決まるか（数式 / 参照 / 選択リスト / 初期値 / 集計 / 入力 / 処理設定）を記載します。</p>
    ${classifiedTable}
    <h3>入力・処理で設定される項目 (${residual.length})</h3>
    ${residualBlock}`,
  };
}

/** このオブジェクトに触れる処理 (LLM が原文を辿る手掛かり) */
function touchedByList(obj: SObject, graph: KnowledgeGraph): string {
  const name = obj.fullyQualifiedName;
  const apex = graph.apexClasses
    .filter(
      (c) =>
        (c.body?.soqlQueries ?? []).some((q) => q.primaryObject === name) ||
        (c.body?.controlFlows ?? []).some((fl) =>
          JSON.stringify(fl.nodes).includes(`new ${name}(`),
        ),
    )
    .map((c) => c.fullyQualifiedName);
  const triggers = graph.apexTriggers
    .filter((t) => t.object === name)
    .map((t) => t.fullyQualifiedName);
  const flows = graph.flows
    .filter((f) => f.triggeringObject === name || (f.body?.recordObjects ?? []).includes(name))
    .map((f) => f.fullyQualifiedName);
  const all = [...apex, ...triggers, ...flows];
  if (all.length === 0) return "（検出なし）";
  return all.map((n) => `<code>${escapeHtml(n)}</code>`).join(", ");
}

// ---------- 計算項目・入力規則 ----------

function formulaFieldCard(f: Field): string {
  const formula = f.formula ?? "";
  return `<div class="calc-card">
      <h4><code>${escapeHtml(f.fullyQualifiedName)}</code> ${escapeHtml(f.label ?? "")} <span class="badge">数式項目</span></h4>
      <div class="calc-logic">
        <div class="calc-label">算出ロジック</div>
        ${formulaToHtml(formula)}
      </div>
      ${rawFormulaDetails(formula)}
    </div>`;
}

function validationRuleCard(v: ValidationRule): string {
  const status = v.active
    ? `<span class="badge badge-on">有効</span>`
    : `<span class="badge badge-off">無効</span>`;
  const condition = hasText(v.errorConditionFormula)
    ? formulaToHtml(v.errorConditionFormula)
    : `<p class="muted">（条件式なし）</p>`;
  return `<div class="calc-card calc-vr">
      <h4><code>${escapeHtml(v.fullyQualifiedName)}</code> <span class="badge badge-vr">入力規則</span> ${status}</h4>
      ${hasText(v.errorMessage) ? `<p class="vr-message"><strong>エラーメッセージ:</strong> ${escapeHtml(v.errorMessage)}</p>` : ""}
      ${hasText(v.errorDisplayField) ? `<p class="muted">表示項目: <code>${escapeHtml(v.errorDisplayField)}</code></p>` : ""}
      <div class="calc-logic">
        <div class="calc-label">エラー発生条件 (この条件を満たすと保存不可)</div>
        ${condition}
      </div>
      ${hasText(v.errorConditionFormula) ? rawFormulaDetails(v.errorConditionFormula) : ""}
    </div>`;
}

export function buildCalculationRulesSection(
  obj: SObject,
  fields: readonly Field[],
  graph: KnowledgeGraph,
  getPreserved: GetPreserved,
): SectionViewModel {
  const formulaFields = fields.filter((f) => hasText(f.formula));
  const rules = graph.validationRules.filter((v) => v.object === obj.fullyQualifiedName);

  const reviewBlock = aiManagedBlock({
    id: "calculation-review",
    preserved: getPreserved("calculation-review"),
    heading: "AI 確認メモ",
    prompt: `上記の数式項目 (${formulaFields.length}) と入力規則 (${rules.length}) を ${obj.fullyQualifiedName} の原文と照合し、抜け漏れ・記載ミス・自然語化の誤りを確認してください。問題があれば該当箇所と修正案を、なければ「確認済: 問題なし」と明記してください。`,
  });

  if (formulaFields.length === 0 && rules.length === 0) {
    return {
      id: "calculation-rules",
      title: "計算項目・入力規則",
      htmlContent: `
    <p class="muted">数式項目・入力規則は検出されませんでした。</p>
    <div class="ai-detail ai-review">
      <div class="ai-detail-head"><span class="ai-tag">AI</span> 確認メモ</div>
      ${reviewBlock}
    </div>`,
    };
  }

  const formulaBlock =
    formulaFields.length > 0
      ? `<h3>数式項目 (${formulaFields.length})</h3>
    ${formulaFields.map(formulaFieldCard).join("\n    ")}`
      : "";
  const ruleBlock =
    rules.length > 0
      ? `<h3>入力規則 (${rules.length})</h3>
    ${rules.map(validationRuleCard).join("\n    ")}`
      : "";

  return {
    id: "calculation-rules",
    title: "計算項目・入力規則",
    htmlContent: `
    <p class="muted">数式項目の計算式と入力規則の条件を、自然語の算出ロジックに展開します（原文は折りたたみで併記）。</p>
    ${formulaBlock}
    ${ruleBlock}
    <div class="ai-detail ai-review">
      <div class="ai-detail-head"><span class="ai-tag">AI</span> 抜け漏れ・誤り確認</div>
      ${reviewBlock}
    </div>`,
  };
}
