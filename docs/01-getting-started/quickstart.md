# Quickstart — yohaku を初めて使う

> 想定読者: Salesforce DX プロジェクトに **yohaku を導入する利用者**
> 所要時間: **30 分以内**

---

## 0. 前提

- macOS / Linux (Windows は Phase 7 で正式対応予定)
- Node.js **20 以上** (`node --version`)
- Salesforce CLI **(`sf`) グローバルインストール済み** (`sf --version`)
- Claude Code (デスクトップ or CLI) が動く環境

---

## 1. core のインストール

### 方法 A: npm からグローバル導入（推奨）

```bash
npm install -g @yohakuforce/core
which yohaku
yohaku --version
```

これだけで `yohaku` コマンドがどこからでも呼べる状態になる。

### 方法 B: `npx` で 1 回だけ試す

導入をコミットしたくない場合:

```bash
npx -p @yohakuforce/core yohaku --version
npx -p @yohakuforce/core yohaku init --bootstrap --profile minimal
```

### 方法 C: ソースからビルド（コントリビュータ向け）

OSS への貢献やローカル開発を行いたい場合のみ。詳細は [`CONTRIBUTING.md`](../../CONTRIBUTING.md) 参照。

```bash
git clone https://github.com/yohakuforce/core yohakuforce
cd yohakuforce
npm install
npm run build
npm link --workspace @yohakuforce/core
```

---

## 2. Salesforce DX プロジェクトの準備

すでに `sfdx-project.json` があるプロジェクトなら **そのまま使えます**。

まだ無い場合は、Dev Edition org からメタデータを取得する手順を [`dev-edition-setup.md`](./dev-edition-setup.md) で確認してください。

動作確認用のサンプルプロジェクトはリポジトリの [`examples/sample-project/`](https://github.com/yohakuforce/core/tree/main/examples/sample-project) にあります。手元で動かしたい場合は以下で取得できます。

```bash
# サンプルだけ欲しい場合
git clone --depth 1 https://github.com/yohakuforce/core /tmp/yohakuforce-src
cp -r /tmp/yohakuforce-src/examples/sample-project ./my-yohaku-trial
cd my-yohaku-trial
```

---

## 3. `yohaku init --bootstrap` で 1 コマンド完了 (推奨)

```bash
yohaku init --bootstrap --profile minimal --project-name my-trial --language ja
```

これだけで scaffold 展開 + `graph build` + `render` が完了する。
個別実行したい場合は `--bootstrap` を外して `yohaku init` のみにし、後から `yohaku graph build` `yohaku render` を別途叩く。

展開される構成:

```
my-trial/
├── CLAUDE.md            ← Claude Code 用の憲法 (eta 展開済)
├── AGENTS.md            ← 自律ループ指示書
├── .claude/
│   ├── settings.json    ← hooks + 権限
│   ├── commands/        ← /onboard, /explain, /impact
│   └── agents/          ← graph-querier, object-documenter, ...
├── .agents/
│   ├── knowledge/       ← INDEX.md + decisions/pitfalls/wins/improvements/retrospectives/
│   └── templates/       ← decision.md, pitfall.md, ...
├── .yohaku/
│   └── secrets-rules.yaml ← マスキングルール (デフォルト + カスタム可)
└── .gitignore
```

プロファイル選択:
- `minimal`: コア 3 コマンドのみ (Phase 1 構造化)
- `standard`: + 差分分類 + persona 別 onboarding (Phase 3 以降)
- `full`: + リリース準備 + DX MCP アダプタ (Phase 4-6 で順次)

---

## 4. 知識グラフ構築 (--bootstrap で実行済の場合は不要)

`--bootstrap` を使った場合は既に完了しているのでスキップ可。個別に走らせるなら:

```bash
yohaku graph build
```

成功すると `.yohaku/graph.sqlite` が生成される。出力例:

```
[yohaku] graph build complete: objects=12 fields=145 flows=8 apex=23
```

トラブルシュート:
- `objects=0` → `force-app/` の場所を確認、または `sfdx-project.json` の `packageDirectories` を確認
- 大規模 org で時間がかかる → 初回はフルビルド (5,000 オブジェクトで 10 秒目安)、以降は `--incremental`

---

## 5. 日常運用: `yohaku sync` 1 コマンドで再構築

`force-app/` を編集した後の再構築は `yohaku sync` 1 つで OK:

```bash
yohaku sync
# 内部で graph build --incremental + render を実行
```

完全再ビルドが必要なら `yohaku sync --full-rebuild`。

---

## 6. グラフへの SQL クエリで検証

```bash
yohaku graph query "SELECT fqn, label FROM objects ORDER BY fqn LIMIT 10"
yohaku graph query "SELECT object, COUNT(*) AS cnt FROM fields GROUP BY object ORDER BY cnt DESC LIMIT 5"
```

---

## 7. 派生ドキュメントを描画 (個別)

`sync` で全描画されるが、個別にしたい場合:

```bash
yohaku render             # system-index + objects 全描画
yohaku render system-index
yohaku render objects
```

出力:
- `docs/generated/system-index.md` — プロジェクト全体像
- `docs/generated/objects/<Name>.md` — 各オブジェクト詳細

---

## 7. Claude Code から使う

`my-trial/` を Claude Code で開き、persona に応じて使い分け:

### 全 persona 共通

```
/onboard               # new_joiner 既定
/onboard --role reviewer
/onboard --role release_manager
/onboard --role customer_facing
/explain Account
/impact Account
```

| persona | 主用途 |
|---|---|
| new_joiner | 段階的に主要ドメインを理解 (30 分) |
| reviewer | 直近 PR を 5 分で要約 + レビュー観点 5 件 |
| release_manager | 直近 release_doc の抜け漏れ + 依存順序チェック |
| customer_facing | 技術 → 業務翻訳 + ロール別影響整理 + 想定 FAQ |

### standard 以上

```
/classify-diff --from main --to HEAD     # 7 分類で意味づけ
/change-summary                            # PR レビュー用 Markdown 生成
```

### full のみ

```
/release-prep --from v1.0.0 --to v1.1.0   # 6 セクションのリリース doc
/manual-steps                               # 手動作業レジストリ参照
```

---

## 8. オンボーディング進捗 / FAQ 蓄積 (Phase 5)

```bash
# 進捗記録
yohaku onboard state record-step --role new_joiner --step "session-start"

# 質問数カウント
yohaku onboard state increment-questions --role new_joiner

# 進捗確認
yohaku onboard state show

# 対話ログから FAQ 抽出 (PII マスキング込み)
yohaku onboard faq extract --input dialogs.md --topic general
```

`.yohaku/context-map.yaml` を編集すれば、persona 別の読み順を利用者プロジェクトに合わせて調整できる。

---

## 9. メトリクスの確認

```bash
yohaku metrics show --period month
yohaku metrics record --model claude-sonnet-4-6 --command /onboard --in 1500 --out 800
```

---

## 10. 差分意味づけ (Phase 3)

```bash
yohaku diff --from main --to HEAD --json
yohaku diff --from main --to HEAD --include-static-analysis report.sarif
```

---

## 困ったとき

- ビルドが失敗 → コンソールメッセージを確認、[`SECURITY.md`](../../SECURITY.md) のフローでバグ報告
- 機密情報マスキングを調整したい → `.yohaku/secrets-rules.yaml` を編集
- 依存解析がおかしい → `yohaku graph query "SELECT * FROM dependencies WHERE ..."` で生データ確認
- AI コストが高い → minimal プロファイルへ降格、または hooks を無効化
- バグ報告 → [`/SECURITY.md`](../../SECURITY.md) のフロー
