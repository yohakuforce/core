# Changelog

すべての注目すべき変更は本ファイルに記録される (SemVer 準拠)。

## [0.6.0] - 2026-06-02 (詳細設計書化)

> HTML 設計書を「詳細設計で必要な観点」(処理詳細・項目値の割り当て・計算方法) まで踏み込ませ、
> 「決定的な事実」と「LLM による解釈・確認」の二層で仕様を漏れなく把握できるようにした。
> 3 層分離 (Core は LLM を呼ばない) は維持し、LLM 連携は既存の prompt→html-write 往復に乗せている。

### Added

- **詳細設計セクション群** (HTML): Object「項目値の割り当て」「計算項目・入力規則」、Apex/Trigger「処理詳細」、Apex/Trigger「項目値の割り当て」(触れるオブジェクト別タブ, JS 不要の CSS タブ)
- **数式の自然語化**: 数式項目 / 入力規則 (ValidationRule) を日本語の算出ロジックへ展開 (原文は折りたたみ併記)
- **フローチャートの日本語化**: Mermaid / ツリーのノードを自然な日本語に (`Account を取得` / `o を登録` / `lines を 1 件ずつ繰り返す` / `o.Id を返す`、矢印も はい/いいえ・繰返)
- **凡例ページ** (`legend.html`): 図形・ステップバッジ・項目値区分・色分け(事実/AI)を 1 枚に。全 component ページ右上からリンク
- **LLM 役割拡張**: 項目設定詳細の抽出 (`field-writes` / `field-assignment-detail`)、計算項目・入力規則のレビュー (`calculation-review`) を ai_managed ブロックとして追加

### Changed

- **Field 抽出に `formula` / `defaultValue` を追加** (graph schema / sqlite store・reader を round-trip 対応、既存 DB は `addColumnIfMissing` で安全 migrate)
- 項目値の割り当てから曖昧な「—」を撤廃。決定的に確定する項目のみ決定的テーブル化し、残りは完全性保証スケルトン付きの LLM ブロックへ再設計
- アイコンを絵文字から inline SVG (`book`) に統一 (凡例リンク)

### Fixed

- 数式内のフィールド名が白飛びして読めない CSS バグ (`pre code` の白文字継承を上書き)

## [0.5.0] - 2026-05-31 (HTML 設計書パイプライン)

> 同じ知識グラフから「AI が読む Markdown」と「人間がレビューする HTML」を二系統で生成し、
> LLM 充填・ローカルプレビュー・リリースレビュー・カバレッジ統合まで一気通貫にした大型リリース。

### Added

- **HTML 設計書パイプライン** (Phase 0〜7): `yohaku render --format md,html`。5 タイプ (Apex/Trigger/LWC/Object/Flow) の component leaf HTML、JSON ドリブン描画、Mermaid/HTML フォールバック、業務ドメイン階層 (`yohaku domains init/sync/lint`)、組織取得アダプタ (`yohaku graph build --source org`)
- **LLM ブロック充填** (Phase 8/9): `yohaku explain-prompts --output prompts.json` で充填用 prompt+context を一括生成、`yohaku html-write --input fill.json` で AI-managed ブロックへ書き戻し
- **ローカル開発サーバ** (Phase 10): `yohaku serve --port 4000`。`--watch` (Phase 12) でソース変更時に自動 rebuild + SSE によるブラウザ自動 reload
- **Cmd+K グローバル検索** (Phase 11): 全 HTML ページに inline
- **Release Review HTML** (Phase 13): `yohaku diff --from REF --to REF --format html` → `release-review.html`
- **テストカバレッジ統合** (Phase 14): `yohaku coverage import/show` で `sf apex run test` の JSON を取込
- **業務フロー俯瞰タブ** (Phase 15): ホーム 2 番目、domain/object 単位で集約
- **AI-managed ブロック preservation**: `render` 再実行で充填内容が失われない

### Changed

- HTML render 出力先を `<out>/html/component/<type>/<name>.html` ベースに再編
- Mermaid テーマを Salesforce 風 (Brand Navy / Blue / SLDS colors) に統一
- 絵文字を全廃し SVG line-icon に統一

### Fixed

- Apex 抽出器の DML target に変数名が混入する問題を、フロー側で `knownObjects` フィルタにより回避 (extractor 自体の改善は別途 backlog)

## [0.4.1] - 2026-05-19 (Docs sanitize & npm-first quickstart)

