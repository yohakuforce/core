# yohakuforce — Harness-Specific Prompts

このディレクトリは、Claude Code 以外の AI ハーネス (Codex / Antigravity / ローカル LLM) で
yohaku を使うためのプロンプト群です。

| ディレクトリ | 対象ハーネス | 配置先 |
|---|---|---|
| `codex/`        | OpenAI Codex CLI / Codex Web | プロジェクト root の `AGENTS.md` に取り込む |
| `antigravity/`  | Google Antigravity            | プロジェクト root の `AGENTS.md` に取り込む |
| `local-llm/`    | Ollama / llama.cpp / 自前 SDK | system prompt にチートシートを貼る (`local-llm/README.md` 参照) |
| `shared/`       | 全ハーネス共通                | コピペで使用 |

## 設計方針

- **CLI が唯一の真実**: 全ハーネスで `yohaku render --format md,html` などの CLI 呼び出しが
  決定的に同じ出力を生成します。プロンプトは「ハーネスごとに導線を作る」役割だけです。
- **No LLM in build path**: ビルドパスは決定的処理のみ。LLM 補完は編集マーカー内
  (`<!-- yohaku:block kind="ai_managed" ... -->`) でのみ行う。

## 動作確認手順 (各ハーネス共通)

1. `yohaku graph build` が走る (既存)
2. `yohaku render --format md,html` で `docs/generated/html/index.html` が生成される
3. `yohaku domains init` を一度だけ実行 (初回)
4. ホームを開いて Apex / Trigger / LWC / Object / Flow のリストが表示される
