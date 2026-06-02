// ----------------------------------------------------------------------------
// リファレンスページのタイプ別セクション builder (Phase 3)
//
// PermissionSet / Profile / FlexiPage / VisualforcePage / VisualforceComponent /
// Aura の決定的内容を RefSection[] に変換する。
// ----------------------------------------------------------------------------

import type {
  AuraBundle,
  EmailTemplate,
  FlexiPage,
  PermissionSet,
  PermissionSetBodyInfo,
  Profile,
  VisualforceComponent,
  VisualforcePage,
} from "../types/graph.js";
import { escapeHtml } from "./escape.js";

export interface RefSection {
  readonly id: string;
  readonly title: string;
  readonly html: string;
  /** true なら初期状態で折りたたむ (情報量の多いセクション向け) */
  readonly collapsed?: boolean;
}

const check = (b: boolean): string => (b ? "✓" : "");
const muted = (s: string): string => `<p class="muted">${escapeHtml(s)}</p>`;

// ---------- EmailTemplate ----------

const EMAIL_TYPE_LABEL: Record<string, string> = {
  text: "テキスト",
  html: "HTML",
  custom: "カスタム HTML",
  visualforce: "Visualforce",
};

export function buildEmailTemplateSections(t: EmailTemplate): RefSection[] {
  const typeJa = t.type !== undefined ? (EMAIL_TYPE_LABEL[t.type.toLowerCase()] ?? t.type) : "—";
  return [
    {
      id: "summary",
      title: "概要",
      html: `<table class="data-table"><tbody>
        <tr><th>ラベル</th><td>${escapeHtml(t.name ?? "—")}</td></tr>
        <tr><th>件名</th><td>${t.subject !== undefined ? escapeHtml(t.subject) : "—"}</td></tr>
        <tr><th>形式</th><td>${escapeHtml(typeJa)}</td></tr>
        <tr><th>文字コード</th><td>${escapeHtml(t.encodingKey ?? "—")}</td></tr>
        <tr><th>利用可能</th><td>${t.available === undefined ? "—" : t.available ? "✓" : "無効"}</td></tr>
      </tbody></table>${t.description ? muted(t.description) : ""}
      <p class="muted">本文 (差し込み項目を含む) は <code>.email</code> ファイルに格納されます。差し込みロジックの詳細は本文を参照してください。</p>`,
    },
  ];
}

// ---------- PermissionSet / Profile (共通の body) ----------

