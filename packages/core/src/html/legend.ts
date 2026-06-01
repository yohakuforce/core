// ----------------------------------------------------------------------------
// 凡例ページ (legend.html)
//
// HTML 設計書の読み方 — フローチャートのノード種別・処理ステップのバッジ・
// 項目値の割り当て区分・決定的/AI の色分け — を 1 枚にまとめる。
// 各 component ページのヘッダから「凡例」リンクで遷移できる。
// ----------------------------------------------------------------------------

import { escapeAttr } from "./escape.js";

export interface LegendPageOptions {
  /** index.html への相対パス (legend は html ルート直下なので "index.html") */
  readonly indexHref: string;
  /** assets ディレクトリへの相対パス ("assets") */
  readonly assetsHref: string;
}

interface Row {
  readonly mark: string;
  readonly name: string;
  readonly desc: string;
}

const FLOW_NODE_ROWS: readonly Row[] = [
  {
    mark: `<span class="lg-swatch lg-stadium"></span>`,
    name: "開始・終了",
    desc: "メソッド（処理）の入口と出口。角丸の囲み。",
  },
  {
    mark: `<span class="lg-swatch lg-paral lg-data"></span>`,
    name: "データ取得（SOQL）",
    desc: "データベースからレコードを取得する。平行四辺形。",
  },
  {
    mark: `<span class="lg-swatch lg-paral lg-data"></span>`,
    name: "データ操作（DML）",
    desc: "レコードを登録・更新・削除する。平行四辺形。",
  },
  {
    mark: `<span class="lg-swatch lg-diamond lg-cond"></span>`,
    name: "分岐（条件判定）",
    desc: "条件を満たすか（はい / いいえ）で処理が分かれる。ひし形。",
  },
  {
    mark: `<span class="lg-swatch lg-rect lg-cond"></span>`,
    name: "繰り返し（ループ）",
    desc: "コレクションを 1 件ずつ処理する。点線が繰り返しの戻り。",
  },
  {
    mark: `<span class="lg-swatch lg-rect lg-cond lg-double"></span>`,
    name: "例外処理（try / 捕捉 / 後処理）",
    desc: "エラーを捕捉して処理する。点線が例外発生時の経路。二重枠。",
  },
  {
    mark: `<span class="lg-swatch lg-circle lg-exit"></span>`,
    name: "戻り値・例外送出",
    desc: "呼び出し元へ値を返す、またはエラーを送出して終了する。円。",
  },
];

const STEP_BADGES: readonly { cls: string; label: string; desc: string }[] = [
  { cls: "step-in", label: "入力", desc: "メソッドの引数（受け取る値）。" },
  { cls: "step-soql", label: "SOQL", desc: "レコード取得。" },
  { cls: "step-dml", label: "DML", desc: "レコードの登録/更新/削除。" },
  { cls: "step-if", label: "分岐", desc: "条件による分かれ道。" },
  { cls: "step-loop", label: "繰り返し", desc: "ループ処理。" },
  { cls: "step-try", label: "例外処理", desc: "try / catch。" },
  { cls: "step-return", label: "戻り値", desc: "呼び出し元へ返す値。" },
  { cls: "step-throw", label: "例外送出", desc: "エラーを投げて中断。" },
  { cls: "step-stmt", label: "処理", desc: "その他の処理（代入・生成など）。" },
];

const VALUE_ORIGINS: readonly { label: string; desc: string }[] = [
  { label: "数式で自動計算", desc: "数式項目。他項目から自動算出（入力不可）。" },
  { label: "参照 (lookup)", desc: "他オブジェクトへの参照（Lookup / 主従）。" },
  { label: "選択リスト", desc: "決められた選択肢から選ぶ。" },
  { label: "初期値あり", desc: "新規作成時に既定値が入る。" },
  { label: "積み上げ集計 (自動)", desc: "子レコードからの集計値（入力不可）。" },
  { label: "処理で設定", desc: "Apex / トリガ / フロー が値を設定する。" },
  { label: "ユーザー入力", desc: "画面・API からの手入力。" },
];

export function buildLegendPage(options: LegendPageOptions): string {
  const a = escapeAttr(options.assetsHref);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>凡例 — この設計書の読み方 — yohakuforce</title>
  <link rel="stylesheet" href="${a}/styles.css" />
  <link rel="stylesheet" href="${a}/home.css" />
</head>
<body>
  <header class="global-header">
    <div class="brand">
      <a href="${escapeAttr(options.indexHref)}" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
        <span class="brand-dot">y</span>
        <span class="brand-name">yohakuforce</span>
        <span class="brand-sub">Knowledge Hub</span>
      </a>
    </div>
    <nav class="global-nav"><a href="${escapeAttr(options.indexHref)}">Home</a></nav>
  </header>
  <header class="component-header">
    <h1><span class="type-pill">凡例</span> この設計書の読み方</h1>
    <p class="muted">フローチャート・処理ステップ・項目値の割り当て・色分けの意味をまとめています。各ページ右上の「凡例」から戻れます。</p>
  </header>
  <main class="component-main">
    <article class="sections" style="grid-column:1 / -1;">
      <section class="yohaku-section">
        <h2>処理フロー図（フローチャート）のノード</h2>
        <p class="muted">Apex / トリガの「内部処理フロー」で使う図形の意味です。図形の形と色で処理の種類を表します。</p>
        <table class="data-table legend-table">
          <thead><tr><th>図形</th><th>意味</th><th>説明</th></tr></thead>
          <tbody>
            ${FLOW_NODE_ROWS.map((r) => `<tr><td>${r.mark}</td><td>${r.name}</td><td>${r.desc}</td></tr>`).join("\n            ")}
          </tbody>
        </table>
        <p class="muted">矢印のラベル「はい / いいえ」は分岐の結果、「繰返」は繰り返しの戻り、「例外発生」は例外時の経路を表します。図が読みにくい場合は各メソッドの「ツリー」表示に切り替えると入れ子構造で確認できます。</p>
      </section>

      <section class="yohaku-section">
        <h2>処理ステップ（テキスト版）のバッジ</h2>
        <p class="muted">「処理詳細」のメソッド別ステップで使うバッジです。</p>
        <ul class="step-list" style="border:0;">
          ${STEP_BADGES.map((b) => `<li><span class="step-kind ${b.cls}">${b.label}</span> ${b.desc}</li>`).join("\n          ")}
        </ul>
      </section>

      <section class="yohaku-section">
        <h2>項目値の割り当て（値の決まり方）</h2>
        <table class="data-table">
          <thead><tr><th>区分</th><th>説明</th></tr></thead>
          <tbody>
            ${VALUE_ORIGINS.map((v) => `<tr><td><span class="value-origin">${v.label}</span></td><td>${v.desc}</td></tr>`).join("\n            ")}
          </tbody>
        </table>
      </section>

      <section class="yohaku-section">
        <h2>色分け（事実 と 解釈）</h2>
        <p class="muted">この設計書は「決定的に抽出した事実」と「AI による解釈・確認」を分けて表示します。</p>
        <p><strong>決定的（事実）</strong>: 通常の表・カード。ソースから機械的に抽出した内容で、再生成しても同じ結果になります。</p>
        <div class="ai-detail">
          <div class="ai-detail-head"><span class="ai-tag">AI</span> 解釈・確認ブロック</div>
          <p class="muted" style="margin:4px 0 0;">青い枠は AI が業務的意味・項目設定の詳細・抜け漏れ確認などを補ったブロックです。人手で編集でき、再生成しても保持されます。</p>
        </div>
      </section>
    </article>
  </main>
</body>
</html>
`;
}
