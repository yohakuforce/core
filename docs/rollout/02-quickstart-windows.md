# yohakuforce — Windows 環境 Quickstart (テンプレート)

> **このファイルはたたき台です。** `<プレースホルダー>` を自組織の情報に置き換えて使ってください。
>
> 対象: Windows PC を使用する Salesforce 開発メンバー
> 所要時間: セットアップ 15〜20 分程度
> 確認環境: Windows 10 / 11（PowerShell 使用）

---

## 前提条件

以下が PC に入っていることを確認してください。

| ツール | 必要バージョン | 確認コマンド |
|---|---|---|
| Node.js | 20 以上 | `node --version` |
| Claude Code CLI | 最新版 | `claude --version` |
| Git | 任意（コントリビュート時のみ） | `git --version` |

---

## Step 1: Node.js 20+ のインストール

1. [https://nodejs.org/](https://nodejs.org/) にアクセスし、**LTS 版（20 以上）** をダウンロードします。
2. インストーラーを実行し、デフォルト設定で進めます。
3. PowerShell を**新規で開き直して**から確認します。

```powershell
node --version
# v20.x.x 以上が表示されれば OK
npm --version
# 10.x.x 前後が表示されれば OK
```

---

## Step 2: Claude Code CLI のインストール

```powershell
npm install -g @anthropic-ai/claude-code
claude --version
# Claude Code のバージョンが表示されれば OK
```

インストール後、初回起動時にブラウザでの認証が求められます。画面の指示に従って認証してください。

---

## Step 3: yohakuforce CLI のインストール

npm からグローバル導入します。

```powershell
npm install -g @yohakuforce/core
yohaku --version
# バージョン番号が表示されれば OK
```

> `npm install -g` で権限エラーが出る場合は、PowerShell を「管理者として実行」してから再試行してください。

---

## Step 4: 動作確認（既存プロジェクトで試す場合）

`sfdx-project.json` がある Salesforce DX プロジェクトのルートで実行します。

```powershell
cd <あなたの Salesforce プロジェクトのパス>

# 初期セットアップ（scaffold 展開 + 知識グラフ構築 + ドキュメント生成）
yohaku init --bootstrap --profile minimal

# 以降の運用は sync 1 コマンドで再構築
yohaku sync
```

`docs/generated/` 配下にファイルが生成されれば、セットアップ完了です。

---

## Step 5: 動作確認（サンプルで試す場合）

手元に Salesforce プロジェクトがない場合は、リポジトリ同梱のサンプルで動作確認できます。

```powershell
# サンプルだけ取得
git clone --depth 1 https://github.com/yohakuforce/core $env:TEMP\yohakuforce-src
cp -r $env:TEMP\yohakuforce-src\examples\sample-project $env:USERPROFILE\Documents\yohaku-sample
cd $env:USERPROFILE\Documents\yohaku-sample

yohaku graph build
yohaku render
dir docs\generated\
```

---

## Step 6: Claude Code との連携確認

セットアップしたプロジェクトのルートで Claude Code を起動します。

```powershell
claude
```

起動後、以下を入力して応答を確認します。

```
/onboard
```

プロジェクトの概要説明が開始されれば、連携が正常に機能しています。

---

## トラブルシュート

### よくある問題 1: `yohaku` コマンドが見つからない

**症状**: `yohaku: command not found` または `yohaku は認識されていません`

**対処**:

```powershell
# グローバル install が効いているか確認
npm list -g --depth=0 | findstr yohakuforce

# 再 install
npm install -g @yohakuforce/core

# PATH を確認
npm bin -g
# 表示されたパスが Windows の PATH に含まれていない場合は、環境変数に追加
```

---

### よくある問題 2: `npm install -g` で権限エラー

**症状**: `EACCES` や `EPERM` エラー

**対処**:

PowerShell を**管理者として実行**してから `npm install -g @yohakuforce/core` を再実行してください。

スタートメニューで PowerShell を右クリック → 「管理者として実行」を選択します。

---

### よくある問題 3: `yohaku graph build` でパスエラーが出る

**症状**: `GraphSchemaValidationError` が表示される

**対処**:

最新版を使っているか確認してください。

```powershell
yohaku --version

# 古い場合はアップデート
npm update -g @yohakuforce/core
```

---

*セットアップが完了したら、`03-hands-on-script.md` のデモ手順に進んでください。*