> **v0.4.1 は機能変更なしのドキュメント整備リリース**。OSS 公開後の現実 (`@yohakuforce/core` が npm に publish 済み) に合わせてセットアップ手順を `npm install -g` 起点に改め、合わせて公開ドキュメント・ADR から内部情報を取り除いた。配布物 (`dist`) には変更なし。

### Changed — Quickstart の npm 起点化

- `README.md` クイックスタートを `npm install -g @yohakuforce/core` 起点に変更。`npx -p @yohakuforce/core yohaku ...` の代替手順も併記
- `docs/01-getting-started/quickstart.md` §1 を 3 方式 (npm global / npx / source build) に再構成。サンプル取得手順は `git clone --depth 1` で `examples/sample-project` のみ抜き出すパスを明示
- `docs/release-notes/v0.3.0.md` の Getting Started を npm 起点に更新

### Docs — rollout テンプレートの汎用化

- `docs/rollout/*.md` 全 5 ファイルを **自組織導入用の汎用テンプレート集** に書き換え
  - 個人名・固定日付・「ツールを作りました」目線を全て削除
  - `<実施日>` `<発表者名>` `<チーム名>` `<差出人名>` 等のプレースホルダーで再構成
  - バージョン固定値・社内固有値を「最新版」「対象チーム」などの抽象表現に置換
- `docs/rollout/README.md` を新規追加。テンプレート集の使い方・置換すべきプレースホルダーを明示

### Security — 公開ドキュメントの sanitize

- 公開リポジトリ上のドキュメント・ADR から個人名 / 個人パス / 旧 GitHub org 名 (`pro-koya/yohakuforce`) を除去
- ADR (`.agents/knowledge/decisions/`) の `koya` 言及を `メンテナー` / `オーナー` に置換
- `CHANGELOG.md` の `/Users/koya1104` 言及を抽象表現に変更
- `docs/maintenance-runbook.md` / `docs/release-notes/v0.3.0.md` の「koya 確認」「koya 向け」を「メンテナー」に置換

### Verified

- `npm run lint` / `npm run typecheck` / `npm run test` 全 green
- 配布 tarball (`packages/core`): `dist` 変更なし、`files` フィールド経由で `.agents/` `docs/` は配布対象外を再確認
- 公開対象ファイル全文検索: 個人名 / ローカルパス / 旧 org URL のヒット 0 件

### Migration Notes (v0.4.0 → v0.4.1)

- コード変更なし。`npm update -g @yohakuforce/core` で更新可能
- 既存プロジェクトの再 `init` 不要。ドキュメント参照先の URL が変わっただけ

---

## [0.4.0] - 2026-05-15 (OSS 一般公開初版)

> **v0.4.0 は yohakuforce の最初の一般公開リリース**。社内プロジェクトでの実利用を通じて発見した課題 (Claude Code との統合周りの摩擦、LLM のスキーマ誤推測、hook 同期実行による wall-clock 遅延) を構造的に解消し、加えて Salesforce 静的解析の新領域 (バッチ許容件数算出パック) を追加した。
> SemVer 上は引き続き 0.x.x で「API 互換破壊あり得る」期間。v1.0.0 は外部実プロジェクト導入が複数積み上がった段階で宣言する。

### Added — 知識グラフ・スキーマ正本化

- `yohaku graph schema --tables [--table <name>] [--format json|markdown]` を追加。`.yohaku/graph.sqlite` の実テーブル定義を返す。Claude Code 等の LLM が `PRAGMA table_info(...)` を試して `Untrusted query rejected` で失敗するのを避けるための **PRAGMA 代替経路**
- `yohaku graph query` のエラー時に **did-you-mean ヒント** を出すように:
  - PRAGMA 試行 → 「`yohaku graph schema --tables` を使え」
  - camelCase なカラム名 → snake_case 候補をサジェスト (`triggeringObject` → `triggering_object` 等、Levenshtein 距離ベース)
  - 存在しないテーブル名 → 近いテーブル名候補
- `docs/03-reference/knowledge-graph-schema.md` を新規作成。全テーブル・全カラムの正本表 + よくある誤りの一覧

### Added — Claude Code hook の非同期化 (体感速度改善)

- `yohaku graph build --async` を追加。子プロセスを `detached: true, stdio: 'ignore'` で spawn → `unref()` で完全切り離し。hook の wall-clock を数十 ms に抑える
- `.yohaku/build.lock` + `.yohaku/build.dirty` による並行 build の安全な直列化。同時 Edit があっても **最後の変更は必ず取り込む** (1 回だけ rerun)
- `.yohaku/hook-timings.jsonl` への自己計測ログ追加。**2 秒超で stderr に warning** を出して「遅さ」を体感ではなく数字で見える化
- `scripts/bench-graph-build.mjs` 合成ベンチスクリプト + `small/medium/large` preset
- `docs/03-reference/performance.md` を新規作成。計測結果・推奨 hook 構成・既知の高速化ターゲット

