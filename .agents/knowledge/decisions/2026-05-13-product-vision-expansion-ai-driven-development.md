---
type: decision
date: 2026-05-13
title: 製品ビジョン拡張 — 運用 AI 化から AI 駆動開発ライフサイクル全体へ
status: active
tags: [vision, north-star, scope-expansion, ai-driven-development, sier-persona, oss, context-layer, naming, yohakuforce, ai-provider-abstraction]
---

# 製品ビジョン拡張 — 運用 AI 化から AI 駆動開発ライフサイクル全体へ

> **Status: active** (2026-05-13 メンテナー承認)
> 関連: [`decisions/2026-05-13-long-term-roadmap-draft.md`](./2026-05-13-long-term-roadmap-draft.md)
> AGENTS.md / README.md / IMPLEMENTATION_GUIDE.md / CLAUDE.md への本文反映は v0.3.0 完了後 (2026-06-15 週以降)。

## サマリ (1 文)

yohaku の北極星を **「運用 AI 化」から「Salesforce 開発ライフサイクル全体の AI 駆動化」** に拡張し、メインペルソナを **コンサル / SIer** に絞る。既存 OSS の空白を埋める「組織を知識グラフ化する基盤」として位置付け、AI エージェントを "Salesforce を知る AI" から "あなたの組織を知る AI" へ進化させる。

---

## 北極星の Before / After

### Before (v0.2.0 まで)

> Salesforce に携わる人々の時間と余白を生み出すため、属人化と運用負荷を AI で構造的に解消する OSS 基盤を作る。

### After (本 ADR で提案)

> Salesforce 開発に携わる人々の余白を生み出すため、**要件定義から実装・テスト・運用まで** の開発ライフサイクル全体を、**組織特有の文脈まで理解した AI エージェント** が駆動できる OSS 基盤を作る。
>
> 既存 OSS (公式 SDK / Code Analyzer / Salesforce CLI / DX MCP) の上に「組織を完全に知識グラフ化する基盤」を載せ、Salesforce の使い方を知る AI を、**組織特性に精通した AI へ進化** させる。

**変更点の本質**:
- スコープ: 運用 → **開発ライフサイクル全体**
- AI の到達点: 一般的な Salesforce 知識 → **組織固有の業務ロジック理解**
- 既存 OSS との関係: 分業 → **取り込み・空白埋め**

---

## メインペルソナ (Primary Persona)

**コンサル / SIer (Salesforce 導入プロジェクトを担当する立場)**

具体像 (メンテナー自身の現状と一致):
- 顧客の事業部 / 子会社に Salesforce を導入するプロジェクトを担当
- プロジェクト立ち上げ → 要件定義 → 設計 → 実装 → テスト → リリース → 並行運用 → 引き継ぎ までを担う
- 複数顧客で **再利用可能な基盤** が欲しい
- 顧客の業務文脈を理解して提案する必要がある (議事録・要件メモ・ステークホルダー会話が生命線)
- 案件ごとにゼロから組む比重が高い

### なぜこのペルソナか (他候補との比較)

| ペルソナ | 採否 | 理由 |
|---|---|---|
| **コンサル / SIer (本案)** | 採用 | メンテナー自身の立場と一致 → 痛みを正確に把握できる、AI 駆動開発との相性が極めて良い (新規案件多数 / 要件起点) |
| 社内 SF チーム (運用フォーカス) | 二次 | L1+L2 (影響範囲) は効くが、L3〜L5 の価値は薄い。v1.0 後の横展開対象 |
| ソロ Admin / Consultant | 二次 | config 中心で AI 駆動開発の価値が一部に限定。Adapter として後で対応 |
| 内製 PdM (要件起点) | 二次 | L3 単独だと完成しないので、SIer の延長で吸収可能 |

### このペルソナ選択が生む設計上の含意

- **要件定義 → 設計 → 実装** の流れが核 → L3+L4+L5 が事業価値の中核
- **議事録 / 顧客 Slack / 要件メモ** の取り込みが生命線 → コンテキスト層の重要度が高い
- 複数顧客で再利用 → **組織非依存の抽象** と **組織固有の表現** の両立が必須 (HUMAN_MANAGED 領域の価値が増す)
- L1+L2 (影響範囲特定) は引き継ぎ・追加改修フェーズで価値が出る → 主軸の後 (v0.5.0)

