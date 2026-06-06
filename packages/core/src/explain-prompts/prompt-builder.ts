// ----------------------------------------------------------------------------
// 各ブロック種別ごとのプロンプトテンプレ
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";
import type { ExplainBlockKind } from "./types.js";

const TYPE_LABEL: Record<ComponentType, string> = {
  apex: "Apex クラス",
  trigger: "Apex トリガ",
  lwc: "Lightning Web Component",
  object: "SObject",
  flow: "Flow",
};

export function buildPrompt(type: ComponentType, name: string, blockId: ExplainBlockKind): string {
  if (blockId === "business-meaning") {
    return buildBusinessMeaningPrompt(type, name);
  }
  if (blockId === "processing-detail-narrative") {
    return buildProcessingDetailPrompt(type, name);
  }
  return buildConcernsPrompt(type, name);
}

function buildProcessingDetailPrompt(type: ComponentType, name: string): string {
  const label = TYPE_LABEL[type];
  return `あなたは Salesforce プロジェクトの詳細設計書を補完するシニアエンジニアです。
以下の ${label} "${name}" の「処理詳細」を、データ操作に踏み込んで記述してください。

## 入力 (context)
- context.soqlDetail: 各 SOQL の { object, fields, where, orderBy, limit } (決定的抽出)
- context.fieldWrites: 各 項目代入の { object, field, value, operation, method } (決定的抽出)
- context.methods / dmlTargets / autoDetectedConcerns も参照可

## 書くこと
1. クエリ発行箇所ごとに「どのオブジェクトの / どの項目を / どの条件で」取得するかを明確化する
   - context.soqlDetail を根拠にし、where 条件の業務的な意味 (例: 当月・有効のみ) を補足する
   - 動的 SOQL (context に出ない文字列結合) があれば原文を読んで補う
2. 項目への値の割り当てを「オブジェクト.項目 ← 値 (条件 / 操作)」の形で記述する
   - context.fieldWrites を根拠にし、設定条件 (どの分岐で設定されるか) を補う
   - putSObject 等の動的代入で context に出ないものは原文から補う

## 制約
- context と原文から観察できる事実だけを書く。推測は "要確認" と明示
- 既出の一覧 (SOQL対象/DML対象) の単純な繰り返しはしない。項目・条件・値まで踏み込む

## 出力フォーマット
- 純粋な HTML 断片のみ。許可タグ: <p>, <ul>, <li>, <ol>, <strong>, <em>, <code>, <table>, <thead>, <tbody>, <tr>, <th>, <td>
- マークダウン / コードフェンス / 見出し(h*) / 説明文 / コメントは禁止`;
}

function buildBusinessMeaningPrompt(type: ComponentType, name: string): string {
  const label = TYPE_LABEL[type];
  return `あなたは Salesforce プロジェクトの設計書を補完するシニアエンジニアです。
以下の ${label} "${name}" の「業務的意味づけ」を 2〜3 文で書いてください。

## 観点
- このコンポーネントが「業務上の何を解決しているか」を平易な語彙で記述する
- 「Apex メソッドが ${name} の責務を…」のような技術詳細の繰り返しは避ける (他セクションに既出)
- 不明であれば、推測ではなく「主な責務: ${name} の処理」のような最小事実に留める

## 出力フォーマット
- 純粋な HTML 断片のみを返す
- 許可タグ: <p>, <strong>, <em>, <code>, <ul>, <li>
- マークダウン / コードフェンス / 見出し / 説明文 / コメントは禁止
- 例: <p>このクラスは口座残高の月次再計算を担う。RestResource からも呼び出される。</p>`;
}

function buildConcernsPrompt(type: ComponentType, name: string): string {
  const label = TYPE_LABEL[type];
  return `あなたは Salesforce プロジェクトのコードレビュアーです。
以下の ${label} "${name}" について「既知の懸念」を 0〜3 件、HTML リストで書いてください。

## 観点
- ガバナ制限 (SOQL/DML/Heap/CPU) のリスク
- バルクセーフでない構造 (ループ内 SOQL/DML)
- ハードコードされた ID / Recordtype
- 例外処理の不在、Database.* のフォールバック未設定
- 依存関係の循環、ハンドラの肥大化

## 制約
- 自動検出済の懸念 (autoDetectedConcerns) と重複する内容は書かない
- "リスクの可能性がある" のような曖昧表現は避け、観察できる事実だけ書く
- 該当なしの場合は <p>追加の懸念はありません。</p>

## 出力フォーマット
- 純粋な HTML 断片のみを返す
- 許可タグ: <p>, <ul>, <li>, <strong>, <code>
- 例: <ul><li><strong>ループ内 SOQL の疑い</strong>: \`recalculate\` 内で Account を for ループで個別 query している可能性。</li></ul>`;
}

/**
 * トップレベルの全体指示。LLM に「items 全部を 1 つの JSON で返す」よう指示する。
 */
export function buildOverallInstructions(): string {
  return `あなたは複数のコンポーネントについて「業務的意味づけ」「既知の懸念」の HTML 断片を生成するアシスタントです。

入力 items の各要素に対し、以下のスキーマで 1 つの JSON を返してください:

\`\`\`json
{
  "version": 1,
  "components": [
    {
      "type": "<入力 items[i].type>",
      "name": "<入力 items[i].name>",
      "blocks": {
        "<入力 items[i].blockId>": "<生成した HTML 断片>"
      }
    }
  ]
}
\`\`\`

重要なルール:
1. 同じ (type, name) を持つ複数 item は、components 配列の同一要素にまとめ、blocks に複数 id をぶら下げる
2. HTML 断片は許可タグのみ (<p>, <ul>, <li>, <strong>, <em>, <code>) を使う。マークダウンは禁止
3. components 以外のキーや解説文を絶対に追加しない (パーサが拒否します)
4. 不明な item は blocks の値を <p>(情報不足のため未記入)</p> とする`;
}
