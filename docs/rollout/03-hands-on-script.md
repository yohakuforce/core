# yohakuforce — ハンズオンデモ台本 (テンプレート)

> **このファイルはたたき台です。** `<プレースホルダー>` を自組織の情報に置き換えて使ってください。
>
> 発表者: `<発表者名>`（画面共有しながら実施）
> 想定時間: 10〜15 分
> 対象: `<対象チーム / メンバー>`
> 使用ディレクトリ: `examples/sample-project/`（顧客情報を含まないサンプル）

---

## デモの流れ

| ステップ | 内容 | 目安時間 |
|---|---|---|
| 0 | 事前準備・確認 | 2 分 |
| 1 | 知識グラフのビルド | 2 分 |
| 2 | ドキュメント自動生成 | 2 分 |
| 3 | オンボーディング対話 | 3 分 |
| 4 | 差分の意味づけ | 3 分 |
| 5 | まとめ・Q&A | 3〜5 分 |

---

## Step 0: 事前準備（デモ開始 5 分前に完了させる）

```powershell
cd <サンプルプロジェクトのパス>
yohaku --version
# 最新版を確認
```

**発表者メモ**: Claude Code は別ウィンドウで起動しておく。ターミナルと Claude Code のウィンドウを並べて表示できる状態にしておく。

---

## Step 1: 知識グラフのビルド（約 2 分）

### 目的

`force-app/` 配下の Salesforce メタデータ（XML）を、AI が扱いやすい形（SQLite）に変換する。

### コマンド

```powershell
yohaku graph build
```

### 期待される結果

```
Building knowledge graph...
Scanning force-app/main/default/...
  Processed: ApexClass (5 files)
  Processed: Flow (3 files)
  Processed: CustomObject (2 files)
  ...
Graph built successfully -> .yohaku/graph.sqlite
```

### 説明スクリプト例

「`force-app/` の XML を直接 AI に読ませるとトークンが膨大になり、再現性も取れません。一度 SQLite に変換することで、AI は高速で正確な SQL クエリで情報を取得できます。これが 3 層分離の『決定的処理層』です。」

### 想定される質問と回答

**Q: 本番プロジェクトではどこで実行するのか？**
A: プロジェクトの `force-app/` がある Git リポジトリのルートで実行します。実際のプロジェクトに組み込む場合は `yohaku init --bootstrap` で初期設定ファイルを一括生成できます。

**Q: `.yohaku/graph.sqlite` はコミットするのか？**
A: しません。`.gitignore` に追加済みです。`force-app/` から常に再生成できるため、コミット不要です。

---

## Step 2: ドキュメント自動生成（約 2 分）

### 目的

知識グラフから Markdown ドキュメントを自動生成する。手動更新が不要になる。

### コマンド

```powershell
yohaku render
```

### 期待される結果

```
Rendering documents...
  -> docs/generated/index.md (system overview)
  -> docs/generated/objects/Account.md
  -> docs/generated/apex/AccountTrigger.md
  -> docs/generated/flows/CreateContactFlow.md
  ...
Rendered 12 documents.
```

### 説明スクリプト例

「生成されたファイルを開いてみます。」

```powershell
dir docs\generated\
```

エクスプローラーで `docs/generated/apex/AccountTrigger.md` を開いて内容を見せる。

「ドキュメントには 3 種類のブロックがあります。`DETERMINISTIC`（CLI が生成、手編集禁止）、`AI_MANAGED`（Claude が書き込む）、`HUMAN_MANAGED`（人間が書いた内容、AI が再生成しても消えない）の 3 つです。」

### 想定される質問と回答

**Q: 日本語で出力されるのか？**
A: テンプレートが日本語設定になっていれば日本語で出力されます。`yohaku init --bootstrap` で初期化したプロジェクトにはデフォルトで日本語テンプレートが入ります。

**Q: `yohaku render` を毎回手動で実行するのか？**
A: `yohaku sync` という 1 コマンドで、グラフ更新とドキュメント生成を一括実行できます。hooks を設定すれば `force-app/` を編集するたびに自動実行することも可能です。

---

## Step 3: オンボーディング対話（約 3 分）