function permissionBodySections(body: PermissionSetBodyInfo | undefined): RefSection[] {
  if (body === undefined) {
    return [{ id: "perms", title: "権限", html: muted("権限ボディは解析されていません。") }];
  }

  // オブジェクト権限
  const objectPerms: RefSection = {
    id: "object-perms",
    title: `オブジェクト権限 (${body.objectPermissions.length})`,
    html:
      body.objectPermissions.length === 0
        ? muted("オブジェクト権限はありません。")
        : `<table class="data-table">
        <thead><tr><th>オブジェクト</th><th>参照</th><th>作成</th><th>編集</th><th>削除</th><th>全参照</th><th>全変更</th></tr></thead>
        <tbody>
          ${body.objectPermissions
            .map(
              (o) =>
                `<tr><td><code>${escapeHtml(o.object)}</code></td><td>${check(o.read)}</td><td>${check(o.create)}</td><td>${check(o.edit)}</td><td>${check(o.delete)}</td><td>${check(o.viewAll)}</td><td>${check(o.modifyAll)}</td></tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>`,
  };

  // 項目権限 (オブジェクト単位、情報量が多いので初期折りたたみ)
  const byObject = new Map<string, { field: string; readable: boolean; editable: boolean }[]>();
  for (const fp of body.fieldPermissions) {
    const obj = fp.field.split(".")[0] ?? fp.field;
    const list = byObject.get(obj) ?? [];
    list.push(fp);
    byObject.set(obj, list);
  }
  const fieldPerms: RefSection = {
    id: "field-perms",
    title: `項目権限 (${body.fieldPermissions.length})`,
    collapsed: true,
    html:
      body.fieldPermissions.length === 0
        ? muted("項目レベル権限はありません。")
        : [...byObject.entries()]
            .map(
              ([obj, fps]) =>
                `<details class="layout-block"><summary><code>${escapeHtml(obj)}</code> <span class="muted">(${fps.length} 項目)</span></summary>
        <table class="data-table"><thead><tr><th>項目</th><th>参照</th><th>編集</th></tr></thead><tbody>
          ${fps
            .map(
              (f) =>
                `<tr><td><code>${escapeHtml(f.field)}</code></td><td>${check(f.readable)}</td><td>${check(f.editable)}</td></tr>`,
            )
            .join("\n          ")}
        </tbody></table></details>`,
            )
            .join("\n      "),
  };

  // Apex クラスアクセス (有効/無効を明示)
  const apexAccess: RefSection = {
    id: "apex-access",
    title: `Apex クラスアクセス (${body.classAccesses.length})`,
    html:
      body.classAccesses.length === 0
        ? muted("付与された Apex クラスアクセスはありません。")
        : `<ul>${body.classAccesses
            .map(
              (c) =>
                `<li><code>${escapeHtml(c.apexClass)}</code>${c.enabled ? "" : ' <span class="muted">(無効)</span>'}</li>`,
            )
            .join("")}</ul>`,
  };

  // システム権限 (常に表示。情報量が多いので折りたたみ)
  const userPerms: RefSection = {
    id: "user-perms",
    title: `システム権限 (${body.userPermissions.length})`,
    collapsed: body.userPermissions.length > 12,
    html:
      body.userPermissions.length === 0
        ? muted("付与されたシステム権限はありません。")
        : `<ul class="perm-cols">${[...body.userPermissions]
            .toSorted((a, b) => a.localeCompare(b))
            .map((p) => `<li><code>${escapeHtml(p)}</code></li>`)
            .join("")}</ul>`,
  };

  const extra: RefSection[] = [];

  const tabs = body.tabSettings ?? [];
  if (tabs.length > 0) {
    extra.push({
      id: "tab-settings",
      title: `タブ表示 (${tabs.length})`,
      collapsed: tabs.length > 12,
      html: `<table class="data-table"><thead><tr><th>タブ</th><th>表示</th></tr></thead><tbody>
        ${tabs.map((t) => `<tr><td><code>${escapeHtml(t.tab)}</code></td><td>${escapeHtml(t.visibility)}</td></tr>`).join("\n        ")}
      </tbody></table>`,
    });
  }

  const rtv = body.recordTypeVisibilities ?? [];
  if (rtv.length > 0) {
    extra.push({
      id: "rt-visibility",
      title: `レコードタイプ表示 (${rtv.length})`,
      html: `<table class="data-table"><thead><tr><th>レコードタイプ</th><th>表示</th><th>既定</th></tr></thead><tbody>
        ${rtv.map((r) => `<tr><td><code>${escapeHtml(r.recordType)}</code></td><td>${check(r.visible)}</td><td>${check(r.default)}</td></tr>`).join("\n        ")}
      </tbody></table>`,
    });
  }

  const apps = body.applicationVisibilities ?? [];
  if (apps.length > 0) {
    extra.push({
      id: "app-visibility",
      title: `アプリケーション表示 (${apps.length})`,
      html: `<table class="data-table"><thead><tr><th>アプリ</th><th>表示</th><th>既定</th></tr></thead><tbody>
        ${apps.map((a) => `<tr><td><code>${escapeHtml(a.application)}</code></td><td>${check(a.visible)}</td><td>${check(a.default)}</td></tr>`).join("\n        ")}
      </tbody></table>`,
    });
  }

  const custom = body.customPermissions ?? [];
  if (custom.length > 0) {
    extra.push({
      id: "custom-perms",
      title: `カスタム権限 (${custom.length})`,
      html: `<ul class="perm-cols">${custom.map((c) => `<li><code>${escapeHtml(c)}</code></li>`).join("")}</ul>`,
    });
  }

  return [objectPerms, fieldPerms, apexAccess, userPerms, ...extra];
}

export function buildPermissionSetSections(ps: PermissionSet): RefSection[] {
  const summary: RefSection = {
    id: "summary",
    title: "概要",
    html: `<p><strong>${escapeHtml(ps.label ?? ps.fullyQualifiedName)}</strong>${ps.license ? ` / ライセンス: <code>${escapeHtml(ps.license)}</code>` : ""}</p>${ps.description ? `<p class="muted">${escapeHtml(ps.description)}</p>` : ""}`,
  };
  return [summary, ...permissionBodySections(ps.body)];
}

export function buildProfileSections(pf: Profile): RefSection[] {
  const summary: RefSection = {
    id: "summary",
    title: "概要",
    html: `<p><code>${escapeHtml(pf.fullyQualifiedName)}</code>${pf.userLicense ? ` / ユーザーライセンス: <code>${escapeHtml(pf.userLicense)}</code>` : ""}</p>`,
  };
  return [summary, ...permissionBodySections(pf.body)];
}

// ---------- FlexiPage ----------

interface ItemKind {
  readonly cls: string;
  readonly label: string;
}

function classifyFlexiItem(item: { componentName?: string; fieldName?: string }): ItemKind {
  if (item.fieldName !== undefined) return { cls: "fp-field", label: "項目" };
  const c = (item.componentName ?? "").toLowerCase();
  if (c.includes("relatedlist")) return { cls: "fp-related", label: "関連リスト" };
  if (c.includes("recordhighlight") || c.includes("highlights"))
    return { cls: "fp-highlight", label: "ハイライト" };
  if (c.includes("action") || c.includes("activit"))
    return { cls: "fp-action", label: "アクション/活動" };
  if (c.startsWith("c:") || c.includes("__")) return { cls: "fp-custom", label: "カスタム" };
  return { cls: "fp-component", label: "コンポーネント" };
}

function flexiItemChip(item: { componentName?: string; fieldName?: string }): string {
  const kind = classifyFlexiItem(item);
  const name = item.fieldName ?? item.componentName ?? "?";
  return `<div class="fp-item ${kind.cls}"><span class="fp-item-kind">${kind.label}</span><code>${escapeHtml(name)}</code></div>`;
}

export function buildFlexiPageSections(fp: FlexiPage): RefSection[] {
  const hasDynamicForm = fp.regions.some((r) => r.items.some((it) => it.fieldName !== undefined));
  const summary: RefSection = {
    id: "summary",
    title: "概要",
    html: `<table class="data-table"><tbody>
      <tr><th>種別</th><td><code>${escapeHtml(fp.type ?? "—")}</code></td></tr>
      ${fp.sobjectType ? `<tr><th>対象オブジェクト</th><td><code>${escapeHtml(fp.sobjectType)}</code></td></tr>` : ""}
      ${fp.pageTemplate ? `<tr><th>テンプレート</th><td><code>${escapeHtml(fp.pageTemplate)}</code></td></tr>` : ""}
      ${fp.masterLabel ? `<tr><th>ラベル</th><td>${escapeHtml(fp.masterLabel)}</td></tr>` : ""}
      <tr><th>動的フォーム</th><td>${hasDynamicForm ? "✓ 採用 (項目をリージョンへ直接配置)" : "未使用 (項目はページレイアウト参照)"}</td></tr>
    </tbody></table>${fp.description ? muted(fp.description) : ""}`,
  };
  const layout: RefSection = {
    id: "page-layout",
    title: "ページ構成 (視覚)",
    html:
      fp.regions.length === 0
        ? muted("リージョンは検出されませんでした。")
        : `<p class="muted">リージョンごとの配置です。色で 項目(動的フォーム) / 関連リスト / アクション・活動 / ハイライト / コンポーネント を区別します。</p>
      <div class="flexi-mock">
        ${fp.regions
          .map(
            (r) => `<div class="fp-region">
          <div class="fp-region-label">${escapeHtml(r.name)}${r.type ? ` <span class="muted">${escapeHtml(r.type)}</span>` : ""}${r.items.some((it) => it.fieldName !== undefined) ? ' <span class="badge">動的フォーム</span>' : ""}</div>
          <div class="fp-items">
            ${r.items.length === 0 ? '<span class="muted">（空）</span>' : r.items.map(flexiItemChip).join("\n            ")}
          </div>
        </div>`,
          )
          .join("\n        ")}
      </div>`,
  };
  return [summary, layout];
}

// ---------- Visualforce ----------

function markupTable(counts: readonly { tag: string; count: number }[]): string {
  if (counts.length === 0) return muted("マークアップタグは検出されませんでした。");
  return `<table class="data-table"><thead><tr><th>タグ</th><th>出現数</th></tr></thead><tbody>
      ${counts.map((m) => `<tr><td><code>${escapeHtml(m.tag)}</code></td><td>${m.count}</td></tr>`).join("\n      ")}
    </tbody></table>`;
}

export function buildVfPageSections(vp: VisualforcePage): RefSection[] {
  const summary: RefSection = {
    id: "summary",
    title: "概要",
    html: `<ul>
      ${vp.controller ? `<li>コントローラ: <code>${escapeHtml(vp.controller)}</code></li>` : ""}
      ${vp.standardController ? `<li>標準コントローラ: <code>${escapeHtml(vp.standardController)}</code></li>` : ""}
      ${vp.extensions.length > 0 ? `<li>拡張: ${vp.extensions.map((e) => `<code>${escapeHtml(e)}</code>`).join(", ")}</li>` : ""}
      ${vp.renderAs ? `<li>renderAs: <code>${escapeHtml(vp.renderAs)}</code></li>` : ""}
    </ul>`,
  };
  const markup: RefSection = {
    id: "markup",
    title: "マークアップ",
    html: markupTable(vp.markupCounts),
  };
  const methods: RefSection = {
    id: "method-refs",
    title: "コントローラ参照メソッド",
    html:
      vp.methodReferences.length === 0
        ? muted("{!controller.method} 参照は検出されませんでした。")
        : `<ul>${vp.methodReferences.map((m) => `<li><code>${escapeHtml(m)}</code></li>`).join("")}</ul>`,
  };
  return [summary, markup, methods];
}

export function buildVfComponentSections(vc: VisualforceComponent): RefSection[] {
  const summary: RefSection = {
    id: "summary",
    title: "概要",
    html: vc.controller
      ? `<p>コントローラ: <code>${escapeHtml(vc.controller)}</code></p>`
      : muted("コントローラなし"),
  };
  const attrs: RefSection = {
    id: "attributes",
    title: "属性",
    html:
      vc.attributes.length === 0
        ? muted("属性は定義されていません。")
        : `<table class="data-table"><thead><tr><th>名前</th><th>型</th><th>必須</th><th>説明</th></tr></thead><tbody>
        ${vc.attributes
          .map(
            (a) =>
              `<tr><td><code>${escapeHtml(a.name)}</code></td><td>${escapeHtml(a.type ?? "—")}</td><td>${a.required === true ? "✓" : ""}</td><td>${escapeHtml(a.description ?? "—")}</td></tr>`,
          )
          .join("\n        ")}
      </tbody></table>`,
  };
  const markup: RefSection = {
    id: "markup",
    title: "マークアップ",
    html: markupTable(vc.markupCounts),
  };
  return [summary, attrs, markup];
}

// ---------- Aura ----------

export function buildAuraSections(ab: AuraBundle): RefSection[] {
  const files = [
    ab.hasController ? "Controller" : null,
    ab.hasHelper ? "Helper" : null,
    ab.hasRenderer ? "Renderer" : null,
    ab.hasStyle ? "Style" : null,
  ].filter((x): x is string => x !== null);
  const summary: RefSection = {
    id: "summary",
    title: "概要",
    html: `<ul>
      <li>種別: <code>${escapeHtml(ab.bundleKind)}</code></li>
      ${ab.apiVersion ? `<li>API: ${escapeHtml(ab.apiVersion)}</li>` : ""}
      <li>構成ファイル: ${files.length > 0 ? files.map((f) => `<code>${escapeHtml(f)}</code>`).join(", ") : "—"}</li>
    </ul>${ab.description ? muted(ab.description) : ""}`,
  };
  const attrs: RefSection = {
    id: "attributes",
    title: "属性 / ハンドラ",
    html: `${
      ab.attributes.length > 0
        ? `<p class="muted">属性:</p><ul>${ab.attributes.map((a) => `<li><code>${escapeHtml(a)}</code></li>`).join("")}</ul>`
        : muted("属性なし")
    }${
      ab.handlers.length > 0
        ? `<p class="muted">イベントハンドラ:</p><ul>${ab.handlers.map((h) => `<li><code>${escapeHtml(h)}</code></li>`).join("")}</ul>`
        : ""
    }`,
  };
  return [summary, attrs];
}
