# yohakuforce

**Salesforce に携わるすべての人へ、本物の価値を届けるための AI 駆動基盤 OSS**

[![CI](https://github.com/yohakuforce/core/actions/workflows/ci.yml/badge.svg)](https://github.com/yohakuforce/core/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Tests: 501 passing](https://img.shields.io/badge/Tests-501%20passing-brightgreen.svg)](./packages/core/)

---

## クイックスタート

### 利用者向け (npm から導入)

```bash
# Node.js 20 以上が必要
npm install -g @yohakuforce/core
yohaku --version

cd /path/to/your-salesforce-project
yohaku init --bootstrap --profile minimal
```

`npx` で 1 回だけ試したい場合:

```bash
cd /path/to/your-salesforce-project
npx -p @yohakuforce/core yohaku init --bootstrap --profile minimal
```

30 分で導入完了する詳細手順: [`docs/01-getting-started/quickstart.md`](./docs/01-getting-started/quickstart.md)

### v0.5.0 の目玉: HTML 設計書パイプライン

同じ知識グラフから「AI が読む Markdown」と「人間がレビューする HTML 設計書」を二系統で生成し、ブラウザでプレビューできる。

```bash
# Markdown と HTML を同時生成 (docs/generated/html/index.html がホーム)
yohaku render --format md,html

# ローカルサーバで開く。--watch でソース変更時に自動 rebuild + ブラウザ自動 reload
yohaku serve --port 4000 --watch

# LLM にブロックを充填させる prompt+context を一括生成 → 書き戻し
yohaku explain-prompts --output prompts.json
yohaku html-write --input fill.json
```

生成される HTML は Apex / Trigger / LWC / Object / Flow の component leaf、Cmd+K グローバル検索、業務フロー俯瞰タブ、Mermaid/HTML フォールバック描画を備える。リリースレビュー用の差分 HTML (`yohaku diff --format html`) とテストカバレッジ統合 (`yohaku coverage import`) も同梱。

### コントリビュータ向け (ソースから)

OSS への貢献やローカル開発を行う場合は [`CONTRIBUTING.md`](./CONTRIBUTING.md) を参照。`git clone` + `npm install` + `npm run build` のフローを記載している。

---

## このプロジェクトの存在理由

「SaaS は死ぬ」と語られる時代に、Salesforce は依然として大企業の基幹に在り続けている。
その理由はシンプルで、**「同じシステムにデータを持続的に蓄え、信頼性のもとで活用する」**という、AI 時代になっても変わらない本質的な要請があるからだ。

しかし現場には、見過ごされてきた構造的な課題が積み重なっている。

- **大企業**: AI 機能を備えた Salesforce を信頼して使い続けたいが、属人化と運用負荷が膨らみ続ける。
- **中小企業**: Salesforce を導入したものの、保守運用にリソースを割けず、価値を引き出しきれない。
- **ベンダー / SIer**: 個々のプロジェクトで AI 駆動開発の知見が再現せず、毎回ゼロから手探りになる。

yohakuforce は、この 3 者が抱える課題を、**Salesforce に特化した AI 駆動の OSS 基盤**として一気通貫に解く。

そして、Salesforce に携わる人々の **時間と余白** を生み出し、その余白がもたらす **生活の豊かさ・ストレスの削減・ウェルネス** までを射程に入れる。
これは単なる開発ツールではなく、**人の生活を豊かにするための架け橋** として設計されている。

---

## コンセプト

> **「人手の運用を、AI が高品質に肩代わりする。人間は顧客折衝と本質的判断にだけ時間を使う。」**

そのために、本 OSS は次の 3 つの層を厳格に分離する。

| 層 | 担当 | 思想 |
|---|---|---|
| 決定的処理層 | `yohaku` CLI (TypeScript) | 同じ入力には必ず同じ出力。再現性が命。 |
| AI エージェント層 | Claude Code / Antigravity | 曖昧さと判断は AI に委ねる。生データは読ませない。 |
| 人手補完層 | 人間 | 業務意図、顧客固有ルール、最終承認。AI が侵さない聖域。 |

設計の全詳細は [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md) に在る。

---

## 解く中核課題

1. **属人化の解消** — 仕様を知らない人が、AI との対話だけで全体像を理解できる。
2. **運用タスクの自動化** — ドキュメント整備、差分意味づけ、レビュー観点、リリース資材、手動作業管理を AI が構造化してこなす。
3. **AI 駆動開発の再現性** — ベンダーが現場間で知見を持ち運べる、共通の基盤と作法を提供する。

---

## ゴール (段階的)

| 段階 | リリース | ゴール |
|---|---|---|
| 内部検証 (基盤) | v0.1.0 ✅ | 知識グラフ + CLI + Claude統合 + 差分意味づけ + 手動作業管理 + オンボーディング + Plugin化 |
| 内部検証 (拡充) | v0.2.0 ✅ | ドキュメント完全化 (21 メタデータ種対応) + 処理フロー可視化 + AI 文面生成基盤 |
| **内部検証 (実証)** | **v0.3.0 (次)** | **現参画プロジェクトでの実利用 + KPI 計測 + 既知 pitfalls の解消** |
| 社内展開 | v0.4.0+ | 社内の他プロジェクトへの展開、フィードバック反映 |
| 社外展開 | v1.0.0+ | OSS 公開、コンサル導入、コミュニティ運営 |

### 内部検証完了の Definition of Done

「内部検証完了 = v1.0.0 候補入り」の判断条件として、以下 5 項目のうち **3 項目以上** で達成されること:

1. 現参画プロジェクトで `yohaku sync` を 4 週連続で週次運用
2. 利用者主観: 「資料更新が不要、ソースが正本」と実感 (5 段階で 4 以上)
3. 運用タスク AI 任せ可能比率 60% 以上
4. 1 機能あたりリリース準備時間 50% 短縮
5. 手動作業見逃し件数 0 / リリース

**この DoD を満たすまでは技術拡張ではなく実利用に注力する。**

詳細リリース計画 / Phase スコープ規律は [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md) と [`AGENTS.md` § 3](./AGENTS.md#3-phase-スコープ規律) を参照。

---

## 役割の定義

| ロール | 担当 |
|---|---|
| **オーナー (人間)** | 価値判断、優先度決定、顧客文脈の供給、最終承認 |
| **AI 主エージェント** | 要件整理 → 実行 → 自己レビュー → 修正 → 再実装 → 整理 → 課題提起 の自律ループを回す |
| **AI サブエージェント** | コンテキスト隔離が必要な深い解析、並列処理、専門領域レビュー |
| **CLI (`yohaku`)** | 決定的処理。AI が踏み外さないためのガードレール。 |
| **ナレッジベース (`.agents/knowledge/`)** | 過去の判断・つまずき・改善・成功を蓄え、AI が参照して自己改善する |

---

## リポジトリ構成

本リポジトリは **2 つの層** を物理的に分離している。詳細は [`IMPLEMENTATION_GUIDE.md` § メタ層と配布物層の分離](./IMPLEMENTATION_GUIDE.md#メタ層と配布物層の分離) 参照。

### メタ層 — 本 OSS を **開発する側** が使う

| ファイル / ディレクトリ | 用途 | 読む人 |
|---|---|---|
| [`README.md`](./README.md) | プロジェクトの存在理由とゴール (この文書) | 全員、特に新規参画者 |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code への憲法 (軽量、参照中心) | 開発時の Claude Code |
| [`AGENTS.md`](./AGENTS.md) | AI 自律ループの行動指針とナレッジ運用 | 開発時の全 AI エージェント |
| [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md) | 実装方針の正本 | 実装者 |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | 貢献ガイド (自律ループに合流する方法) | コントリビュータ |
| [`SECURITY.md`](./SECURITY.md) | 脆弱性報告フローと脅威モデル | セキュリティ研究者 / コントリビュータ |
| [`LICENSE`](./LICENSE) / [`NOTICE`](./NOTICE) | Apache License 2.0 と帰属表示 | 全員 |
| [`package.json`](./package.json) | monorepo ルート (workspaces / 依存) | 開発者 |
| [`.claude/`](./.claude/) | 開発時の Claude Code 設定・コマンド・サブエージェント | 開発時の Claude Code |
| [`.agents/knowledge/`](./.agents/knowledge/) | 永続ナレッジ (判断 / 改善 / つまずき / 成功 / 振り返り) | 開発時の AI / 人間 |
| [`.github/workflows/`](./.github/workflows/) | CI ワークフロー (lint / typecheck / test) | CI / コントリビュータ |

### 配布物層 — OSS を **導入した利用者** に届く

| ディレクトリ | 用途 | 構築 Phase |
|---|---|---|
| [`scaffold/`](./scaffold/) | `yohaku init` で利用者プロジェクトに展開されるひな型 | Phase 2〜6 |
| [`claude-plugin/`](./claude-plugin/) | Claude Code Plugin 形式での配布 | Phase 6 |
| [`examples/`](./examples/) | サンプル / 動作確認用プロジェクト (顧客固有情報禁止) | Phase 6 |
| [`docs/`](./docs/) | 利用者向け公開ドキュメント | Phase 6 を中心に各 Phase で育成 |

### ソース・テスト

| ディレクトリ | 用途 |
|---|---|
| [`packages/`](./packages/) | OSS 本体ソース (monorepo, `core` 他) |
| [`tests/golden/`](./tests/golden/) | ゴールデンテスト (再現性ガバナンス層 3) |

---

## ライセンス

[Apache License 2.0](./LICENSE) (2026-05-07 確定)。帰属表示は [`NOTICE`](./NOTICE) を参照。

---

## 最後に

このプロジェクトは、**Salesforce に携わる人たちの生活を豊かにする**ことを最終目的に据える。
コードを書くのが目的ではなく、「人の余白を生み出す」ことが目的だ。
迷ったら、その判断が誰かの余白を増やすかどうかで決める。