→ ロードマップは [`2026-05-13-long-term-roadmap-draft.md`](./2026-05-13-long-term-roadmap-draft.md) で詳細化。

---

## 4 つの柱

### 柱 1: スコープ拡張 (運用 → 開発ライフサイクル全体)

開発ライフサイクルを 6 層に分解する:

| 層 | 名称 | 内容 | 既存 yohaku (v0.2) との距離 |
|---|---|---|---|
| L1 | **影響範囲特定** | 改修対象から依存先を辿る | 近い (graph query 拡張) |
| L2 | **実装範囲特定** | 要件文 → 触るべき資材特定 | やや近い (NLP + graph) |
| L3 | **要件構造化・抜け漏れ検出 AI 支援** ※ | 議事録 / 要件メモ → 構造化、整合チェック | 遠い (context_sources 基盤必要) |
| L4 | **設計 AI 駆動** | データモデル / オブジェクト / フロー設計 | 遠い |
| L5 | **実装 AI 支援 → 実装 AI 駆動** | Apex / Trigger / Flow / LWC 生成 + レビュー | 遠い (最難関) |
| L6 | **テスト AI 駆動** | テストケース / テストデータ生成 | 中 (graph 活用) |

※ L3 は当初「要件定義 AI 駆動」としていたが、過剰宣伝を避けるため **「要件構造化・抜け漏れ検出 AI 支援」** に弱める。要件そのものを決めるのは人間。AI ができるのは構造化・整合性チェック・抜け漏れ検出に限定する。

### 柱 2: 対象者拡張 (運用者 → 開発ライフサイクル全関与者)

メインペルソナ (SIer) を起点に、以下の役割が間接的にも yohaku の出力を消費できる:

- プロジェクトリーダー (案件マネジメント)
- 開発者 (設計・実装)
- QA / テスト担当
- 引き継ぎ後の運用チーム
- 顧客側ステークホルダー (生成資料の最終消費者)

ただし v1.0.0 時点での **直接的なユーザー体験は SIer に最適化** する。他ペルソナは v1.x 以降の横展開対象。

### 柱 3: 既存 OSS との関係 — 分業ではなく取り込み

**Salesforce エコシステムの現状**:

| 機能 | 提供している OSS / 公式ツール | yohaku との関係 |
|---|---|---|
| メタデータの型理解 | Salesforce 公式 SDK (`@salesforce/source-deploy-retrieve`) | **取り込み** (extract 層で利用) |
| コード品質静的解析 | Code Analyzer v5 | **取り込み** (SARIF 経由で classifier 入力に統合済み) |
| ソース ↔ 組織のやりとり | Salesforce CLI / DX MCP | **取り込み** (DX MCP アダプタ済み) |
| **組織を完全に知識グラフ化する基盤** | **空白** | **← ここが yohaku の位置** |
| 汎用 AI コーディング | Cursor / Copilot / Claude Code 等 | **共存** (yohaku は context provider として動く) |

**取り込み原則**:
- 既存 OSS が解決している領域を yohaku が再実装しない (フォーク禁止)
- adapter / アダプタパターンで疎結合に接続
- 既存 OSS の出力を **AI が消費しやすい形に正規化** (= yohaku の付加価値)
- 既存 OSS が提供しない「組織固有文脈」の層に専念

### 柱 4: AI エージェントの進化 — 一般知識から組織知識へ

**Before**: 汎用 LLM + Salesforce ドキュメント (公式)
- "Salesforce の使い方は知っているが、あなたの組織のことは知らない AI"
- 例: 一般的な Apex のベストプラクティスは答えられるが、`ExampleApexTriggerHandler` の業務的役割は知らない

**After**: yohaku 知識グラフ + AI エージェントルール + 組織コンテキスト
- "あなたの組織の特性とビジネスロジックに精通した AI"
- 例: 「`Account.Outstanding_Balance__c` の算出ロジックを変更すると影響範囲は X / Y / Z、過去の議事録で議論された懸念は…」と答えられる