### Added — `/analyze-batch-limits` パック (バッチ許容件数 静的解析)

社内プロジェクトでの実運用ノウハウを `scaffold/.claude/` に組み込み:

- **新 agent 4 つ** (`scaffold/.claude/agents/`):
  - `cascade-tracer` (sonnet): DML カスケードを Lv.0 → Lv.N で再帰追跡
  - `apex-query-tracer` (sonnet): Apex の SOQL/DML を A/B/C/D に分類、`__mdt` の `type='LongTextArea'` 判定込み
  - `flow-query-tracer` (haiku): Record-Triggered Flow XML の `<loops>`, `<recordLookups>`, `<recordCreates>`, `<recordUpdates>`, `<recordDeletes>` 解析、Salesforce バルク化仕様準拠 (ループ外 Get Records は常に B 分類)
  - `batch-calculator` (haiku): SOQL=100 / DML=150 上限から推奨バッチサイズを逆算 (×0.8 安全マージン)
- **新 command 1 つ** (`scaffold/.claude/commands/`):
  - `/analyze-batch-limits <ObjectApiName>` — 全エージェントのオーケストレーション、Insert / Update シナリオ別、カスケード条件クロスチェック
- `docs/03-reference/batch-limits-analysis.md` で使い方・規約・SF 特有の落とし穴を明文化

### Changed — scaffold hooks の刷新

- `scaffold/.claude/settings.json.eta` を全面改訂:
  - `PostToolUse` の pathMatcher を `force-app/**` から **メタデータ拡張子のみ** (`*.cls`, `*.trigger`, `*.flow-meta.xml`, `*.object-meta.xml`, `*.field-meta.xml`, `*.validationRule-meta.xml`, `*.permissionset-meta.xml`, `*.profile-meta.xml`) に絞り込み
  - graph build を `--async` 付き呼び出しに変更
  - 新たに `Stop` hook で「セッション末の確実な同期」を追加 (async の取りこぼし保険)
  - `docs/generated/**` への `yohaku validate --target $file` hook を撤去 (パフォーマンスのホットスポットだった)
- `scaffold/.gitignore` に `.yohaku/build.lock`, `.yohaku/build.dirty`, `.yohaku/build-async.log`, `.yohaku/hook-timings.jsonl`, SQLite WAL/SHM を追加

### Changed — メタデータ整合性

- ルート `package.json`: `version` を `0.4.0` に
- `packages/core/package.json`: `version` を `0.4.0` に (旧 `0.0.1` から大幅 bump、初期 stub 値から実バージョンへ)
- `packages/core/src/cli.ts`: `YOHAKU_VERSION` 定数を `0.4.0` に
- `CLAUDE.md` の道具立て表に 3 つの新リファレンス (knowledge-graph-schema / performance / batch-limits-analysis) へのリンクを追加
- `AGENTS.md` に「§6.5 知識グラフのクエリ規約」を新設 (LLM がカラム名で迷わないための短い索引)

### Fixed — コード品質

- `biome` lint 違反 10 件をすべて修正 (テンプレートリテラル化、non-null assertion 除去、`do...while(true)` を明示的なフラグループに書き換え)
- 機能等価で、テスト 310 件全 pass を維持

### Tests

- 既存テスト 258 件 → **310 件** (+52):
  - `sqlite-store-schema.test.ts` (7): `getTableSchemas()` のスキーマ正本テスト
  - `graph-query-hints.test.ts` (8): エラー時 did-you-mean ヒントの統合テスト
  - `timing-log.test.ts` (7): 計測ログの追記・閾値 warning
  - `build-lock.test.ts` (7): lock + dirty flag による直列化
  - `hooks-settings.test.ts` (7): scaffold の hook 構成が事故で後戻りしないことの保証
  - `batch-limits-pack.test.ts` (16): 4 agents + 1 command の存在、front-matter、SQL の snake_case 準拠、SF 仕様 (LongTextArea 判定、Flow バルク化、ガバナ制限値) の正確性

### Verified

