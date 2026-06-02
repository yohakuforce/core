// ----------------------------------------------------------------------------
// SObject に紐づく周辺メタデータのセクション (詳細設計書向け / Phase 1)
//
// 1 オブジェクトに従属する設計情報 (レコードタイプ / ページレイアウト /
// 承認プロセス / 共有ルール / アクセス権限) を SObject ページの章として描画する。
// 新コンポーネントタイプを増やさず、対象オブジェクト 1 ページで完結させる。
// すべて決定的 (グラフ由来)。
// ----------------------------------------------------------------------------

import type {
  ApprovalProcess,
  KnowledgeGraph,
  Layout,
  PermissionSetBodyInfo,
  RecordType,
  SObject,
  SharingRule,
} from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import type { SectionViewModel } from "../types.js";

const check = (b: boolean): string => (b ? "✓" : "");

function emptyNote(id: SectionViewModel["id"], title: string, note: string): SectionViewModel {
  return { id, title, htmlContent: `<p class="muted">${escapeHtml(note)}</p>` };
}

// ---------- レコードタイプ ----------

export function buildRecordTypesSection(obj: SObject, graph: KnowledgeGraph): SectionViewModel {
  const rts = graph.recordTypes.filter((r) => r.object === obj.fullyQualifiedName);
  if (rts.length === 0) {
    return emptyNote("record-types", "レコードタイプ", "レコードタイプは定義されていません。");
  }
  return {
    id: "record-types",
    title: "レコードタイプ",
    htmlContent: `
    <p class="muted">業務区分ごとのレコードタイプ (${rts.length})。区分によって画面・選択リスト・処理が変わる起点です。</p>
    <div class="rt-cards">
      ${rts.map(recordTypeCard).join("\n      ")}
    </div>
    <details class="layout-block"><summary>一覧 (テーブル表示)</summary>
    <table class="data-table">
      <thead><tr><th>API 名</th><th>ラベル</th><th>有効</th><th>説明</th></tr></thead>
      <tbody>
        ${rts.map(recordTypeRow).join("\n        ")}
      </tbody>
    </table></details>`,
  };
}

function recordTypeCard(r: RecordType): string {
  const dev = r.fullyQualifiedName.split(".").at(-1) ?? r.fullyQualifiedName;
  const badge = r.active
    ? `<span class="badge badge-on">有効</span>`
    : `<span class="badge badge-off">無効</span>`;
  return `<div class="rt-card${r.active ? "" : " rt-inactive"}">
      <div class="rt-card-head"><strong>${escapeHtml(r.label ?? dev)}</strong> ${badge}</div>
      <div class="muted"><code>${escapeHtml(dev)}</code></div>
      ${r.description ? `<div class="rt-card-desc">${escapeHtml(r.description)}</div>` : ""}
    </div>`;
}

function recordTypeRow(r: RecordType): string {
  return `<tr>
    <td><code>${escapeHtml(r.fullyQualifiedName)}</code></td>
    <td>${escapeHtml(r.label ?? "—")}</td>
    <td>${r.active ? "✓" : "無効"}</td>
    <td>${escapeHtml(r.description ?? "—")}</td>
  </tr>`;
}

// ---------- ページレイアウト ----------

export function buildLayoutsSection(obj: SObject, graph: KnowledgeGraph): SectionViewModel {
  const layouts = graph.layouts.filter((l) => l.object === obj.fullyQualifiedName);
  if (layouts.length === 0) {
    return emptyNote(
      "page-layouts",
      "ページレイアウト",
      "ページレイアウトは検出されませんでした。",
    );
  }
  return {
    id: "page-layouts",
    title: "ページレイアウト",
    htmlContent: `
    <p class="muted">画面の項目配置 (${layouts.length})。配置を視覚的に再現し、色で 必須 / 参照のみ / 編集可 を区別します。</p>
    <div class="layout-legend">
      <span class="lo-field lo-required">必須</span>
      <span class="lo-field lo-edit">編集可</span>
      <span class="lo-field lo-readonly">参照のみ</span>
    </div>
    ${layouts.map(layoutBlock).join("\n    ")}`,
  };
}

function behaviorClass(behavior: string): string {
  switch (behavior) {
    case "Required":
      return "lo-required";
    case "Readonly":
      return "lo-readonly";
    default:
      return "lo-edit";
  }
}

function layoutFieldChip(it: { field: string; behavior: string }): string {
  const req = it.behavior === "Required" ? '<span class="lo-req-mark">*</span>' : "";
  return `<div class="lo-field ${behaviorClass(it.behavior)}">${req}<code>${escapeHtml(it.field)}</code></div>`;
}

function layoutSectionMock(s: Layout["sections"][number]): string {
  // 列番号 (1-based) ごとにグルーピングして横並び再現
  const maxCol = s.items.reduce((m, it) => Math.max(m, it.column), 1);
  const cols: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    const items = s.items.filter((it) => it.column === c);
    cols.push(
      `<div class="lo-col">${items.length === 0 ? '<span class="muted">（空）</span>' : items.map(layoutFieldChip).join("")}</div>`,
    );
  }
  return `<div class="lo-section">
        <div class="lo-section-label">${escapeHtml(s.label || "(無題セクション)")}</div>
        <div class="lo-cols" style="grid-template-columns:repeat(${maxCol},1fr);">${cols.join("")}</div>
      </div>`;
}

