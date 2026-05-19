---
type: decision
date: 2026-05-13
title: 長期ロードマップ (v0.3 〜 v1.0) + コンテキスト独立トラック + AI プロバイダ抽象トラック
status: active
tags: [roadmap, long-term, version-planning, context-layer, l1-l6, yohakuforce, ai-provider-abstraction, rename-migration]
---

# 長期ロードマップ (v0.3 〜 v1.0) + コンテキスト独立トラック + AI プロバイダ抽象トラック

> **Status: active** (2026-05-13 メンテナー承認)
> 前提: [`decisions/2026-05-13-product-vision-expansion-ai-driven-development.md`](./2026-05-13-product-vision-expansion-ai-driven-development.md) (ビジョン拡張 ADR)
>
> 各バージョンの **DoD は「たたき台」** であり、当該 Phase 着手時の Phase ADR で最終確定する (規律 §3.1)。

---

## サマリ (1 文)

v0.3.0 から v1.0.0 まで 10 バージョン (推定 1〜2 年) でビジョン拡張を実現する段階計画。**1 バージョン = 1 North Star** 原則で各バージョンを独立完結化し、Phase 7→15 連鎖の再発を防ぐ。コンテキスト層 (議事録 / Slack / Gmail) は線形 ladder から外し、v0.4.0 から独立トラックで並走させる。

---

## 1 バージョン = 1 North Star 原則 (規律補強)

[Phase スコープ規律 ADR (2026-05-10)](./2026-05-10-scope-discipline-and-phase-restructure.md) を補強する原則を本 ADR で確立する:

> **各 v0.x.0 バージョンは 1 つの North Star (Phase ADR) を持つ。**
> **隣のバージョンに目移りせず、当該 Phase ADR を判断軸にする。**

含意:
- 各バージョン着手時は、本ロードマップ ADR ではなく **当該 Phase ADR** を最優先で参照
- 「次バージョンでこれをやるから今は飛ばす」は OK (`improvements/` に記録)
- 「次バージョンの機能が早く欲しい」は **規律違反** (Phase 増殖の起点になる)
- 各バージョンの DoD 達成のみで次バージョン着手判断

これは v0.3.0 完了時に AGENTS.md §3 に追記する候補。

---

## ロードマップ全体図

```
線形バージョン (10 個):
v0.3 ─→ v0.4 ─→ v0.5 ─→ v0.6 ─→ v0.7 ─→ v0.8 ─→ v0.9 ─→ v0.10 ─→ v1.0
 |        |       |       |       |       |       |        |        |
 内部     社内    L1+L2   L3      L4      L6      L5       L5       OSS
 検証     展開    影響     要件    設計    テスト  支援版    本格版   公開
        + 改名    範囲     構造化                                     yohaku
        + AI抽象                                                     force
        + ctx API

独立トラック (並走):
コンテキスト層 ─→ v0.4 で context_sources API → v0.5 で議事録 → v0.7 で Slack → v0.8 で Gmail → v0.9 で文字起こし
AI プロバイダ層 ─→ v0.4 で抽象層 + Claude/OpenAI/Antigravity 3 adapter → v0.5 以降の全機能が抽象層経由
```

**主な順序判断**:
- L6 (テスト) を **L5 の前** に置く → テスト先行が L5 実装の品質ゲートになる
- L5 (実装) を **v0.9 + v0.10 の 2 段** に分割 → 「実装支援版」と「実装本格版」で品質を段階深化
- コンテキスト層は **v0.4 で API 先行**、adapter は段階追加 → 線形 ladder を止めない

---

## 各バージョン詳細 (DoD たたき台)

### v0.3.0 — 内部検証 実証フェーズ (実証中)

**North Star**: 現参画 Salesforce プロジェクトに v0.2.0 を導入し、「資料更新が不要・ソースが正本」を週次運用で実証する。