- 310 / 310 テスト pass
- `npm run build`, `npm run typecheck`, `npm run lint` 全 green
- `npm audit`: CRITICAL/HIGH 0 件、moderate 5 件は dev only (vitest 経由)
- 公開 tarball スキャン: シークレット・機密ファイル混入なし、ローカル絶対パスや個人情報 0 件
- マルウェアパターンスキャン: 不審 URL / `eval` / `new Function` / 不審 child_process いずれも 0 件
- `package.json` の `files` フィールドで配布対象を `["dist", "src/schema", "README.md", "LICENSE", "NOTICE"]` に限定 (511 files / 270kB)

### Migration Notes (v0.3.0 → v0.4.0)

- 既存プロジェクトは `yohaku init` を再実行すると `.claude/settings.json` の hook 構成が新形式 (`--async` + Stop) に置き換わる。手動カスタマイズしている場合は `--conflict skip` か手動マージで対応
- `.yohaku/` 配下に新規ファイル (build.lock, build.dirty, hook-timings.jsonl) が生成されるようになるため、`.gitignore` を更新 (scaffold で自動配置されるが既存プロジェクトは手動追記)
- LLM (Claude Code 等) から `yohaku graph query` を呼ぶスクリプトを書いている場合、カラム名が **snake_case** であることを再確認推奨 (`PRAGMA` は引き続き拒否される。代わりに `yohaku graph schema --tables` を使う)

---

## [0.3.0] - 2026-05-17 (内部検証 実証フェーズ 公開リリース)

> **v0.3.0 は新機能を追加しない「実証リリース」**である。Week 0 (2026-05-11〜05-13) に発見・修正した既知 pitfalls の解消 (セキュリティ Hotfix + Windows 互換 + スキーマ拡充 + Mermaid 方向修正) を集約し、OSS 公開リポジトリとしての品質基準を整えた。
> v0.3.0 期間の北極星: **「現参画プロジェクトでの実利用 + KPI 計測」** は引き続き実施中。

### Changed — OSS 公開向け仕上げ

- `.gitignore` に内部運用記録ディレクトリ (`.agents/review-result/`, `.agents/v0.3.0/intro/`, `.agents/v0.3.0/playbooks/`, `.agents/v0.3.0/hearing-script.md`) を追加。顧客固有情報の公開防止を明示化
- GitHub リポジトリ description / topics を設定済み
- `package.json`: ルートの `version` を `0.3.0` に更新

### Includes (Week 0 変更の集約)

以下の v0.2.1〜v0.2.4 の変更を本バージョンに集約する:

- **v0.2.4**: Trigger / Flow Mermaid 矢印方向を `Object → Trigger/Flow` に修正 + 回帰防止テスト追加
- **v0.2.3**: Schema enum を Salesforce 公式値で拡充 (sharingModel 等 9 値) + `.github/` PR/Issue テンプレート追加
- **v0.2.2**: Windows パス区切り互換 5 箇所対応 + スキーマ検証エラーの可読性改善
- **v0.2.1**: セキュリティ Hotfix 12 件 (CRIT 1 / HIGH 5 / MED 5 / 推奨 1) 全件対応

### Verified

- 258/258 テスト pass、build OK、lint OK、typecheck OK
- `npm audit`: production 依存の脆弱性 0 件 (残存 5 件は dev-only vitest/vite/esbuild)
- 全ファイルを対象とした顧客固有情報スキャン: 検出なし

### Known Limitations (v0.4.0 で対処予定)

- `method-summary-table` がインライン SOQL `[SELECT ...]` を検出しない ([pitfalls](./.agents/knowledge/pitfalls/2026-05-09-method-summary-table-soql-detection.md))
- `explain-writer` 改善 4 件 (ソース参照オプション / dry-run / 文例追加 / kind 自動判定)
- `yohaku metrics` が Claude Code セッションのトークンを計測していない (手動記録で代替)
- `/yohaku-explain` 一括実行モード (`--all` / カテゴリ単位)

---

## [0.2.4] - 2026-05-13 (Trigger / Flow Mermaid 矢印方向修正 / v0.3.0 Week 0)

> 利用者フィードバック: Trigger Mermaid で `Trigger → Object` という意味的に逆向きの矢印になっていた事象を解消。SObject の DML イベントが Trigger を発火させる関係を表現するため **Object → Trigger** に統一。

### Fixed — Mermaid フローチャートの矢印方向

| 描画関数 | 修正内容 |
|---|---|
| `buildTriggerMermaid` (Trigger 単体描画) | `Trigger → Object` を **`Object → Trigger`** に反転。ラベルは `\|beforeInsert/afterInsert\|` の形に整理 |
| `buildSystemOverviewMermaid` (Trigger ループ) | 同上 |
| `buildSystemOverviewMermaid` (record-triggered Flow ループ) | `Flow → Object` を **`Object → Flow`** に反転 |

