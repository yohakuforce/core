# Next Session Handoff — yohakuforce

**作成日**: 2026-05-31
**前セッション ID**: HTML 設計書パイプライン Phase 0〜15
**現在の状態**: 機能実装は完了済、ドキュメント整備とハーネス互換性検証のみ残

---

## 0. 現在のスナップショット

### 実装済 (Phase 0〜15)

| Phase | 機能 | エントリポイント |
|---|---|---|
| 0 | `--format md\|html\|md,html` 配管 | `yohaku render --format md,html` |
| 1〜2 | 5 タイプ component leaf HTML (Apex/Trigger/LWC/Object/Flow) | (同上) |
| 3 | ホーム + JSON ドリブン描画 + Mermaid/HTML フォールバック | (同上) |
| 4 | OrgRetrieveAdapter (sf CLI manifest 一括) | `yohaku graph build --source org` |
| 5 | domains.yaml init/sync/lint | `yohaku domains init` |
| 6 | Codex/Antigravity プロンプト + scaffold | (配布物) |
| 7 | 誘導設計の別 Issue 文書化 | `docs/proposals/guidance-system.md` |
| 8 | AI-managed ブロック書き戻し | `yohaku html-write --input fill.json` |
| 9 | LLM 用 prompt + context 一括生成 | `yohaku explain-prompts --output prompts.json` |
| 10 | ローカル開発サーバ | `yohaku serve --port 4000` |
| 11 | Cmd+K グローバル検索 | (HTML 内蔵) |
| 12 | watch モード (auto-rebuild + SSE reload) | `yohaku serve --watch` |
| 13 | Release Review HTML | `yohaku diff --from REF --format html` |
| 14 | テストカバレッジ統合 | `yohaku coverage import --input coverage.json` |
| 15 | 業務フロー俯瞰タブ (ホーム 2 番目) + AI-managed ブロック preservation | (HTML 内蔵) |

### テスト状況
- 全体: **497 passed / 1 skipped (498) / 1 flaky** (`tests/unit/serve/watch.test.ts > startWatch > ファイル変更で rebuild が呼ばれ、SSE で reload が出る` が並列実行で稀に失敗、単独実行では常に pass)
- tsc: 0 errors
- build: OK (`npm run build` from packages/core)

### sfai-trial E2E 動作確認済
- 場所: `~/Desktop/01_active/sfai-trial/`
- `.yohaku/graph.sqlite` + `.yohaku/domains.yaml` + `.yohaku/coverage.json` + `docs/generated/html/` 一式生成済
- `yohaku serve --port 4500 --watch` で http://127.0.0.1:4500/ アクセス可能 (起動済なら kill PID で停止)

---

## 1. 残課題 (A〜G) 詳細

### A. scaffold/AGENTS.md.eta 更新 (Phase 8〜15 追記)

**現状**: §8 が Phase 0〜7 のみ記載。html-write / explain-prompts / serve --watch / coverage / diff html / 業務フロータブが未記載。

**やること**: `scaffold/AGENTS.md.eta` の §8 を全置換、または §10 として追加。以下のセクションを追加:

```markdown
### LLM ブロック充填フロー (Phase 8/9)
yohaku explain-prompts --output prompts.json
# → Claude/Codex に渡して fill.json を得る
yohaku html-write --input fill.json

### ローカルプレビュー (Phase 10/12)
yohaku serve --port 4000
yohaku serve --watch       # ソース変更で自動 rebuild + ブラウザ reload

### リリースレビュー (Phase 13)
yohaku diff --from v1.0.0 --to HEAD --format html
# → docs/generated/html/release-review.html

### テストカバレッジ (Phase 14)
sf apex run test --code-coverage --result-format json > coverage.json
yohaku coverage import --input coverage.json

### 業務フロー (Phase 15)
# 自動生成。ホーム 2 番目のタブ「業務フロー」で参照。
# domains.yaml + AI-managed business-meaning ブロックの内容を集約。
```

**受け入れ基準**: 新規プロジェクトに `yohaku init --bootstrap` した時、生成された AGENTS.md に上記コマンドが全て載っていること。

---

### B. scaffold/prompts/{codex,antigravity}/AGENTS-snippet.md 更新

**現状**: Phase 0〜7 のコマンドのみ記載。

**やること**: 各ファイルの "Build modes" セクションの下に "New workflows (Phase 8〜15)" を追加。コマンドリストは A と同じ内容で、簡潔に。