**進化の経路**:
1. ソース知識グラフ (v0.2 で達成済み)
2. 文脈付きドキュメント生成 (v0.2 で達成済み)
3. 影響範囲・実装範囲特定 (v0.5 で達成予定)
4. 要件・設計・実装・テストへの拡張 (v0.6〜v0.10)
5. 顧客コンテキスト取り込み (コンテキスト層、v0.4 から独立トラックで並走)

---

## OSS で進める理由

本プロジェクトを OSS として育てる **明示的な理由**:

1. **コマンドベースで簡単に基盤構築できるようにするため**
   - SIer / コンサルが新規案件着手時に `yohaku init --bootstrap` 1 コマンドで開始できる
   - クローズドだと配布・更新・依存解決のコストが顧客 / SIer に転嫁される

2. **社内にとどめず、どんな人にも価値を届けたい**
   - Salesforce 開発の余白創出は全 SIer / 社内チーム / Admin に共通の課題
   - 1 社内に閉じると価値の最大化ができない

3. **改善はみんなでしていきたい / いろんな人の意見にこそ価値がある**
   - メタデータの型は標準化されているが、業務適用パターンは多様
   - コミュニティからの adapter / pattern / 業界別テンプレ寄贈で yohaku の知識基盤が拡張する
   - 利用者 ≠ 開発者 という構造を取らない

### OSS が罠になりうるリスクと対処

| リスク | 対処 |
|---|---|
| 維持コスト (issue / PR / ガバナンス) で開発が止まる | コア・adapter を分離、コアは少人数で守る。adapter は寄贈受け入れ |
| 商業 fork で価値が分散 | Apache 2.0 を維持しつつ、商標 (yohaku 名) は別途保護を将来検討 |
| 「OSS = 無料」期待で BtoB 値付け困難 | OSS は基盤、サポート / プロ機能 / 商用ホスティングで収益化する分離設計を v1.x で検討 |
| OSS が目的化する | **本 ADR で OSS の理由を 3 つ明示** したのでこれが拠り所。理由が薄れたら見直す |

---

## L3 表現の弱め (過剰宣伝の回避)

当初「要件定義 AI 駆動」と表現していたが、本 ADR で **「要件構造化・抜け漏れ検出 AI 支援」** に弱める。

**理由**:
- 要件は文書から抽出できるものではない (ステークホルダー対立・優先度シフト・規制制約・ベンダー関係から創発する)
- AI ができるのは限定的:
  - ✅ 要件の構造化 (議事録 → 構造化リスト)
  - ✅ 抜け漏れ検出 (このオブジェクトには論理削除がない、等)
  - ✅ 整合性チェック (旧仕様と矛盾)
  - ❌ **要件そのものを決める** (これは人間の仕事)
- 「AI 駆動の要件定義」と謳うと利用者が後者を期待 → 期待を裏切ると信頼が一気に落ちる
- ペルソナ (SIer) は要件定義の難しさを知っている層 → 過剰宣伝は逆効果

**ロードマップ反映**: v0.6.0 のテーマは **「要件構造化支援」** (要件定義ではない)。

---

## ベストプラクティスは外部参照、yohaku は定義しない

yohaku 自身が「これが Salesforce のベストプラクティス」と言い切らない。

**理由**:
- ベストプラクティスは Salesforce 公式 / Trailhead / SI 各社 / OSS コミュニティでバラつく
- yohaku が定義すると越権 / 古びる / コミュニティ衝突
- 組織固有の慣習は HUMAN_MANAGED 領域で表現する設計が既にある

**実装方針**:
- ベストプラクティス参照は **外部リソースへのリンク** (公式ドキュメント / Code Analyzer ルール ID / Trailhead モジュール) として提示
- yohaku はベストプラクティス違反の **検出** はする (Code Analyzer 経由) が、定義はしない
- 組織固有の慣習 (例: "このプロジェクトでは Trigger を直接書かず Handler 経由") は HUMAN_MANAGED 領域に書き、AI はそれを読んで尊重する

---