### Added — 回帰防止テスト

- Object → Trigger 方向で矢印が描かれることを assert
- 逆方向 (Trigger → Object) が **存在しない** ことも assert

### Verified

- 258/258 テスト pass (2 件追加)、build OK、lint OK

### Note

その他の Mermaid 描画 (Approval Process / Flow 内部要素 / Apex メソッド制御フロー / クラス内呼び出しグラフ) は方向が論理的に正しいことを確認済 (修正なし)。

---

## [0.2.3] - 2026-05-13 (Schema enum 拡充 / v0.3.0 Week 0)

> v0.2.2 で詳細表示された Salesforce enum 漏れを解消。実環境で出現する公式値を網羅。
> 規律 §3.2 遵守 (新 Phase 立てず v0.3.0 Week 0 内で対処)。

### Fixed — Schema enum を Salesforce 公式値で拡充

| フィールド | 追加した値 (公式 Metadata API 仕様) |
|---|---|
| `SObject.sharingModel` | `ReadSelect`, `ReadWriteTransfer`, `ControlledByCampaign`, `ControlledByLeadOrContact` |
| `EntityRef.kind` | `visualforcePage`, `visualforceComponent`, `customApplication` |
| `SharingRule.kind` | `territoryBased` |
| `AuraBundle.bundleKind` | `Interface`, `Tokens` |

`packages/core/src/schema/graph.schema.json` の enum と `packages/core/src/types/graph.ts`
の TypeScript union を両方更新 (同期維持)。

### Verified

- 256/256 テスト pass、build OK、lint OK
- Salesforce Metadata API v62 公式仕様との突き合わせ済み

### Community

- `.github/PULL_REQUEST_TEMPLATE.md` + `ISSUE_TEMPLATE/*` 追加 (第三者貢献を促進)
- main ブランチ保護を有効化 (PR + CI pass 必須、admin 例外)

---

## [0.2.2] - 2026-05-13 (Windows パス互換性 + エラーメッセージ改善 / v0.3.0 Week 0)

> 利用者の **Windows 環境** で `yohaku init --bootstrap` がスキーマ検証エラーで落ちる事象を解消。
> Phase 1 既知制約「Windows パス区切り対応」を v0.3.0 Week 0 で消化 (規律 §3.2 遵守、新 Phase 立てず)。

### Fixed — Windows パス区切り対応 (5 箇所)

OS のパス区切りを返す `path.relative()` の結果を **forward slash で扱えるよう統一**:

- `packages/core/src/adapters/local/local-source-adapter.ts:describeFile` — `sourcePath` を `/` 正規化して保存 (graph データの OS 横断再現性確保)
- `packages/core/src/init/init.ts:shouldSkipFile / isAllowedByProfile` — Windows で profile フィルタが効かず全ファイルが書かれていた
- `packages/core/src/cli.ts:defaultProjectName` — `--project-name` 省略時に Windows でフルパスが project name 化していた
- `packages/core/src/render/archive.ts:relativeUnderRoot` — archive 経路のセグメント分割
- `packages/core/src/diff/classify-files.ts:classifyChangedFile / inferFqn` — git diff の差分分類

### Fixed — スキーマ検証エラーの可読性

`GraphSchemaValidationError` のメッセージに **どの instancePath で何が NG だったか** を最大 5 件表示するように改善。これまでは `1 error(s)` としか出ず、Windows 固有データのどこが schema に合わなかったか調査困難だった。

### Verified

- 256/256 テスト pass、build OK、lint OK (root)
- Mac で空ディレクトリ `init --bootstrap` 成功確認 (回帰なし)

---

## [0.2.1] - 2026-05-11 (セキュリティ Hotfix / v0.3.0 Week 0)

> 機密性の高い実プロジェクトへの導入前監査で検出された **CRITICAL 1 + HIGH 5 + MEDIUM 5 + 推奨 1** の計 12 件を解消。
> v0.3.0 (内部検証実証) 着手前に必須の安全化として、Phase スコープ規律 § 3.2 に従い v0.3.0 Week 0 の範疇で対処。新 Phase は立てていない。

### Security — CRITICAL