function layoutBlock(l: Layout): string {
  const sections =
    l.sections.length === 0
      ? `<p class="muted">セクションは検出されませんでした。</p>`
      : l.sections.map(layoutSectionMock).join("\n      ");
  const related =
    l.relatedLists.length > 0
      ? `<div class="lo-box"><div class="lo-box-label">関連リスト (${l.relatedLists.length})</div>
        <div class="lo-chips">${l.relatedLists.map((r) => `<span class="lo-chip lo-related"><code>${escapeHtml(r.relatedList)}</code></span>`).join("")}</div></div>`
      : "";
  const quick =
    l.quickActions.length > 0
      ? `<div class="lo-box"><div class="lo-box-label">アクションボタン (${l.quickActions.length})</div>
        <div class="lo-chips">${l.quickActions.map((q) => `<span class="lo-chip lo-action"><code>${escapeHtml(q)}</code></span>`).join("")}</div></div>`
      : "";
  return `<details class="layout-block" open><summary><code>${escapeHtml(l.layoutName)}</code></summary>
      <div class="layout-mock">
        ${sections}
      </div>
      ${related}
      ${quick}
    </details>`;
}

// ---------- 承認プロセス ----------

const IF_NOT_MET: Record<string, string> = {
  ApproveRecord: "自動承認",
  RejectRequest: "自動却下",
  GoToNextStep: "次ステップへ",
  Unknown: "未定義",
};

export function buildApprovalSection(obj: SObject, graph: KnowledgeGraph): SectionViewModel {
  const aps = graph.approvalProcesses.filter((a) => a.object === obj.fullyQualifiedName);
  if (aps.length === 0) {
    return emptyNote("approval-process", "承認プロセス", "承認プロセスは定義されていません。");
  }
  return {
    id: "approval-process",
    title: "承認プロセス",
    htmlContent: `
    <p class="muted">段階承認の設計 (${aps.length})。申請条件・承認者・各段階の挙動を示します。</p>
    ${aps.map(approvalBlock).join("\n    ")}`,
  };
}

function criteriaTable(
  items: readonly { field: string; operation: string; value: string }[],
): string {
  if (items.length === 0) return `<p class="muted">（条件なし）</p>`;
  return `<table class="data-table"><thead><tr><th>項目</th><th>演算子</th><th>値</th></tr></thead><tbody>
      ${items
        .map(
          (c) =>
            `<tr><td><code>${escapeHtml(c.field)}</code></td><td>${escapeHtml(c.operation)}</td><td>${escapeHtml(c.value)}</td></tr>`,
        )
        .join("\n      ")}
    </tbody></table>`;
}

function approvalBlock(ap: ApprovalProcess): string {
  const status = ap.active
    ? `<span class="badge badge-on">有効</span>`
    : `<span class="badge badge-off">無効</span>`;
  const steps = ap.steps
    .map(
      (s, i) => `<div class="approval-step">
        <h5>Step ${i + 1}: <code>${escapeHtml(s.name)}</code>${s.label ? ` — ${escapeHtml(s.label)}` : ""}</h5>
        <ul>
          <li>承認者: <code>${escapeHtml(s.approverType)}</code>${s.approverDetail ? ` (${escapeHtml(s.approverDetail)})` : ""}</li>
          <li>代理承認: ${s.allowDelegate ? "許可" : "不可"}</li>
          <li>条件不一致時: ${escapeHtml(IF_NOT_MET[s.ifCriteriaNotMet] ?? s.ifCriteriaNotMet)}</li>
        </ul>
        ${s.entryCriteria.length > 0 ? `<p class="muted">Step エントリ条件:</p>${criteriaTable(s.entryCriteria)}` : ""}
      </div>`,
    )
    .join("\n      ");
  const actions = [
    ["申請時", ap.initialSubmissionActions],
    ["最終承認時", ap.finalApprovalActions],
    ["最終却下時", ap.finalRejectionActions],
  ] as const;
  const actionList = actions
    .filter(([, a]) => a.length > 0)
    .map(
      ([label, a]) =>
        `<li>${label}: ${a.map((x) => `<code>${escapeHtml(x.name)}</code> (${escapeHtml(x.type)})`).join(", ")}</li>`,
    )
    .join("");
  return `<div class="calc-card">
      <h4><code>${escapeHtml(ap.fullyQualifiedName)}</code> ${status}${ap.recordEditability ? ` <span class="muted">編集: ${escapeHtml(ap.recordEditability)}</span>` : ""}</h4>
      <div class="calc-label">申請 (エントリ) 条件</div>
      ${criteriaTable(ap.entryCriteria)}
      <div class="calc-label">承認ステップ (${ap.steps.length})</div>
      ${steps || `<p class="muted">（ステップなし）</p>`}
      ${actionList ? `<div class="calc-label">アクション</div><ul>${actionList}</ul>` : ""}
    </div>`;
}