## コンテキスト層 — 独立軸 + 完璧統合

### 設計判断

コンテキスト層 (議事録 / Slack / Gmail / 会議文字起こし) は **線形ロードマップ ladder から外し、独立トラック** として並走する。ただし「独立 = 切り離す」ではなく、**統合 API を v0.4.0 で先に固める**。

### 統合 API: `context_sources` テーブル (.yohaku/graph.sqlite 内)

```
context_sources
├── id           — uuid
├── type         — meeting_minutes / slack / gmail / requirement_memo / otter
├── source_ref   — ファイルパス / Slack channel ID / Gmail thread ID
├── raw_content  — 原文 (匿名化済み)
├── structured   — 構造化 JSON (発言者 / トピック / 決定事項 / 未決事項 / 関連メタ)
├── linked_to    — 関連する apex_classes / sobjects / flows の id 配列
├── confidence   — AI が抽出した構造の信頼度
└── recorded_at  — 取り込み時刻
```

### AI エージェントとのインターフェース

- AI は **`yohaku graph query` 経由でのみ context を取り出す** (直接 Slack / Gmail を読まない = 3 層分離維持)
- 例:
  ```sql
  SELECT * FROM context_sources
  WHERE linked_to LIKE '%InvoiceTriggerHandler%'
  ORDER BY recorded_at DESC
  ```
- AI が context_sources を見たかどうかは metrics で計測可能 (DoD 用)

### Adapter パターンで取り込み元を独立開発

```
adapters/
├── meeting-minutes-file/   — Markdown / docx の議事録ファイル (v0.5 で先行 = 最も低リスク)
├── slack-mcp/              — Slack MCP 経由 (v0.7〜)
├── gmail-mcp/              — Gmail MCP 経由 (v0.8〜)
└── otter-meeting/          — Otter.ai / Zoom 文字起こし (v0.9〜)
```

各 adapter は **独立リポジトリ的に開発可能**。コア (core) は context_sources の読み書き API だけを提供。

### この設計が「完璧統合」を成立させる理由

1. `context_sources` 抽象を **v0.4.0 で固める** ので、すべての L1〜L6 機能が同じ API で context にアクセス
2. Adapter は独立開発 → 本流ロードマップを止めない
3. L3 (要件構造化支援) は context_sources の `structured` を直接食う → コンテキスト層の進化が L3 の質を自動的に上げる
4. 取り込み元が増えても AI エージェント側の変更はゼロ (graph query で吸収)
5. **セキュリティ境界が明確** (顧客 Slack / Gmail へのアクセス権は adapter 側に閉じる)

### セキュリティ / プライバシー原則

- context_sources の `raw_content` は **匿名化または要約** された形のみ保存
- 顧客固有の機微情報 (顧客名 / 取引額 / 個人名) は adapter 取り込み時にマスキング
- adapter には **読み取り権限のみ** を渡す (書き込み禁止)
- 顧客承認なしに Slack / Gmail を読まない (adapter の有効化は明示的 opt-in)

---

## 設計 3 原則の維持

新ビジョンでも、yohaku の DNA である **設計 3 原則** は維持する:

1. **3 層分離** — 決定的処理 (CLI) / AI 判断 / 人手補完 を混ぜない
2. **正本は実装側** — `force-app/` と Git が正本、Markdown は派生物
3. **AI に生データを読ませない** — XML / Slack / Gmail を直接読まず、必ず知識グラフ経由

新規追加される L3〜L6 / コンテキスト層も、すべてこの 3 原則に準拠して設計する。

---

## 1 バージョン = 1 North Star 原則 (Phase 7→15 トラウマ対策)

ビジョン拡張に伴い、計画の射程が広くなる。**Phase 規律 §3 (2026-05-10 ADR) を補強する原則** を追加:

> **1 バージョン (v0.x.0) = 1 つの North Star = 1 つの Phase**。
> 隣のバージョンに目移りしない。当該バージョン着手時は、本ビジョン ADR ではなく **当該バージョンの Phase ADR** を判断軸とする。

これは AGENTS.md §3 への追記候補。v0.3.0 完了時に反映を検討する。

