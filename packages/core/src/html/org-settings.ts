// ----------------------------------------------------------------------------
// 組織設定パネル (ホームの「組織設定」タブ / Phase 2)
//
// オブジェクトに従属しない組織レベルの設定 — 連携先 (NamedCredential) /
// 許可サイト (RemoteSiteSetting) / アプリ (CustomApplication) / 設定レコード
// (CustomMetadata) — をホーム 1 箇所に集約する。サーバ側で描画 (home.js 非依存)。
// ----------------------------------------------------------------------------

import type { KnowledgeGraph } from "../types/graph.js";
import { escapeHtml } from "./escape.js";

function subsection(title: string, count: number, body: string): string {
  return `<section class="org-block">
      <h3>${escapeHtml(title)} <span class="muted">(${count})</span></h3>
      ${body}
    </section>`;
}

function emptyNote(note: string): string {
  return `<p class="muted">${escapeHtml(note)}</p>`;
}

export function renderOrgSettingsPanel(graph: KnowledgeGraph): string {
  return `
    <p class="notice" style="margin-bottom:16px;">オブジェクトに依存しない組織レベルの設定です。連携・アプリ・設定レコードの一覧を確認できます。</p>
    ${renderNamedCredentials(graph)}
    ${renderRemoteSites(graph)}
    ${renderCustomApps(graph)}
    ${renderCustomMetadata(graph)}`;
}

function renderNamedCredentials(graph: KnowledgeGraph): string {
  const ncs = graph.namedCredentials;
  const body =
    ncs.length === 0
      ? emptyNote("名前付き認証情報は検出されませんでした。")
      : `<table class="data-table">
        <thead><tr><th>API 名</th><th>エンドポイント</th><th>認証方式</th><th>プロトコル</th><th>シークレット</th></tr></thead>
        <tbody>
          ${ncs
            .map(
              (n) => `<tr>
            <td><code>${escapeHtml(n.fullyQualifiedName)}</code></td>
            <td>${n.endpoint !== undefined ? `<code>${escapeHtml(n.endpoint)}</code>` : "—"}</td>
            <td>${escapeHtml(n.principalType ?? "—")}</td>
            <td>${escapeHtml(n.protocol ?? "—")}</td>
            <td>${n.hasSecret ? "保有 (値は非表示)" : "なし"}</td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>`;
  return subsection("名前付き認証情報 (連携先)", ncs.length, body);
}

function renderRemoteSites(graph: KnowledgeGraph): string {
  const rss = graph.remoteSiteSettings;
  const body =
    rss.length === 0
      ? emptyNote("リモートサイト設定は検出されませんでした。")
      : `<table class="data-table">
        <thead><tr><th>API 名</th><th>URL</th><th>有効</th><th>プロトコルセキュリティ</th></tr></thead>
        <tbody>
          ${rss
            .map(
              (r) => `<tr>
            <td><code>${escapeHtml(r.fullyQualifiedName)}</code></td>
            <td>${r.url !== undefined ? `<code>${escapeHtml(r.url)}</code>` : "—"}</td>
            <td>${r.active ? "✓" : "無効"}</td>
            <td>${r.disableProtocolSecurity ? "<strong>無効化</strong>" : "有効"}</td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>`;
  return subsection("リモートサイト設定 (許可サイト)", rss.length, body);
}

function renderCustomApps(graph: KnowledgeGraph): string {
  const apps = graph.customApplications;
  const body =
    apps.length === 0
      ? emptyNote("カスタムアプリケーションは検出されませんでした。")
      : `<table class="data-table">
        <thead><tr><th>API 名</th><th>ラベル</th><th>ナビ</th><th>タブ数</th><th>フォームファクタ</th></tr></thead>
        <tbody>
          ${apps
            .map(
              (a) => `<tr>
            <td><code>${escapeHtml(a.fullyQualifiedName)}</code></td>
            <td>${escapeHtml(a.label ?? "—")}</td>
            <td>${escapeHtml(a.navType ?? "—")}</td>
            <td>${a.tabs.length}</td>
            <td>${a.formFactors.length > 0 ? escapeHtml(a.formFactors.join(" / ")) : "—"}</td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>`;
  return subsection("カスタムアプリケーション", apps.length, body);
}

function renderCustomMetadata(graph: KnowledgeGraph): string {
  const records = graph.customMetadataRecords;
  if (records.length === 0) {
    return subsection(
      "カスタムメタデータ (設定レコード)",
      0,
      emptyNote("カスタムメタデータレコードは検出されませんでした。"),
    );
  }
  // 型ごとにグループ化
  const byType = new Map<string, typeof records>();
  for (const r of records) {
    const list = byType.get(r.type) ?? [];
    byType.set(r.type, [...list, r]);
  }
  const blocks = [...byType.entries()]
    .map(([type, recs]) => {
      const rows = recs
        .map(
          (r) => `<tr>
            <td><code>${escapeHtml(r.recordName)}</code></td>
            <td>${escapeHtml(r.label ?? "—")}</td>
            <td>${
              r.values.length === 0
                ? "—"
                : r.values
                    .map((v) => `<code>${escapeHtml(v.field)}</code>=${escapeHtml(v.value)}`)
                    .join("<br />")
            }</td>
          </tr>`,
        )
        .join("\n          ");
      return `<h4><code>${escapeHtml(type)}</code> <span class="muted">(${recs.length} レコード)</span></h4>
        <table class="data-table">
          <thead><tr><th>レコード</th><th>ラベル</th><th>設定値</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>`;
    })
    .join("\n      ");
  return subsection("カスタムメタデータ (設定レコード)", records.length, blocks);
}