**DoD**: [`2026-05-10-v0.3.0-internal-validation-plan.md`](./2026-05-10-v0.3.0-internal-validation-plan.md) 参照。5 項目中 3 項目以上達成。

**主機能**: 既存 v0.2.0 の運用検証のみ (新機能ゼロ)。

**完了予定**: 2026-06-15 週。

---

### v0.4.0 — 社内展開 + 知識グラフ基盤拡充 + 改名移行 + AI プロバイダ抽象化

**North Star (案)**: 複数の Salesforce 案件に yohakuforce を適用可能にし、`context_sources` 抽象 API + AI プロバイダ抽象層を含む知識グラフ基盤を拡充する。同時に **改名移行** (`yohaku` → `yohakuforce` / `yohaku`) を完遂する。

**DoD たたき台**:
- 2 件以上の独立した Salesforce プロジェクトで v0.3.0 と同等の運用が可能
- `context_sources` テーブル + adapter インターフェース仕様が確定
- **AI プロバイダ抽象層 (`IPromptProvider` / `IModelInvoker` / `IResponseNormalizer`)** が確定し、Claude / OpenAI / Antigravity の adapter 初版が動作
- **改名移行が完遂**: リポジトリ / パッケージ / CLI bin / ディレクトリ / ドキュメント全更新
- ベースライン計測フレームワーク (`hearing-script.md` / `measurement-template.md`) が複数案件で利用可能
- v0.3.0 期間中に蓄積した `improvements/` の優先 3 件を本バージョンで吸収

**主機能**:
- **改名移行** (yohaku → yohakuforce / yohaku、詳細は本バージョン Phase ADR で確定)
- 案件マルチテナント設計 (`.yohaku/` の隔離、metrics の案件別集計)
- `context_sources` テーブル設計 + 抽象 API
- **AI プロバイダ抽象層** + 3 プロバイダ adapter (Claude / OpenAI / Antigravity)
- ベースライン計測ツールの汎用化
- v0.3 で見つかった pitfalls の解消 (path 制約改善、エラーメッセージ強化、等)

**改名移行の詳細 (v0.4.0 Phase ADR で確定)**:
- リポジトリ名: `yohakuforce` → `yohakuforce` (または `yohakuforce-core`)
- パッケージ名: `core` → `yohakuforce-core` (npm) / `yohakuforce` (PyPI 確保)
- CLI bin: `yohaku` → `yohaku`
- ディレクトリ: `.yohaku/` → `.yohaku/` (旧 `.yohaku/` は読み取り fallback を 1 バージョンだけ維持 → v0.5 で削除)
- スキル / コマンド: `/yohaku-explain` → `/yohaku-explain` 等
- ドキュメント全更新 (README / CLAUDE / AGENTS / IMPLEMENTATION_GUIDE)
- 過去 ADR (2026-05-06 〜 2026-05-10) は **歴史的決定として `yohaku` 表記のまま保持**

**メインペルソナへの価値**: SIer が複数案件で再利用可能な基盤になる。ユーザーが好みの AI モデル (Claude / GPT / Antigravity) を選べる。

---

### v0.5.0 — L1 + L2: 影響範囲・実装範囲特定 (+ 議事録 adapter 初版)

**North Star (案)**: 改修対象から依存先を辿り、要件文から触るべき資材を特定する AI 駆動の **影響範囲・実装範囲特定** 機構を実現する。

**DoD たたき台**:
- `yohaku impact <fqn>` で当該資材の依存先 (Apex / Trigger / Flow / LWC / SObject) 一覧が出る
- `yohaku scope "<要件文>"` で触るべき資材候補が AI 推論で出る (precision/recall 評価枠付き)
- 議事録 adapter (Markdown / docx ファイル取り込み) 初版が動作する
- 現参画または他社内案件で実用検証を 4 週

**主機能**:
- graph-based impact analysis (依存グラフ探索の専用クエリ)
- requirement → scope NLP (LLM + graph 連携)
- adapters/meeting-minutes-file/ の adapter 初版
- `/yohaku-impact` / `/yohaku-scope` slash command (新規)