---

## AGENTS.md / README.md / IMPLEMENTATION_GUIDE.md への反映時期

**v0.3.0 完了後 (2026-06-15 週以降)** にまとめて反映する。

**理由**:
- 本 ADR は **draft** 段階。v0.3.0 期間中に追加発見が出る可能性
- 北極星文言を v0.3.0 期間中に変えると、内部検証の判定基準がブレる
- Week 1〜4 ヒアリングで「拡張ビジョン」を裏付ける利用者発言を収集できる可能性 → ADR 強化材料

**反映する文書**:
- `README.md` (北極星 1 文の更新、4 つの柱の要約)
- `AGENTS.md` (§ 0 大前提の更新、§3 に「1 バージョン = 1 North Star」追記)
- `IMPLEMENTATION_GUIDE.md` (Phase スコープ、6 層の枠組み、ロードマップ参照)
- `CLAUDE.md` (15KB 上限内で参照リンクのみ更新)

---

## 代替案

| 案 | 採否 | 理由 |
|---|---|---|
| **A. 本案 (運用 + 開発ライフサイクル全体に拡張、SIer ペルソナ、独立コンテキスト層)** | 採用 | メンテナー申告のビジョンと整合、Salesforce のメタデータ標準化が AI 駆動を tractable にする、SIer ペルソナで価値最大化 |
| B. 運用フォーカスを維持し、開発 AI 駆動は別 OSS にする | 却下 | 知識グラフを 2 重持ちする無駄、組織理解の連続性が切れる |
| C. ペルソナを「Salesforce 開発全関与者」のまま広くする | 却下 | 誰にも刺さらない罠 (ChatGPT for everything パターン) |
| D. L3 を「要件定義 AI 駆動」表現で維持 | 却下 | over-promise リスクが高すぎる、信頼失墜の代償が大きい |
| E. コンテキスト層を線形 ladder の最後 (v1.x) に置く | 却下 | SIer ペルソナで生命線、後回しにできない / 統合 API を最初に固めれば独立軸で十分 |
| F. ベストプラクティスを yohaku が定義 | 却下 | 越権 / 古びる / コミュニティ衝突 |

---

## トレードオフ (本案を採ることで生じるコスト)

- **執行コスト**: ロードマップが v1.0 まで 10 バージョン (約 1〜2 年) になり、長期コミットメントが必要
  - → 対処: 1 バージョン = 1 North Star 原則で各バージョンを独立完結化
- **L5 (実装) の難易度過小評価リスク**: production grade のコード生成は依然として最難関
  - → 対処: v0.9 (支援) + v0.10 (本格) の 2 段階で品質を積み上げる、1 バージョンで畳まない
- **コンテキスト層のセキュリティ / プライバシー設計が重い**: 顧客 Slack / Gmail を扱う以上、信頼設計が製品の根幹
  - → 対処: 統合 API (`context_sources`) で抽象化、adapter 単位で opt-in、機微情報は取り込み時にマスキング
- **OSS 維持コスト**: コミュニティ運営は専門スキル
  - → 対処: コア / adapter 分離、コアは少人数で守る、adapter は寄贈受け入れ
- **v0.3.0 完走と並行で長期計画を作る負荷**: 単一メンテナー体制では時間競合
  - → 対処: ADR は AI 主導で起草、メンテナーは判断と承認のみ、実装は v0.3.0 完了後

---

## 命名と商標 (2026-05-13 確定)

### 製品ブランド名: `yohakuforce`

- 由来: **yohaku (余白)** + **force** (Salesforce ecosystem の事実上の共通サフィックス)
- 「Salesforce 開発者の余白を生む力」を意味する
- 旧名 `yohaku` は **`salesforce/yohaku-sdk`** (Salesforce 公式 SDK、2025-07 作成・2025-12 更新の現役 OSS) と直接衝突するため放棄

### CLI 実行名: `yohaku`

ブランド名と実用名を分ける慣例 (Kubernetes/`kubectl`、Terraform/`terraform` パターン)。

```bash
yohaku init --bootstrap
yohaku sync
yohaku graph query "..."
yohaku explain-write --kind apexClass --fqn ...
```