**受け入れ基準**:
- Codex/Antigravity が yohaku を使う時、`/yohaku-html-write` 相当を「`yohaku html-write --input ...` を実行してください」と CLI 直接呼び出しで提示できる
- Mac mini 到着後の検証用に、Codex CLI で実プロジェクトに対し `yohaku serve --watch` まで通せる

---

### C. CONTRIBUTING.md ハーネス別動作確認手順を拡張

**現状**: §"ハーネス別 動作確認手順" は `/yohaku-html-build` のみ言及。

**やること**: 表に追加コマンド (`/yohaku-domains`, `/yohaku-html-write` 等) と、各ハーネスでの **「最低限のスモークテスト手順」** を 5 行で書く:

```markdown
1. yohaku init --bootstrap
2. yohaku graph build
3. yohaku render --format md,html
4. yohaku explain-prompts --output prompts.json && cat prompts.json | head -50
5. yohaku serve --port 4000  # ブラウザでホームが開けば PASS
```

**受け入れ基準**: 新規 contributor がこの手順だけで yohaku を一通り触れる。

---

### D. CHANGELOG.md 更新 (現状 v0.4.1)

**現状**: 最終エントリ v0.4.1 (2026-05-19)。Phase 8〜15 の変更が未記載。

**やること**: `CHANGELOG.md` の先頭に新エントリ:

```markdown
## v0.5.0 - 2026-05-31

### Added
- HTML 設計書パイプライン (Phase 0〜7): `yohaku render --format md,html`
- LLM ブロック充填 (Phase 8/9): `yohaku html-write` / `yohaku explain-prompts`
- ローカル開発サーバ (Phase 10): `yohaku serve` + `--watch` (Phase 12)
- Cmd+K グローバル検索 (Phase 11): 全 HTML ページに inline
- Release Review HTML (Phase 13): `yohaku diff --format html`
- テストカバレッジ統合 (Phase 14): `yohaku coverage import/show`
- 業務フロー俯瞰タブ (Phase 15): ホーム 2 番目、domain/object 単位
- AI-managed ブロック preservation: render 再実行で fill が失われない

### Changed
- HTML render 出力先: `<out>/html/` 直下から `<out>/html/component/<type>/<name>.html` ベースへ
- Mermaid テーマを Salesforce 風 (Brand Navy / Blue / SLDS colors) に統一
- 絵文字を全廃、SVG line-icon に統一

### Fixed
- Apex 抽出器の DML target に変数名が混入する問題を、フロー側で knownObjects フィルタにより回避
```

**受け入れ基準**: `package.json` の version も `0.5.0` に bump (もしくは 0.4.2 でも 0.6.0 でも、release 戦略次第)。

---

### E. koya-brain `Context/AI_Handoff.md` 更新

**現状**: 2026-05-30 時点で Phase 0〜7 完了の記載まで。

**やること**: 既存 2026-05-30 エントリの下に、2026-05-31 の Phase 8〜15 完了をブロックコメントで追加:

```html
<!-- 2026-05-31 yohakuforce/core HTML パイプライン Phase 8〜15 完了
     - html-write / explain-prompts (LLM ブロック充填)
     - serve / serve --watch (SSE auto-reload)
     - Cmd+K グローバル検索
     - diff --format html (release-review.html)
     - coverage import (sf apex run test JSON 取込)
     - 業務フロー俯瞰タブ (ホーム 2 番目)
     - AI-managed ブロック preservation バグ修正
     - 497/498 tests passed (1 flaky watch race), tsc 0, build OK
     - sfai-trial で全機能 E2E 確認済
     - 残課題は `~/Desktop/01_active/SF-AI-Foundation/docs/proposals/next-session-handoff.md` 参照 -->
```

---

### F. flaky watch test の解消

**現状**: `tests/unit/serve/watch.test.ts > startWatch > ファイル変更で rebuild が呼ばれ、SSE で reload が出る` が並列実行で稀に失敗 (fs.watch のイベント受信タイミング race)。

**原因仮説**: vitest が同一プロセス内で複数テストファイルを並列実行する際、`fs.watch` recursive のイベント配送が一時遅延する。

**やること**:
- Option 1: vitest config で `tests/unit/serve/` を `singleThread` 指定
- Option 2: watch.test.ts 内で polling ベースの wait helper を導入 (e.g. `waitFor(() => rebuild.mock.calls.length > 0, 2000)`)

**受け入れ基準**: 10 回連続で `npx vitest run` を回しても全 pass。

---

### G. `Inbox/yohakuforce-coreレビュー.md` を Archive へ移動

**現状**: `~/Documents/koya-brain/Inbox/yohakuforce-coreレビュー.md` が残っている (今回作業の起点 inbox)。

