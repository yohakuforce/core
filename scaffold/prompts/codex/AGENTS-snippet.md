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

## Editing AI-managed sections

業務的意味づけ / 既知の懸念は HTML 内の `<!-- yohaku:block kind="ai_managed" id="..." start -->` ブロックでのみ編集する。決定的セクションには触らない。

## Never do

- `force-app/` 配下の生 XML を直接 grep して dependencies を導出する (`yohaku graph query` を使う)
- HTML 出力ファイルを手書き編集する (再生成で消える。編集マーカーブロックのみ可)
- `--strict` を回避するために要件を曲げる (12 セクションは必須仕様)