**メインペルソナへの価値**: 案件中盤の改修見積り精度が上がる、議事録から触る範囲が AI で出る。

---

### v0.6.0 — L3: 要件構造化・抜け漏れ検出 AI 支援

**North Star (案)**: 議事録 / 要件メモから構造化された要件リストを生成し、抜け漏れ・整合性問題を検出する AI 支援を実現する。

**DoD たたき台**:
- 議事録 + ステークホルダー会話 (context_sources 経由) から要件構造化 JSON が生成される
- Salesforce のメタデータ知識 (オブジェクト / 関係) と照合し、典型的な抜け漏れ (論理削除 / 監査ログ / 共有設定 / VR / 履歴管理) を検出する
- 既存仕様との整合チェック (新要件 vs 既存 Apex / Flow)
- SIer 案件の要件定義工程で 1 件以上の実利用

**主機能**:
- requirement structurer (LLM プロンプト + Zod スキーマ強制)
- gap detector (Salesforce 標準パターン辞書との突合)
- inconsistency detector (新要件 vs 既存知識グラフ)
- `/yohaku-requirements` slash command

**重要**: 本バージョンは **「要件構造化支援」** であり、「要件定義 AI 駆動」ではない。要件そのものを決めるのは人間。表現は弱めに維持。

**メインペルソナへの価値**: 案件序盤の要件抜け漏れリスクが下がる。

---

### v0.7.0 — L4: 設計 AI 駆動 (+ Slack adapter)

**North Star (案)**: 構造化された要件から、データモデル / オブジェクト設計 / フロー設計 / 権限設計 を AI 駆動で起案する。

**DoD たたき台**:
- v0.6 の要件構造化出力を入力に、SObject / Field / Relationship / RecordType / Profile 草案が生成される
- Mermaid / PlantUML で設計図 (ER / フロー) が生成される
- 設計判断の代替案を最低 2 つ + 採否理由つきで提示する (decisions/ パターンの自動生成相当)
- Slack adapter 初版 (Slack MCP 経由) が動作する
- SIer 案件の設計工程で 1 件以上の実利用、人間レビュー後の採用率を計測

**主機能**:
- design suggester (LLM + best practice 参照)
- design alternative generator (2+ alternatives with trade-offs)
- adapters/slack-mcp/ の adapter 初版
- `/yohaku-design` slash command

**メインペルソナへの価値**: 案件中盤の設計工程が加速、設計判断の質が均質化。

---

### v0.8.0 — L6: テスト AI 駆動 (+ Gmail adapter)

**North Star (案)**: Apex / Flow のテストケース・テストデータを AI 駆動で生成し、L5 実装の品質ゲートとして機能させる。

**DoD たたき台**:
- 既存 Apex / Flow に対して、boundary / happy path / error path をカバーする Apex Test Class が生成される
- カバレッジ 80%+ を目標 (実測で評価)
- Flow 用テストシナリオ (テストデータ + 期待結果) が生成される
- Gmail adapter 初版 (Gmail MCP 経由) が動作する
- SIer 案件のテスト工程で 1 件以上の実利用

**主機能**:
- test generator (Apex / Flow 各種)
- test data generator (ガバナー制限考慮)
- coverage analyzer (gap 検出)
- adapters/gmail-mcp/ の adapter 初版
- `/yohaku-test` slash command

**なぜ L5 の前に L6 か**:
- テストが先にあると、L5 (実装生成) の品質を **自動的に評価** できる
- L5 実装が「テストを通す」を目標にできる (= TDD の AI 適用)
- L5 だけ先行すると、生成コードの品質を人間が毎回レビューする負荷で頓挫する

**メインペルソナへの価値**: 案件終盤のテスト工程が加速、引き継ぎ後の運用品質が上がる。

---

### v0.9.0 — L5 初版: 実装 AI 支援 (+ 文字起こし adapter)