- **CRIT-1 (`yohaku graph query` の任意 SQL 実行)**:
  - `packages/core/src/graph/sqlite-store.ts` に `isSafeReadOnlyQuery()` allowlist と `queryUntrusted()` メソッドを追加
  - `cmdGraphQuery` を `new Database(dbPath, { readonly: true })` + SELECT/WITH allowlist の **二重防御** で実行
  - ATTACH DATABASE / multi-statement / コメント隠蔽 INSERT / WITH 内危険構文を全て拒否

### Security — HIGH

- **HIGH-1 (シークレットマスキング未適用)**: `secrets/apply.ts:maskGraphSensitiveFields` を新設、`graph/builder.ts` で `validateGraph` 直前に適用。対象は ValidationRule.errorConditionFormula / errorMessage / CustomMetadataRecord.label / values[].value
- **HIGH-2 (secrets-rules.yaml の ReDoS)**: `secrets/load.ts:compileSafeRegex` で pattern.length 上限 / nested quantifiers 静的検出 / 50ms 実行ベンチマークの三層防御
- **HIGH-3+4 (パストラバーサル)**: `util/path-guard.ts` 新設 (`resolveWithinRoot` / `assertWithinRoot`)。`cli.ts` の `--input` x2、`--target` x1、`explain/index.ts:resolveMarkdownPath` の `fqn` 経路に適用
- **HIGH-5 (git ref インジェクション)**: `diff/git.ts:assertSafeGitRef` で `-` 始まり拒否 + 文字許容パターン + git option 名パターンの明示拒否

### Security — MEDIUM

- **MED-1**: `fast-xml-parser` を `^4.5.0` → `^5.7.3` (CVE 解消)
- **MED-2**: `explain/index.ts:sanitizeBlockBody` で `MARKER_FRAGMENT_PATTERN` を strip し、AI 出力経由のブロック構造攻撃を無害化
- **MED-3**: `scaffold/.claude/commands/yohaku-explain.md.eta` に shell-side FQN 文字検証 (`case ... in *[!A-Za-z0-9_.-]*`) を追加
- **MED-4**: `util/walk.ts` を `lstatSync` + `isSymbolicLink()` skip に変更し、`force-app/` 外部への symlink 経由のメタデータ混入を防止
- **MED-5**: `.gitignore` に `.claude/settings.local.json` を追加 (将来の絶対パス漏洩防止)

### Security — Defense in Depth

- `graph/parse-xml.ts` の `XMLParser` に `processEntities: false` を明示 (XXE 防御の表明)
- `sqlite-store.ts:assertSafeIdentifier` + `ALLOWED_TABLES_FOR_MIGRATE` で migrate 経路の SQL identifier を allowlist 化

### Verified

- 256 テスト全 pass を維持 (1 件のテストは MED-2 の新挙動に合わせて更新)
- `security-reviewer` agent による独立再監査で **CONDITIONAL GO → GO** 判定
- `npm audit`: production 依存の脆弱性 0 件 (残存 5 件は dev-only vitest/vite/esbuild)

### 規律遵守の記録

本リリースは [Phase スコープ規律 ADR](./.agents/knowledge/decisions/2026-05-10-scope-discipline-and-phase-restructure.md) と [v0.3.0 着手 ADR](./.agents/knowledge/decisions/2026-05-10-v0.3.0-internal-validation-plan.md) の Week 0 タスク B (pitfalls 解消) として処理した。**新 Phase は立てず、v0.3.0 内で責任を持って対処** という規律 §3.2 を初実例として実行した。

---

## [0.2.0] - 2026-05-10 (Pre-release / 内部検証 拡充フェーズ完了)

> **本リリースは 2026-05-08 〜 05-09 に「Phase 7〜15」として連鎖実装された 9 個の派生 Phase を、本来 1 つの Phase として完結すべきだった「ドキュメント完全化 + AI 文面生成基盤」テーマとして統合したもの**である ([scope-discipline-and-phase-restructure ADR](./.agents/knowledge/decisions/2026-05-10-scope-discipline-and-phase-restructure.md))。
> 同 ADR で `AGENTS.md` § 3「Phase スコープ規律」と禁則 14「Phase の安易な増殖禁止」を恒久ルール化し、再発を防止する。

### Added — ドキュメント完全化 (Apex / Flow / Trigger / 周辺メタデータ 21 種)

- **対応メタデータ種を 21 種まで拡張** (旧 Phase 7-A 〜 12 経由):
  - 既存: ApexClass / ApexTrigger / Flow / PermissionSet / Profile / ValidationRule / RecordType / GlobalValueSet
  - 新規: ApprovalProcess / SharingRules / Layout / FlexiPage / CustomMetadataType / NamedCredential / RemoteSiteSetting / LWC / Aura / VFP / VFC / CustomApplication / その他