### 目的

Claude Code の `/onboard` コマンドで、プロジェクトの全体像を対話形式で把握する体験をしてもらう。

### 手順

1. Claude Code をサンプルプロジェクトのディレクトリで起動する。

```powershell
claude
```

2. Claude Code が起動したら入力する。

```
/onboard
```

### 期待される結果

Claude が以下のような質問を返してくる。

```
あなたは <プロジェクト名> に参加する予定ですか？
どのような役割（開発者 / レビュアー / リリース担当）で参加しますか？
```

役割を答えると、その persona に合わせた全体説明が始まる。

### 説明スクリプト例

「新規参画者が詳しい人に聞く代わりに、このコマンドで基本的な全体像を把握できます。質問に答えるだけで、Claude がプロジェクトの構造・主要 Apex・Flow の役割・注意点を説明します。」

### 想定される質問と回答

**Q: どんな情報が提供されるのか？**
A: 知識グラフから取得した情報が使われます。オブジェクト構成・主要クラス・自動化（Flow / Trigger）・権限構成・依存関係などです。顧客データや個人情報は含みません。

**Q: Claude Code は有料ツールか？**
A: Claude Code は Anthropic の有料サービスです。API 利用料がかかります。`yohaku metrics show` で使用コストを確認できる仕組みが入っています。

---

## Step 4: 差分の意味づけ（約 3 分）

### 目的

Git の差分を「何が変わったか」の技術レベルだけでなく、「業務的に何への影響があるか」の観点で分類する。

### 事前準備（デモ用のダミー差分を作る）

`yohaku diff` は Git の差分を使うため、事前に `git diff HEAD~1` で差分が出る状態を確認しておく。

### コマンド

```powershell
yohaku diff HEAD~1
```

### 期待される結果

```
Detecting changes...
  Modified: force-app/main/default/classes/AccountTrigger.cls
  Modified: force-app/main/default/flows/CreateContactFlow.flow-meta.xml

Classifying changes (AI)...
  AccountTrigger.cls -> [logic] Apex トリガーのロジック変更
  CreateContactFlow.flow -> [automation] 自動化フローの変更

Summary:
  logic: 1 file
  automation: 1 file
```

### 説明スクリプト例

「差分がカテゴリ別に分類されます。同じ変更でも『これは UI の変更か、権限の変更か』がすぐに判断でき、レビューの観点が整理されます。分類は AI が行いますが、ベースの差分検出は CLI が決定的に行うため、誰が実行しても同じ差分が検出されます。」

### 想定される質問と回答

**Q: 分類精度はどれくらいか？**
A: 内部試行では 3 並列 classifier で高い分類精度を確認しています。ただし複雑な変更では誤分類の可能性もあるため、AI の出力は参考情報として扱い、最終判断は人間が行ってください。

**Q: `/classify-diff` と `yohaku diff` の違いは？**
A: `yohaku diff` は CLI で差分を検出し分類結果を出力します。`/classify-diff` は Claude Code 内で対話しながら差分の詳細を掘り下げるときに使います。

---

## Step 5: まとめ（約 3 分）

### 説明スクリプト例（まとめ）

「今日見ていただいたのは以下の 4 点です。

1. `yohaku graph build` — メタデータを知識グラフに変換（再現性の基盤）
2. `yohaku render` — ドキュメントを自動生成（手動更新不要）
3. `/onboard` — 対話でプロジェクト概要を把握（新規参画者支援）
4. `yohaku diff` — 差分を業務観点で分類（レビュー観点の整理）

このツールが解くのは『毎回手で調べて、毎回人に聞いて、毎回ドキュメントを直す』という繰り返し作業です。同じことを AI に任せ、開発メンバーが顧客折衝や本質的な判断に時間を使えるようにするのが目的です。

詳細は FAQ（`04-faq.md`）を参照してください。試してみてフィードバックがあればお知らせください。」

---

## デモ後の追加資料

- `04-faq.md` — 想定問答集
- `02-quickstart-windows.md` — 自分の PC で試したい方向け

---

*本台本はデモ実施後にフィードバックを反映して更新してください。*
