# yohaku with Local LLMs — CLI Operating Guide

> ローカル LLM (Ollama / llama.cpp / 自前 SDK 等) から yohaku を使うためのガイド。
> 専用プロンプトテンプレートは不要です。**CLI が唯一の真実**なので、LLM には
> 「bash 経由で `yohaku` を呼べる」ことだけ伝われば動きます。

## 前提

- `yohaku` が PATH に通っている (`npm install -g @yohakuforce/core`)
- LLM が **シェルコマンドを実行できる** こと (tool-use / function-calling / コード実行サンドボックス等)
- 小さめの coder 系モデルでも可 (例: `qwen2.5-coder`, `deepseek-coder`)

## コマンド発見可能性

LLM には最初に `--help` を叩かせてコマンド一覧を取得させるのが確実です:

```bash
yohaku --help              # 全コマンドと主要フラグ
yohaku graph --help        # サブコマンド詳細
```

ローカル LLM はコンテキストが小さいことが多いので、`--help` 全体ではなく
**必要なコマンドの 1 行だけ**を渡すと安定します (下記チートシート参照)。

## 主要コマンド (引数だけで叩ける)

```bash
# 1. 知識グラフ構築 (最初に 1 回)
yohaku graph build

# 2. 設計書生成 (Markdown + HTML)
yohaku render --format md,html

# 3. ローカルプレビュー
yohaku serve --port 4000          # http://127.0.0.1:4000/

# 4. AI-managed ブロック充填 (LLM 連携)
yohaku explain-prompts --output prompts.json   # 充填用 prompt を生成
#   → prompts.json を LLM に渡して回答 (fill.json) を得る (下記)
yohaku html-write --input fill.json --dry-run  # 反映前チェック
yohaku html-write --input fill.json            # 書き戻し
```

すべて決定的です。LLM が介在するのは `explain-prompts` → `html-write` の間だけ。

## LLM 出力 → html-write の最小接続手順

`explain-prompts` の出力 `prompts.json` は item 配列です。各 item には充填対象の
ID と prompt + context が入っています。ローカル LLM での最小ループ:

1. `yohaku explain-prompts --output prompts.json` を実行
2. `prompts.json` の各 item について、`prompt` + `context` をモデルに与えて本文を生成
3. 生成結果を **`html-write` が読む `fill.json` 形式** に整形:
   - 各エントリは「どのコンポーネントの・どのブロック ID に・どの本文を入れるか」を持つ
   - 形式の厳密な定義は `yohaku html-write --help` と `prompts.json` の各 item を参照
4. `yohaku html-write --input fill.json --dry-run` で `rejected` が 0 件であることを確認
5. `yohaku html-write --input fill.json` で確定

> ヒント: ローカル LLM は JSON 整形を間違えやすいので、`--dry-run` を必ず挟み、
> `rejected` / `missing_blocks` が出たら item を 1 つずつ処理する方式に切り替えてください。

## チートシート (LLM の system prompt に貼る用)

```
あなたはシェルを実行できます。Salesforce プロジェクトの設計・依存解析には
生の force-app/ XML を grep せず、必ず yohaku CLI を使ってください:
- 影響範囲: yohaku impact SObject:<name>
- 設計書(人間レビュー用 HTML): yohaku render --format md,html
- プレビュー: yohaku serve --port 4000
- 意味づけ充填: yohaku explain-prompts --output prompts.json → (回答を fill.json 化) → yohaku html-write --input fill.json
HTML 出力ファイルは手書きしない (再生成で消える)。編集は AI-managed ブロックのみ。
```

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `Knowledge graph not found` | 先に `yohaku graph build` |
| `html output dir not found` | 先に `yohaku render --format html` |
| `serve: directory not found` | 同上、または `--dir <path>` を指定 |
| html-write で `rejected` が多い | `fill.json` の block ID が `prompts.json` と一致しているか確認 |
