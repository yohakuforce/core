# yohaku in Codex — Operating Snippet

> このファイルは Codex 用のプロンプト断片です。プロジェクト root の `AGENTS.md` に
> 取り込むか、Codex の system prompt として読み込ませてください。

## When to use yohaku

ユーザーが以下のような問いを投げてきたら **必ず先に yohaku CLI を試す** (生 XML を読まない):

| ユーザーの問い | 使うコマンド |
|---|---|
| 「このオブジェクトを変えたら何が壊れる？」 | `yohaku impact SObject:<name>` |
| 「このクラスはどこから呼ばれている？」 | `yohaku graph query "..."` |
| 「設計書を人にレビューしてもらいたい」 | `yohaku render --format md,html` |
| 「業務的にどの機能がどう繋がってる？」 | `yohaku render --format html` → ホームの「ドメインマップ」タブ |
| 「初めて見るプロジェクトを把握したい」 | `yohaku onboard context --role new_joiner` |

## Build pipeline (3 modes)

```bash
# ローカルのソースを対象
yohaku render --format md,html

# Org からソースを retrieve して対象
yohaku graph build --source org
yohaku render --format md,html

# コンポーネントタイプを絞る
yohaku render --format md,html --types apex,object
```

## Output layout

- Markdown (AI 入力向け): `docs/generated/*.md`
- HTML (人間レビュー用): `docs/generated/html/index.html`

## New workflows (Phase 8〜15)

CLI 直接呼び出しで提示する (スラッシュ相当の概念はないので「次のコマンドを実行してください」と案内):

| ユーザーの問い | 実行するコマンド |
|---|---|
| 「業務的意味を AI に埋めてほしい」 | `yohaku explain-prompts --output prompts.json` → 回答を集約し `fill.json` → `yohaku html-write --input fill.json` |
| 「ブラウザで設計書を見たい」 | `yohaku serve --port 4000` (開発中は `--watch` で自動 reload) |
| 「このリリースの変更点をレビューしたい」 | `yohaku diff --from <ref> --to HEAD --format html` |
| 「テストカバレッジを設計書に載せたい」 | `sf apex run test --code-coverage --result-format json > coverage.json` → `yohaku coverage import --input coverage.json` |
| 「業務フロー全体を俯瞰したい」 | `yohaku serve` → ホーム 2 番目の「業務フロー」タブ |

- `html-write` は書き戻し前に `--dry-run` で rejected が無いことを必ず確認する
- `serve` でブラウザのホームが開けば一通りのスモークテストは PASS

## Editing AI-managed sections

業務的意味づけ / 既知の懸念は HTML 内の `<!-- yohaku:block kind="ai_managed" id="..." start -->` ブロックでのみ編集する。決定的セクションには触らない。

## Never do

- `force-app/` 配下の生 XML を直接 grep して dependencies を導出する (`yohaku graph query` を使う)
- HTML 出力ファイルを手書き編集する (再生成で消える。編集マーカーブロックのみ可)
- `--strict` を回避するために要件を曲げる (12 セクションは必須仕様)