### 競合調査結果 (2026-05-13)

| 名前空間 | yohakuforce | yohaku (旧) |
|---|---|---|
| npm | ✅ 空き | ✅ 空き |
| PyPI | ✅ 空き | ⚠️ 取得済み (squat) |
| GitHub user | ✅ 空き | ⚠️ 取得済み (San Francisco Art Institute、2011 〜) |
| GitHub repo (active) | ✅ ゼロ | ❌ **salesforce/yohaku-sdk** (Apache 2.0、現役) |
| Salesforce TM リスク | 低 (community OSS の -force サフィックス慣例) | 高 (Salesforce 本家利用中) |

### Salesforce 商標との関係

- Salesforce は `-force` サフィックスを使った community OSS を歴史的に容認 (例: jsforce / force-cli / force-dev-tool / sforce-tools)
- 但し「endorsement (公式認定) を匂わせる名前」は NG。`yohakuforce` は明らかに community プロジェクト色で問題なし
- 商標登録は v1.0 公開準備時に再検討 (現時点では未登録のまま OSS で展開)

### 改名移行 (リポジトリ / コード)

現コードベースは `yohaku` を使用中。移行は **v0.4.0 着手時にまとめて実施** (本 ADR では「移行対象として記録」のみ):
- リポジトリ名: yohakuforce → yohakuforce (または yohakuforce-core)
- パッケージ名: `core` → `@yohakuforce/core` または `yohakuforce-core`
- CLI bin: `yohaku` → `yohaku`
- `.yohaku/` ディレクトリ → `.yohaku/`
- ファイル / 変数名の全置換
- ドキュメント全更新
- 移行詳細は v0.4.0 Phase ADR で確定

過去 ADR (`decisions/2026-05-06〜2026-05-10`) は **歴史的決定** として `yohaku` 表記のまま保持 (Status: Superseded by renaming は付けない、改名は表記変更であり判断の差し替えではないため)。

---

## AI モデル選定方針 (2026-05-13 確定)

### マルチプロバイダ抽象化を採用

ユーザーが利用する AI モデルを **複数プロバイダから選択できる** ように、AI プロバイダ抽象層を設計する。

#### 対応プロバイダ (確定分)

1. **Claude Code** (Anthropic)
2. **ChatGPT** (OpenAI)
3. **Antigravity** (Google)

#### 設計原則

- **全モデルでメイン利用可能** — feature parity を維持
  - L3 (要件構造化) も L5 (実装生成) もどのモデルでも動く
  - モデル固有の「このモデルでしか動かない機能」は作らない
- **ユーザー側でモデルを選択** — config / 環境変数 / コマンドフラグで切り替え
- **モデル切り替えコストを限りなくゼロに** — プロンプト構造を共通化、出力フォーマットを正規化
- **将来のモデル追加に開かれた構造** — adapter 追加で新モデルを取り込める

### 実装方針

- v0.4.0 で **`ai-provider-abstraction`** インターフェースを設計
  - `IPromptProvider` / `IModelInvoker` / `IResponseNormalizer` の 3 層
  - adapter: `adapters/ai-claude/` / `adapters/ai-openai/` / `adapters/ai-antigravity/`
- v0.5.0 以降の新機能 (L1〜L6) は **必ず** 抽象層経由で AI を呼ぶ
- adapter 単体テストでモデル間の出力差異を計測 (品質ゲート)

### なぜこの方針か

- **ユーザーの選択肢を奪わない** — 既に Claude Code / ChatGPT / Antigravity を使い分けているユーザーが、yohakuforce を使うために好みのモデルを諦める必要がない
- **コスト最適化** — タスクごとに最適なモデルを選べる (例: L1 は Haiku、L5 は Opus、等)
- **ベンダーロックイン回避** — 1 プロバイダの値上げ / 利用制限 / 障害で全体が止まらない
- **OSS の価値増幅** — どのプロバイダにも縛られない OSS は、企業ユーザーが採用しやすい

---

## 商業展開モデル (2026-05-13 確定)

### 結論: 現時点で商業展開は予定しない