- 各エンティティに対する `docs/generated/` Markdown 描画 (3 種ブロック構造を全面適用)
- 横断ドキュメント:
  - ER 図 (Mermaid)
  - 自動化マトリクス (オブジェクト × Trigger/Flow/Workflow)
  - 権限マトリクス (PermissionSet/Profile × Object/Field × CRUD/FLS)
  - 依存グラフ + ヘルスレポート
- 上層部資料 4 種:
  - Executive Summary (CEO/CIO/事業責任者向け)
  - Architecture Overview
  - Security & Compliance Posture
  - Risk & Change Impact Board

### Added — 処理フロー可視化 (旧 Phase 8 / 9 / 9.x / 13)

- メソッド単位 / Flow 単位の Mermaid フロー図
- Mermaid ノード詳細表 (各ノードの操作内容)
- 全 6 エンティティ Quick Summary
- ValidationRule / 条件式の自然語化
- ApprovalProcess の取り込み + Sharing Rules + PermissionSet 権限マトリクス
- 設計書に「処理概要セクション」「処理詳細セクション」を追加 (Apex / Flow / Trigger)
- Markdown 表崩れ修正 (`postProcessMarkdown`)

### Added — AI 文面生成基盤 (旧 Phase 14 / 15)

- `/yohaku-explain` を **10 種の ExplainKind に拡張** (narrative / business-scenario / key-design-decisions / processing-overview-narrative / processing-details-narrative / operational-notes / summary / business-domain / concerns / その他)
- **Block ID Registry** (`block-registry.ts`) による早期 typo guard
- `scaffold/.claude/commands/yohaku-explain.md.eta` / `scaffold/.claude/agents/explain-writer.md.eta`
- AI_MANAGED ブロックの保全 merge 規則 (`yohaku sync` 再実行で書き戻し内容を破壊しない)
- **5 エンティティ × 21 ブロックを実 AI 推論で書き戻し end-to-end 検証成功** (旧 Phase 15)

### Changed — 規律と計画の整流化

- リリース計画を 3 段階ゴール (内部検証 / 社内展開 / 社外展開) に対応する v0.x.0 体系へ整流化
- `AGENTS.md` に新章「§ 3 Phase スコープ規律」を追加 (§ 番号を 3〜7 → 4〜8 へ再採番)
- `IMPLEMENTATION_GUIDE.md`:
  - 「実装フェーズ一覧」をリリース計画ベースに再構成
  - 旧「Phase 7: 普及フェーズ」を **v0.3.0 内部検証実証 + v0.4.0+ 社内展開 + v1.0.0+ 社外展開** に分割
  - 禁則 14「Phase の安易な増殖禁止」を追加
- `README.md`: 内部検証完了の DoD (5 項目) を明示、ライセンス記述を Apache 2.0 確定に更新
- 既存ナレッジ (`.agents/knowledge/decisions/Phase 1〜15`) は履歴として保全 (改竄しない)

### Verified

- v0.2.0 構成要素: 旧 yohaku-trial で 21 メタデータ種対応・**256 テスト pass** (旧 Phase 14 完了時) を維持
- 実 AI 推論による設計書 end-to-end 検証: 5 エンティティ × 21 ブロックで `updated=21 skipped=0`、`yohaku sync` 再実行後も全保全
- 3 層分離 (DETERMINISTIC / AI_MANAGED / HUMAN_MANAGED) を全エンティティで保全

### Known Limitations (v0.3.0 で対処予定)

- `method-summary-table` がインライン SOQL `[SELECT ...]` を検出しない ([pitfalls](./.agents/knowledge/pitfalls/2026-05-09-method-summary-table-soql-detection.md))
- `explain-writer` 改善 4 件 (ソース参照オプトイン / dry-run mode / 文例追加 / kind 自動判定)
- 再現性 CI (温度 0 / プロンプトハッシュ / N-run 一致)
- 大量エンティティへの一括 explain-write
- LWC / Aura / FlexiPage / VFP / VFC / Lightning App の AI 推論検証

### Known Limitations (v1.0.0 までに対処)

- DX MCP Server 実接続 (Beta 仕様 GA 待ち)
- Permission Set / Profile の詳細権限抽出
- Fine-grained 増分ビルド (現状 incremental は全件書き戻し)
- Windows パス区切り対応
- i18n (英訳)
- Antigravity プラットフォーム実機検証

---