// ---------- 共有ルール ----------

export function buildSharingSection(obj: SObject, graph: KnowledgeGraph): SectionViewModel {
  const srs = graph.sharingRules.filter((s) => s.object === obj.fullyQualifiedName);
  if (srs.length === 0) {
    return emptyNote("sharing-rules", "共有ルール", "共有ルールは定義されていません。");
  }
  return {
    id: "sharing-rules",
    title: "共有ルール",
    htmlContent: `
    <p class="muted">レコードの共有設計 (${srs.length})。誰に・どの範囲を・どの条件で共有するか。</p>
    <table class="data-table">
      <thead><tr><th>ルール</th><th>種別</th><th>アクセス</th><th>共有先</th><th>条件</th></tr></thead>
      <tbody>
        ${srs.map(sharingRow).join("\n        ")}
      </tbody>
    </table>`,
  };
}

function sharingRow(s: SharingRule): string {
  const kind =
    s.kind === "criteriaBased"
      ? "条件ベース"
      : s.kind === "ownerBased"
        ? "所有者ベース"
        : "テリトリ";
  const sharedTo = `${escapeHtml(s.sharedTo.type)}${s.sharedTo.target ? `: ${escapeHtml(s.sharedTo.target)}` : ""}`;
  const cond =
    s.criteriaItems.length > 0
      ? s.criteriaItems
          .map(
            (c) =>
              `<code>${escapeHtml(c.field)} ${escapeHtml(c.operation)} ${escapeHtml(c.value)}</code>`,
          )
          .join("<br />")
      : s.ownerSource
        ? `所有元: <code>${escapeHtml(s.ownerSource)}</code>`
        : "—";
  return `<tr>
    <td><code>${escapeHtml(s.fullyQualifiedName)}</code></td>
    <td>${kind}</td>
    <td>${escapeHtml(s.accessLevel)}</td>
    <td>${sharedTo}</td>
    <td>${cond}</td>
  </tr>`;
}

// ---------- アクセス権限 (PermissionSet / Profile) ----------

interface ObjectGrant {
  readonly name: string;
  readonly kind: "権限セット" | "プロファイル";
  readonly create: boolean;
  readonly read: boolean;
  readonly edit: boolean;
  readonly del: boolean;
  readonly viewAll: boolean;
  readonly modifyAll: boolean;
  readonly editableFields: number;
  readonly readableFields: number;
}

export function buildAccessSection(obj: SObject, graph: KnowledgeGraph): SectionViewModel {
  const name = obj.fullyQualifiedName;
  const fieldPrefix = `${name}.`;
  const grants: ObjectGrant[] = [];

  const collect = (
    holder: { readonly fullyQualifiedName: string; readonly body?: PermissionSetBodyInfo },
    kind: ObjectGrant["kind"],
    label: string,
  ): void => {
    const op = holder.body?.objectPermissions.find((o) => o.object === name);
    if (op === undefined) return;
    const fps = (holder.body?.fieldPermissions ?? []).filter((f) =>
      f.field.startsWith(fieldPrefix),
    );
    grants.push({
      name: label,
      kind,
      create: op.create,
      read: op.read,
      edit: op.edit,
      del: op.delete,
      viewAll: op.viewAll,
      modifyAll: op.modifyAll,
      editableFields: fps.filter((f) => f.editable).length,
      readableFields: fps.filter((f) => f.readable).length,
    });
  };

  for (const ps of graph.permissionSets) collect(ps, "権限セット", ps.fullyQualifiedName);
  for (const pf of graph.profiles) collect(pf, "プロファイル", pf.fullyQualifiedName);

  if (grants.length === 0) {
    return emptyNote(
      "access-permissions",
      "アクセス権限",
      "このオブジェクトへの権限を付与する権限セット・プロファイルは検出されませんでした。",
    );
  }

  return {
    id: "access-permissions",
    title: "アクセス権限",
    htmlContent: `
    <p class="muted">どの権限セット / プロファイルが、このオブジェクトに何の操作を許可するか (${grants.length})。</p>
    <table class="data-table">
      <thead><tr><th>付与元</th><th>種別</th><th>参照</th><th>作成</th><th>編集</th><th>削除</th><th>全参照</th><th>全変更</th><th>項目(編集可/参照可)</th></tr></thead>
      <tbody>
        ${grants.map(grantRow).join("\n        ")}
      </tbody>
    </table>`,
  };
}

function grantRow(g: ObjectGrant): string {
  return `<tr>
    <td><code>${escapeHtml(g.name)}</code></td>
    <td>${g.kind}</td>
    <td>${check(g.read)}</td>
    <td>${check(g.create)}</td>
    <td>${check(g.edit)}</td>
    <td>${check(g.del)}</td>
    <td>${check(g.viewAll)}</td>
    <td>${check(g.modifyAll)}</td>
    <td>${g.editableFields} / ${g.readableFields}</td>
  </tr>`;
}
