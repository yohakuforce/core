# Cross-Harness Validation — yohaku

**目的**: LocalLLM / Claude Code / Codex / Antigravity の全 4 環境で yohaku が同等に使えることを実証する。
**設計原則**: ハーネス依存は「呼び出し導線 (prompt / slash)」だけに閉じ、CLI 出力は全環境で同一。

> このドキュメントは検証スナップショットです。実機検証が進むたびに「結果」列を更新してください。

---

## サマリ (2026-05-31 時点)

| ハーネス | 配布物 | CLI 直接呼び出し | 実機検証 | 状態 |
|---|---|---|---|---|
| **Claude Code** | `scaffold/.claude/commands/` (スラッシュ 13 件) | ✅ | ✅ sfai-trial で全機能 | **実証済** |
| **Codex** | `scaffold/prompts/codex/AGENTS-snippet.md` (Phase 0〜15) | 未検証 | ⏳ Mac mini 待ち | 配布物 Ready |
| **Antigravity** | `scaffold/prompts/antigravity/AGENTS-snippet.md` (Phase 0〜15) | 未検証 | ⏳ Mac mini 待ち | 配布物 Ready |
| **LocalLLM** | `scaffold/prompts/local-llm/README.md` | 未検証 | ⏳ Mac mini 待ち | 配布物 Ready |

凡例: ✅ 完了 / ⏳ 環境待ち / 未検証

---

## 共通スモークテスト手順

どのハーネスでも、CLI 経由で以下が通れば「一通り使える」と判定する:

```bash
1. yohaku init --bootstrap                                       # scaffold 配置
2. yohaku graph build                                            # 知識グラフ構築
3. yohaku render --format md,html                                # 設計書生成 (md+html)
4. yohaku explain-prompts --output prompts.json && head -50 prompts.json  # 充填 prompt
5. yohaku serve --port 4000                                      # ブラウザでホームが開けば PASS
```

---

## ハーネス別の検証記録

### Claude Code — ✅ 実証済

- **配布物**: `scaffold/.claude/commands/*.md.eta` (13 件)
  - 既存: `yohaku-html-build`, `yohaku-domains`, `yohaku-explain`, `impact`, `explain`, ほか
  - Phase 8〜15 追加 (本セッション): `yohaku-explain-prompts`, `yohaku-html-write`, `yohaku-serve`, `yohaku-diff-html`, `yohaku-coverage-import`
- **検証環境**: `~/Desktop/01_active/sfai-trial/`
- **結果**:
  - `.yohaku/graph.sqlite` + `domains.yaml` + `coverage.json` + `docs/generated/html/` 一式を生成
  - `yohaku serve --port 4500 --watch` でホーム / 業務フロータブ / Cmd+K 検索が動作
  - render → explain-prompts → html-write → render 再実行で充填 preservation を確認
- **TODO**: 追加スラッシュ 5 件を sfai-trial で個別に叩く回帰確認 (Mac mini で自動化)

### Codex — ⏳ Mac mini 待ち

- **配布物**: `scaffold/prompts/codex/AGENTS-snippet.md` (Phase 0〜15 のコマンドを記載済)
- **検証手順** (実機で実施):
  1. OpenAI Codex CLI / Codex Web で対象プロジェクトを開く
  2. snippet をプロジェクト root の `AGENTS.md` に取り込む (既存があればマージ)
  3. 「設計書を HTML で生成して」→ `yohaku render --format md,html` が実行されるか
  4. 「業務フローを見たい」→ `yohaku serve --port 4000` 起動を提案できるか
  5. 結果を本ドキュメントの該当行に追記
- **結果**: 未取得

### Antigravity — ⏳ Mac mini 待ち

- **配布物**: `scaffold/prompts/antigravity/AGENTS-snippet.md` (Phase 0〜15 + 自律実行向けワークフロー)
- **検証手順**: Codex と同手順。加えて長時間自律実行での挙動差異を snippet にフィードバック
- **結果**: 未取得

### LocalLLM (Ollama 等) — ⏳ Mac mini 待ち

- **配布物**: `scaffold/prompts/local-llm/README.md` (CLI チートシート + 充填ループ手順)
- **検証手順** (実機で実施):
  1. Ollama + 小さい coder モデル (例 `qwen2.5-coder`) を用意
  2. LLM → bash 経由で `yohaku --help` → コマンド発見可能性を確認
  3. `yohaku render --format html` / `yohaku serve` / `yohaku explain-prompts` を引数だけで叩けるか
  4. LLM 出力 → `yohaku html-write` 接続を最小手順で通す
- **結果**: 未取得

---

## 既知の制約

- 実機検証 3 環境 (Codex / Antigravity / LocalLLM) は **Mac mini 到着後** に実施予定。
  現時点では配布物 (prompt / snippet) のみ整備済で、CLI 出力の同一性は Claude Code で担保。
- CLI は全ハーネス共通なので、配布物の差異は「導線の出し方」だけ。CLI 本体の回帰は
  `packages/core` のテストスイート (497 passed) でカバーされる。