## [0.1.0] - 2026-05-08 (Pre-release / 内部検証 基盤フェーズ完了)

### Added — Phase 1〜6 までの全機能

#### Phase 1: 知識グラフ + CLI 基盤
- `yohaku graph build` (force-app/ → SQLite)
- `yohaku graph query` (SQL クエリ)
- `yohaku graph schema` (JSON Schema 出力)
- `yohaku render system-index/objects` (Markdown 派生物)
- `yohaku validate` (グラフ検証)
- `yohaku version`
- HUMAN_MANAGED ブロックのマージアルゴリズム (6 テストケース)
- メタデータ機密性分類 + マスキング (`secrets-rules.yaml`)
- LocalSourceAdapter + sfdx-project.json packageDirectories 対応

#### Phase 2: Claude Code 統合
- `scaffold/CLAUDE.md.eta` / `AGENTS.md.eta`
- 3 種 subagent (graph-querier / object-documenter / onboarding-guide)
- 3 種 slash command (`/onboard` / `/explain` / `/impact`)
- hooks (`PostToolUse(force-app/**)`)
- `yohaku metrics record/show` (AI コスト計測)

#### Phase 2.5: CLI UX 改善
- `yohaku init --bootstrap` (1 コマンド初回セットアップ)
- `yohaku sync` (1 コマンド日常運用)
- `yohaku render` 引数省略で全描画

#### Phase 3: 差分意味づけ
- `yohaku diff` (Git 差分の決定的検出 + 7 カテゴリ分類)
- change_summary スキーマ + `Tracked<T>` (source 列必須化)
- 5 種 並列分類 subagent (data-model / automation / permission / ui / logic)
- `/classify-diff` slash command
- 一致率 CI 基盤 (`runConsistencyCheck` + `expectMatchRate`)
- Code Analyzer SARIF 取り込み (`--include-static-analysis`)
- `/change-summary` slash command

#### Phase 4: 手動作業管理 + リリース準備
- manual_step / release_doc スキーマ + ajv 強制
- `extractManualSteps` (ルールベース、5 パターン検出)
- 3 種 subagent (manual-step-extractor / release-composer / rollback-drafter)
- `/release-prep` / `/manual-steps` slash command

#### Phase 5: オンボーディング本格化
- `.yohaku/context-map.yaml` (4 persona × 任意ドメイン定義)
- `.yohaku/onboarding-state.json` (gitignore、進捗記録)
- 4 persona 別 subagent:
  - onboarding-guide (new_joiner)
  - review-assistant (reviewer)
  - release-advisor (release_manager)
  - customer-impact-explainer (customer_facing)
- FAQ 抽出 + PII フィルタ (secrets/mask 再利用)
- `yohaku onboard {context, state, faq}` CLI

#### Phase 6: Plugin 化 + アダプタ拡張
- `claude-plugin/plugin.json` (Claude Code Plugin 形式)
- `adapters/dx-mcp/` stub (DX MCP Server アダプタ、Phase 7 で本実装)
- 3 profile (minimal / standard / full) 定着
- npm 公開準備 (CHANGELOG / SECURITY 拡充)
- `examples/sample-project/` 充実

### Verified

- Phase 2 検証ゲート: 利用者の Dev Edition で `/onboard` `/explain` 動作確認
- Phase 3 検証ゲート: yohaku-trial で 3 並列 classifier 動作 (44 秒、分類精度 100%)
- Phase 4 検証ゲート: yohaku-trial で v0.0.0→v0.1.0 リリース準備完走 (4 件手動作業を漏れなく検出)
- Phase 5 検証ゲート: 4 persona subagent + context-map + state + FAQ 全機構動作

### Known Limitations (Phase 7 で対応)

- DX MCP Server 実接続 (Beta 仕様 GA 待ち)
- Permission Set / Profile の詳細権限抽出
- LWC / Aura / Visualforce 構造解析 (現状はメタデータ取り込みのみ)
- Fine-grained 増分ビルド (現状 incremental は全件書き戻し)
- Windows パス区切り対応
- 一致率 CI 実 AI 統合
- i18n (英訳)
- Antigravity プラットフォーム実機検証

## [Pre-0.1.0]

Phase 1 着手前の準備期間 (2026-05-06 〜 2026-05-07):
- README / CLAUDE / AGENTS / IMPLEMENTATION_GUIDE 確立
- メタ層 vs 配布物層の物理分離 (`scaffold/`)
- Apache License 2.0 確定
- ナレッジ蓄積機構 (`.agents/knowledge/`) 立ち上げ