OSS として誰でも使える状態を目指し、商業化 (BtoB SaaS / 有償サポート / ライセンス販売) は **当面行わない**。

### 段階的展開ステップ

```
Phase 1: 自プロジェクト適用 (現在 = v0.3.0、現参画案件)
   ↓ 価値検証
Phase 2: 社内別プロジェクトへ導入 (v0.4.0)
   ↓ 価値検証
Phase 3: 社外導入 (v1.0.0 以降、OSS としてグローバル公開)
   - OSS として誰でも利用可能
   - 価値があると判定できた場合、メンテナー主導で「コンテキスト整理や AI 導入を含むガイド付き導入」を提供
   - ガイド付き導入が商業化される可能性はあるが、それは メンテナーの選択であり OSS 基盤の収益化ではない
```

### なぜ商業化しないか

- 本 ADR の OSS 採用理由 3 つ (1: コマンドベース簡単基盤化 / 2: 誰にも届ける / 3: みんなで改善) と整合
- 商業化は OSS 維持のインセンティブを歪める可能性 (機能の一部を有償版に閉じる誘惑)
- 「価値があると判定できれば社外導入」というステップに、まず到達することが先
- メンテナー個人の人生設計として、商業化を製品の北極星に据えない

### 将来の見直し条件

以下が起きた場合は、本判断を見直す可能性がある:
- OSS 維持コスト (issue / PR / インフラ) が個人で負担できない規模になった
- 大規模企業ユーザーから「商用サポート契約が必要」との要望が複数件
- メンテナー自身のキャリア / 事業方針が変わった

見直す場合は別 ADR を起こす (本 ADR を Superseded には **しない**、判断時点での記録として残す)。

---

## 未確定事項 (後続 ADR / レビューで確定する)

- コンテキスト層の認可モデル (顧客側の同意取得フロー) — v0.5 着手 ADR で確定
- OSS ライセンスの維持 (Apache 2.0 → 一部 dual-license 検討の余地) — v1.0 公開準備時
- ベストプラクティス参照源のキュレーション (誰が選定するか) — v0.6 / v0.7 で必要時
- L3 と L6 の出力品質基準 (どこまで AI 出力を信用するか) — 各バージョン着手 ADR で確定
- AI モデル選定の優先順位 (デフォルトプロバイダをどれにするか) — v0.4 ai-provider-abstraction 設計時
- 改名移行の詳細手順 (リポジトリ / パッケージ / ディレクトリ / ファイル) — v0.4.0 Phase ADR で確定

---

## 関連ナレッジ

- decisions/[2026-05-06 プロジェクト基盤の初期構築](./2026-05-06-bootstrap-project-foundation.md) — yohaku の出発点
- decisions/[2026-05-07 IMPLEMENTATION_GUIDE.md v1.1 改訂](./2026-05-07-implementation-guide-revision-v1.1.md) — 旧 6 本柱
- decisions/[2026-05-10 Phase スコープ規律](./2026-05-10-scope-discipline-and-phase-restructure.md) — 本 ADR の規律基盤
- decisions/[2026-05-10 v0.3.0 内部検証 実証フェーズ着手計画](./2026-05-10-v0.3.0-internal-validation-plan.md) — 現フェーズ、本 ADR と並走
- decisions/[2026-05-13 長期ロードマップ草案](./2026-05-13-long-term-roadmap-draft.md) — 本 ADR と双子、具体バージョン設計

---

## 次の動き

1. ~~本 ADR を メンテナーがレビュー~~ ✅ 2026-05-13 完了
2. ~~`status: active` に昇格~~ ✅ 2026-05-13 完了
3. v0.3.0 期間中は本 ADR の内容を判断材料として参照可。ただし本文 (AGENTS.md / README.md / IMPLEMENTATION_GUIDE.md / CLAUDE.md) への反映は **v0.3.0 完了後 (2026-06-15 週以降)** に実施
4. v0.4.0 着手 ADR を起こすときに、本 ADR をロードマップの根拠として参照
5. 改名移行 (`yohaku` → `yohakuforce` / `yohaku`) は v0.4.0 Phase ADR で詳細手順を確定