**やること**:
```bash
mkdir -p ~/Documents/koya-brain/Archive/Processed/
mv ~/Documents/koya-brain/Inbox/yohakuforce-coreレビュー.md \
   ~/Documents/koya-brain/Archive/Processed/2026-05-31-yohakuforce-coreレビュー.md
```

**受け入れ基準**: koya-brain `weekly-cleanup` で `Inbox/` が空に近づく。

---

## 2. 技術的負債

### 2.1 Apex DML 抽出器の精度向上

**症状**: `insert lines;` のような Apex 文で、`lines` (変数名) が `body.dmlOperations[].target` に格納される。今回はフロー側で `graph.objects` フィルタで回避済だが、根本的には extractor の改善が望ましい。

**場所**: `packages/core/src/graph/extractors/apex-body.ts`

**改善案**:
- 変数宣言 `Account[] lines = [SELECT...]` をローカルに記憶し、`insert lines` を `Account` に解決
- Map/List 型注釈 (`List<Invoice__c>`) も同様に解決

**スコープ**: 中規模。ASTパーサに置き換えるなら大規模。

---

### 2.2 誘導設計の実装 (Phase 7 で別 Issue 化済)

**ドキュメント**: `~/Desktop/01_active/SF-AI-Foundation/docs/proposals/guidance-system.md`

**やること**: 3 案 (ヒューリスティック入口設計 / hook で /impact 提案 / CLAUDE.md 強制ルール) のうち、案 B (hook) の prototype を作る。`PreToolUse` フックで「ファイル編集前に `yohaku impact <FQN>`」を提案する claude code hook の最小実装。

---

### 2.3 メソッド単位 Mermaid 図の Salesforce テーマ整合

**症状**: Phase 11 で Mermaid 全般を Salesforce 色 (Brand Navy / Blue) で統一したが、メソッド flowchart の if/loop ダイアモンドだけ少しテーマが弱い。

**場所**: `packages/core/src/html/assets.ts` の `.mermaid-host svg .node polygon` セレクタ周辺。

---

## 3. **クロスハーネス対応 (重要・未完了タスク)**

### 3.1 ゴール

LocalLLM / Claude Code / Codex / Antigravity の **全 4 環境で yohaku が同等に使える** ことを実証する。現状は Claude Code を主に動作確認しており、他 3 環境は **未検証**。

### 3.2 各ハーネスの現状

| ハーネス | CLI 直接呼び出し | 配布物 | 実機検証 |
|---|---|---|---|
| **Claude Code** | ✅ 動作確認済 | `scaffold/.claude/{agents,commands,settings.json}` 一式 + プラグイン | ✅ sfai-trial で全機能 |
| **Codex** | 未検証 | `scaffold/prompts/codex/AGENTS-snippet.md` (Phase 0〜7 のみ) | ❌ |
| **Antigravity** | 未検証 | `scaffold/prompts/antigravity/AGENTS-snippet.md` (Phase 0〜7 のみ) | ❌ |
| **LocalLLM** | CLI は動く前提 | プロンプト独立、CLI 単体 | ❌ ローカル LLM (Ollama 等) からの起動シナリオ未検証 |

### 3.3 各環境でやるべき検証

#### Claude Code (補強のみ)
- [ ] `scaffold/.claude/commands/` に新スラッシュコマンドを追加: `/yohaku-html-write`, `/yohaku-explain-prompts`, `/yohaku-serve`, `/yohaku-coverage-import`, `/yohaku-diff-html`
- [ ] それぞれ `.md.eta` テンプレを既存 `/yohaku-html-build.md.eta` と同じ形式で書く
- [ ] sfai-trial で各スラッシュを叩いて期待動作する

#### Codex
- [ ] OpenAI Codex CLI または Codex Web で sfai-trial を開く
- [ ] `scaffold/prompts/codex/AGENTS-snippet.md` をプロジェクト root の `AGENTS.md` に貼る (または既存 AGENTS.md にマージ)
- [ ] Codex に「設計書を HTML で生成して」と依頼 → `yohaku render --format md,html` が実行される
- [ ] Codex に「業務フローを見たい」 → `yohaku serve --port 4000` 起動を提案できる
- [ ] 検証結果を `docs/cross-harness-validation.md` (新規) に記録

#### Antigravity
- [ ] Google Antigravity で同上の手順
- [ ] Antigravity 特有の挙動差異 (例: 長時間自律実行) を `AGENTS-snippet.md` に反映