**North Star (案)**: Apex / Trigger / Flow / LWC の **支援レベル** での AI 駆動実装を実現する。生成コードは人間レビュー前提、テスト (v0.8) によるゲートあり。

**DoD たたき台**:
- 設計 (v0.7 出力) を入力に、Apex / Trigger / Flow / LWC のスケルトンコードが生成される
- v0.8 で生成したテストが、生成コードに対して 80%+ パスする
- 生成コードは AI_MANAGED マーカー相当の `// AI_GENERATED` コメントで明示 (人間が修正したら剥がす運用)
- Code Analyzer v5 (SARIF) で CRITICAL / HIGH 検出ゼロ
- 会議文字起こし adapter (Otter / Zoom) 初版が動作する
- SIer 案件の実装工程で 1 件以上の実利用、人間修正の差分を計測

**主機能**:
- code generator (Apex / Trigger / Flow / LWC 別)
- code reviewer (Code Analyzer 連携)
- AI_GENERATED マーカー仕様
- adapters/otter-meeting/ の adapter 初版
- `/yohaku-implement` slash command

**重要**: 本バージョンは **「支援版」**。生成コードをそのまま production にデプロイすることは想定しない。

**メインペルソナへの価値**: 案件実装工程の初動が大幅短縮 (スケルトン生成)、人間は本質的判断に集中。

---

### v0.10.0 — L5 本格: 実装 AI 駆動 (品質深化)

**North Star (案)**: v0.9 の生成精度を **production grade** に引き上げる。組織固有パターン尊重、レビュー精度向上、自動修正。

**DoD たたき台**:
- 同一プロジェクト内の既存実装パターン (Handler 構造 / 命名規則 / エラー処理) を AI が学習し、新規生成に反映
- レビュー指摘の自動修正サイクルが成立 (Code Analyzer 警告 → 自動修正 → 再評価)
- 人間修正の差分が v0.9 比で 50% 以下
- SIer 案件で生成コードの **production デプロイ実績** を 1 件以上 (人間最終承認後)

**主機能**:
- org-specific pattern learner (knowledge graph + AI)
- auto-fix loop (lint → fix → re-evaluate)
- production readiness checker
- 既存 yohaku 機能 (差分意味づけ / リリース準備) との統合

**メインペルソナへの価値**: 案件全体の AI 駆動率が大幅向上、案件あたり工数の本質的削減。

---

### v1.0.0 — OSS 公開 + コミュニティ整備

**North Star (案)**: 外部公開可能な品質・ドキュメント・ライセンス整備を完了し、コミュニティ協働の基盤を確立する。

**DoD たたき台**:
- README / ドキュメントが英語 + 日本語で整備
- Apache 2.0 ライセンスで GitHub Public 公開 (リポジトリ名: `yohakuforce`)
- **3 件以上の独立した適用実績** (社内案件 + 社外導入を含む混在で OK)
  - 社内案件で 2+ 件、または社外導入が 1 件以上含まれていれば達成
