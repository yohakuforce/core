# yohaku in Antigravity — Operating Snippet

> このファイルは Antigravity 用のプロンプト断片です。プロジェクト root の
> `AGENTS.md` に取り込んでください。

## Tooling priorities

Antigravity の場合、自律実行が長いのでまず **「何を調べるか」と「どう動くか」の境界**を
意識してください。

| 種類の問い | 適したツール |
|---|---|
| トポロジー (どこにあるか / どう繋がる) | yohaku graph query / yohaku impact |
| セマンティクス (何をしているか) | ソースを直接 Read |

## Quick start

```bash
yohaku init --bootstrap
yohaku graph build
yohaku render --format md,html
open docs/generated/html/index.html
```

## Build modes

- **Local**:  `yohaku render --format md,html`
- **Org**:    `yohaku graph build --source org` → `yohaku render --format md,html`
- **Filter**: `yohaku render --format md,html --types apex,trigger`

## Domains (Phase 5)

業務ドメインで HTML の index 階層を束ねるには:

```bash
yohaku domains init     # 初期案を YAML に書き出し
# ── YAML を手で見直しコミット ──
yohaku domains lint     # 重複・多重所属の検査
yohaku render --format html  # ホームの "ドメインマップ" に反映される
```

## New workflows (Phase 8〜15)

長時間の自律実行に向いているので、生成 → 充填 → 確認まで一気通貫で回せます:

```bash
# 1. LLM 充填: prompt 生成 → (自分で回答を埋める) → 書き戻し
yohaku explain-prompts --output prompts.json
yohaku html-write --input fill.json --dry-run    # まず dry-run で rejected を確認
yohaku html-write --input fill.json

# 2. リリースレビュー HTML
yohaku diff --from <ref> --to HEAD --format html

# 3. テストカバレッジ取込
sf apex run test --code-coverage --result-format json > coverage.json
yohaku coverage import --input coverage.json

# 4. ローカルプレビュー (自律実行の最後に人間へ渡す導線)
yohaku serve --port 4000 --watch
```

- 自律ループで render を繰り返しても AI-managed ブロックの充填は保持される (preservation)
- watch モードは長時間セッションと相性が良い (保存のたびに自動再生成 + reload)

## Diagram fallback

HTML ホームのアーキテクチャ図は Mermaid → HTML/CSS の 2 段構え。
Mermaid が読み込めない・崩れる環境では自動で HTML 表示に切り替わります。
ユーザーから「図が見づらい」と言われたら "HTML (safe)" ボタンに誘導してください。