#### LocalLLM (Ollama / 自前 SDK 等)
- [ ] Ollama + 小さい model (qwen2.5-coder 等) でテスト
- [ ] LocalLLM → bash 経由で `yohaku --help` → コマンド発見可能性を確認
- [ ] 主要コマンド (`yohaku render --format html`, `yohaku serve`, `yohaku explain-prompts`) を引数だけで叩けるか確認
- [ ] LLM の output → `yohaku html-write` への接続を最小手順で書く

### 3.4 アウトプット成果物

- [x] `scaffold/.claude/commands/yohaku-*.md.eta` 追加 (新 5 件: explain-prompts / html-write / serve / diff-html / coverage-import) — 2026-05-31
- [x] `scaffold/prompts/codex/AGENTS-snippet.md` 更新 (Phase 8〜15 反映) — 2026-05-31
- [x] `scaffold/prompts/antigravity/AGENTS-snippet.md` 更新 (同上 + 自律実行ワークフロー) — 2026-05-31
- [x] `scaffold/prompts/local-llm/README.md` 新規作成 (Ollama 等向け CLI ガイド) — 2026-05-31
- [x] `docs/cross-harness-validation.md` 新規作成 (検証結果スナップショット) — 2026-05-31
- [ ] **実機検証** (Codex / Antigravity / LocalLLM): Mac mini 到着後。Claude Code は sfai-trial で実証済

### 3.5 想定工数

- ドキュメント整備のみ: 1 時間
- 実機検証含む (Mac mini 到着後想定): 各環境 30 分 × 4 = 2 時間
- **合計目安: 3 時間**

---

## 4. 次セッションで使う「起動プロンプト」

次セッション開始時、以下を **そのまま貼って** ください。Claude Code の Context Engine ルールが自動で本ドキュメントへ誘導します:

```
yohakuforce の次フェーズを進めたい。

前回セッション (2026-05-31) の続きで、HTML 設計書パイプライン Phase 0〜15 は
完了済。残課題は ~/Desktop/01_active/SF-AI-Foundation/docs/proposals/next-session-handoff.md
にまとまっている。

優先度を確認しつつ、以下の順で着手したい:
1. ドキュメント整備 (A〜D, G) — 30 分で完了する pure-doc 作業
2. クロスハーネス対応 (§3) — scaffold prompts 拡張 + 検証
3. 技術的負債 (Apex DML 抽出器 / 誘導設計 hook prototype)

まず next-session-handoff.md を読んで、現状を把握してから着手順を提案してください。
sfai-trial (~/Desktop/01_active/sfai-trial/) は前回検証用に
.yohaku/ + docs/generated/html/ 一式が残っているので、検証はそこを使えます。
```

### 5. クイック開始 (1 行版)

省略形を好む場合:

```
~/Desktop/01_active/SF-AI-Foundation/docs/proposals/next-session-handoff.md を読んでから、A→B→C→D→G の順でドキュメント整備、その後 §3 クロスハーネス対応に着手して
```

---

## 6. 参考: 関連ファイル一覧

```
~/Desktop/01_active/SF-AI-Foundation/
├── docs/proposals/
│   ├── guidance-system.md          ← Phase 7 で書いた誘導設計の別 Issue 文書
│   └── next-session-handoff.md     ← 本ドキュメント
├── packages/core/
│   ├── src/
│   │   ├── cli.ts                   ← 全コマンドのエントリ
│   │   ├── html/                    ← Phase 0〜3, 11, 15 のレンダラ
│   │   ├── html-write/              ← Phase 8
│   │   ├── explain-prompts/         ← Phase 9
│   │   ├── serve/                   ← Phase 10, 12
│   │   ├── diff/html-render.ts      ← Phase 13
│   │   ├── coverage/                ← Phase 14
│   │   ├── domains/                 ← Phase 5
│   │   └── adapters/org-retrieve/   ← Phase 4
│   └── tests/                       ← 497 tests
├── scaffold/                         ← yohaku init で配布される
│   ├── AGENTS.md.eta                ← ← A で更新対象
│   ├── .claude/commands/            ← ← Claude Code スラッシュ追加対象
│   └── prompts/{codex,antigravity}/ ← ← B で更新対象
├── CONTRIBUTING.md                   ← ← C で更新対象
└── CHANGELOG.md                      ← ← D で更新対象

~/Desktop/01_active/sfai-trial/        ← 検証用プロジェクト
├── .yohaku/                          ← graph + domains + coverage 一式
├── docs/generated/html/              ← 全機能反映済 HTML
└── force-app/                        ← Salesforce ソース

~/Documents/koya-brain/
├── Context/AI_Handoff.md             ← ← E で追記対象
└── Inbox/yohakuforce-coreレビュー.md ← ← G で Archive へ
```
