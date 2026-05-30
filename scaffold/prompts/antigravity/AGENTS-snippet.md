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

## Diagram fallback

HTML ホームのアーキテクチャ図は Mermaid → HTML/CSS の 2 段構え。
Mermaid が読み込めない・崩れる環境では自動で HTML 表示に切り替わります。
ユーザーから「図が見づらい」と言われたら "HTML (safe)" ボタンに誘導してください。