- adapter 寄贈のための CONTRIBUTING.md / コード規約 / Pull Request テンプレート整備
- 商標方針: 名称は `yohakuforce` (ブランド) / `yohaku` (CLI)、商標登録の要否を v1.0 公開時点で再判断
- **商業展開はなし** ([Vision ADR §商業展開モデル](./2026-05-13-product-vision-expansion-ai-driven-development.md#商業展開モデル-2026-05-13-確定) と整合)
  - 価値が出た場合に メンテナー主導の「ガイド付き導入」を任意提供する余地は残す (商業化は別判断)

**主機能**:
- 公開ドキュメント整備 (英 + 日)
- サンプルプロジェクト 3 種 (SIer 新規案件 / SIer 大規模改修 / 社内 SF チーム)
- adapter コントリビューションガイド (AI プロバイダ adapter / コンテキスト adapter の追加方法)
- バグ報告 / 機能要望テンプレート

**メインペルソナへの価値**: SIer コミュニティ全体で知見が循環する、案件ごとの再発明が減る、好みの AI モデルで使える OSS 基盤として定着。

---

## コンテキスト独立トラック

### 設計判断 (再掲)

線形 ladder から外し、**v0.4.0 で `context_sources` 抽象 API を先に固める** → 各バージョンで段階的に adapter を追加する。

### Adapter 追加スケジュール

| 時期 | Adapter | 取り込み元 | リスク | DoD |
|---|---|---|---|---|
| v0.4.0 | (API 設計のみ) | — | — | `context_sources` テーブル + adapter インターフェース仕様確定 |
| v0.5.0 | meeting-minutes-file | Markdown / docx ファイル | 低 (ローカルファイル) | 1 案件で議事録 5 件取り込み、L1+L2 で利用 |
| v0.7.0 | slack-mcp | Slack MCP 経由 | 中 (顧客 Slack の承認必要) | 1 案件で Slack 取り込み opt-in、L4 設計工程で利用 |
| v0.8.0 | gmail-mcp | Gmail MCP 経由 | 中 (個人情報含む) | 1 案件で Gmail 取り込み opt-in、L6 テスト工程で要件参照 |
| v0.9.0 | otter-meeting | Otter.ai / Zoom 文字起こし | 中 (会議内容の機微度) | 1 案件で文字起こし 5 件取り込み、L5 実装で利用 |

### 横断的な原則

1. **取り込みは明示的 opt-in** (デフォルトは無効)
2. **顧客承認なしには動かない** (adapter 有効化時に同意フローを通す)
3. **機微情報は取り込み時にマスキング** (顧客名 / 取引額 / 個人名)
4. **adapter は読み取り権限のみ** (書き込み禁止)
5. **3 層分離維持** (AI は context_sources を graph query 経由でのみ参照)

### 統合 API の進化

`context_sources` テーブルは **v0.4 で確定したら破壊的変更しない**。adapter 追加時もスキーマは変えず、`type` enum と `structured` 内容のバリエーションで吸収する。

---

## 各バージョンの完了 → 次バージョン着手の判断

| 状態 | 判断 |
|---|---|
| 当該バージョンの DoD 全項目達成 | 次バージョンの Phase ADR を起案 |
| DoD の主要 3 項目以上達成 | 達成内容 + 残課題を retrospectives/ に記録、次バージョン着手判断は **人間オーナー (メンテナー)** |
| DoD 半数未満達成 | 当該バージョン内で対処継続 (新 Phase / 新バージョンを立てない、規律 §3.3) |
| 構造的破綻 (アプローチが間違っていた) | 当該バージョンの Phase ADR を `Status: Superseded` に書き換え、新案を起案 |

---

## 代替案

| 案 | 採否 | 理由 |
|---|---|---|
| **A. 本案 (10 バージョン段階、L6 を L5 前、L5 を 2 段、コンテキスト独立)** | 採用 | 1 バージョン 1 North Star を守りやすい、テスト先行で実装品質ゲート、コンテキスト統合は API 先行で実現 |
| B. L1+L2 → L3 → L4 → L5 (1 段) → L6 の単純順 | 却下 | L5 を 1 段にすると品質が積み上がらない、L5 後に L6 だと実装品質を後から保証する不経済 |
| C. L3 → L4 → L5 → L6 → L1+L2 (要件起点で先に進める) | 却下 | 知識グラフの基盤拡張 (L1+L2 で必要) を後回しにすると L3 以降の精度が頭打ち |
| D. コンテキスト層を v1.x まで保留 | 却下 | SIer ペルソナで生命線、後回しにできない |
| E. v0.4 で OSS 公開 → 残りはコミュニティ駆動 | 却下 | コアが固まる前に公開すると破壊的変更で信頼を失う、v1.0 まで内部 (社内) で固める |
| F. 3 バージョン (v0.4 / v0.7 / v1.0) で大幅機能追加 | 却下 | Phase 増殖の温床、各バージョンが肥大化、DoD 評価困難 |

---

## トレードオフ

- **長期コミットメント**: 推定 1〜2 年、メンテナー体制で 10 バージョンを完走する持続力が必要
  - 対処: 1 バージョン = 1 North Star で各バージョンを独立完結化、メンテナーが交代しても次の人が引き継げる粒度
- **L5 が遠い (v0.9 / v0.10)**: 「実装 AI 駆動」の最大期待が後ろになる
  - 対処: v0.5 / v0.6 / v0.7 で順次価値を出す、L5 だけで売らない
- **コンテキスト層が adapter ごとに段階追加**: 議事録だけだと初期は地味に見える
  - 対処: 議事録 adapter (v0.5) でも実利用効果は十分大きい、Slack / Gmail は段階的に拡張
- **バージョン数が多い (10)**: マイルストーンが細かすぎる印象
  - 対処: 各バージョンに明確な North Star があれば「数」ではなく「達成」で見える、外部発信時は v0.5 / v0.8 / v1.0 など節目のみ強調可
- **v1.0.0 後の継続計画なし**: 本 ADR は v1.0 までしかカバーしない
  - 対処: v1.0 完了時に v1.x ロードマップ ADR を別途起案 (BtoB 展開 / 業界別パターン / 国際化 等)

---

## 検証ゲート

各バージョン完了時に以下を実施:
1. 当該 Phase ADR の DoD を retrospectives/ で評価
2. 達成度を本 ADR の表に追記 (達成 / 部分達成 / 未達成)
3. 次バージョン Phase ADR を起案する前に、本 ADR のロードマップ自体を見直す機会を取る (順序変更 / バージョン分割 / マージ を検討)
4. v0.5 / v0.8 / v1.0 の 3 つは **外部発信節目**。マーケティング / コミュニティへのアナウンスを意識した完了基準

---

## 未確定事項 (各バージョン Phase ADR で確定する)

- 各バージョンの DoD 数値目標 (本 ADR は たたき台のみ)
- 各バージョンの開始時期 (前バージョンの DoD 達成によって決まる)
- 使用 AI モデル (各バージョン着手時に最新を選定)
- 各バージョンの subagent / slash command の具体設計
- コンテキスト adapter ごとの認可フロー詳細

---

## 関連ナレッジ

- decisions/[2026-05-13 製品ビジョン拡張](./2026-05-13-product-vision-expansion-ai-driven-development.md) — 本 ADR の前提となるビジョン
- decisions/[2026-05-10 Phase スコープ規律](./2026-05-10-scope-discipline-and-phase-restructure.md) — 本 ADR の規律基盤
- decisions/[2026-05-10 v0.3.0 内部検証 実証フェーズ着手計画](./2026-05-10-v0.3.0-internal-validation-plan.md) — 現フェーズ
- improvements/[2026-05-13 yohaku-explain bulk + category](../improvements/2026-05-13-yohaku-explain-bulk-and-category-execution.md) — v0.4 / v0.5 で吸収候補
- improvements/[2026-05-13 metrics Claude Code integration](../improvements/2026-05-13-metrics-claude-code-session-integration.md) — v0.4 で吸収候補
- improvements/[2026-05-13 business-notes scaffold](../improvements/2026-05-13-business-notes-scaffold.md) — v0.4 で吸収候補

---

## 次の動き

1. ~~本 ADR を メンテナーがレビュー~~ ✅ 2026-05-13 完了 (ビジョン ADR とセット)
2. ~~`status: active` に昇格~~ ✅ 2026-05-13 完了
3. v0.3.0 完了 (2026-06-15 週) 後、v0.4.0 着手 Phase ADR を本 ADR の v0.4.0 セクションを起点に起案
4. 各バージョン完了時に本 ADR の検証ゲート (達成度追記) を実施
