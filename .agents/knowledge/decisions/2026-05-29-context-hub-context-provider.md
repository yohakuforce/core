---
type: decision
date: 2026-05-29
title: プロジェクト/顧客コンテキストは ContextProvider アダプタ層として Context-Hub から取り込む
status: active
tags: [context-hub, mcp, architecture, context-provider, data-boundary]
---

# プロジェクト/顧客コンテキストは ContextProvider アダプタ層として Context-Hub から取り込む

## 判断

Salesforce 実装・説明・変更要約の際に必要となる **プロジェクト固有のコンテキスト**（顧客との細かなやり取り、会議の決定事項、課題の経緯）を、本 OSS にハード依存させず **`adapters/context-hub/` というアダプタ層** として取り込む。

- 取り込み元は内部サービス **Context-Hub**（別プロジェクト、顧客機密を扱う）。
- 接続は Context-Hub の **MCP サーバ（stdio トランスポート）** 経由。
- `ContextProvider` インターフェースを `types/context-provider.ts` に定義し、デフォルト実装は **`none`（外部コンテキスト無し）**。`context-hub` 実装は **opt-in**。
- 既存の `SourceAdapter`（Salesforce メタデータ源）とは **別の抽象**として切る。両者は扱うデータの種類が異なる。

この設計は [2026-05-07 dx-mcp-adapter-pattern](./2026-05-07-dx-mcp-adapter-pattern.md) の「公式/外部依存はアダプタ層で後付け・opt-in」という前例を踏襲する。

## 文脈

### なぜ SourceAdapter に乗らないか

`SourceAdapter`（`list() -> MetadataDescriptor[]`, `loadContent() -> string`）は **Salesforce メタデータ源** 専用の抽象。Context-Hub が返すのは会議・Slack・課題・顧客やり取りという **別カテゴリのコンテキスト**であり、ここに混ぜるのは category error。独立した `ContextProvider` 抽象を新設する。

### core は LLM を呼ばない — 注入点は「足場への証拠提供」

本 OSS の `explain` / `change-summary` は **決定的な足場生成 + 外部 AI による本文生成 + 安全な書き戻し** という三層構造を取る（`Tracked<T>` で deterministic / ai / human の出所を必須化）。core 自身は LLM API を一切叩かない。

したがって「AI プロンプトに顧客コンテキストを注入する」という作業は core の TS コード内の LLM 呼び出し時点では発生しない。正しい注入点は次の2層に分かれる:

1. **データ層（core / TS）**: `ContextProvider` と新コマンド `yohaku context <kind> <fqn>` が、対象メタデータに関連する顧客コンテキストを Context-Hub から**決定的に取得**し、証拠として出力する。
2. **オーケストレーション層（scaffold / .claude）**: `explain-writer` サブエージェントや change-summary 系コマンドが、`yohaku context` の出力を**材料に追加**し、AI_MANAGED ブロック本文へ反映する。

`explain-writer` の現行「材料 (これだけを使う)」は DETERMINISTIC ファクトに限定されている。本変更でここに「Context-Hub 由来のプロジェクト文脈」を追加する（出所明示つき）。

### Context-Hub MCP の適合性

Context-Hub の MCP サーバは **stdio トランスポート（localhost 限定・同一マシン内通信）** で以下を提供:
`get_project_context` / `search_context` / `get_issues` / `get_issue_detail` / `get_meeting` / `get_members`。

stdio = 同一マシン内のため、**顧客機密データが社内 PC から外に出ない**。AI-Project-Manager 構想書の最上位制約「プロジェクト実データは社内 PC 完結・持ち出し厳禁」と構造的に一致する。

## データ境界（最重要）

core は公開 OSS（`@yohakuforce/core`）、Context-Hub は顧客機密を扱う内部サービス。両者を繋ぐ以上、以下を**設計で強制**する。

| ルール | 内容 |
|---|---|
| opt-in 限定 | `context-hub` プロバイダは設定（spawn コマンド/エンドポイント）がある環境でのみ起動。デフォルト `none`。OSS 利用者には影響ゼロ |
| 実行時メモリ限り | Context-Hub から取得した顧客コンテキストは**プロンプト材料として実行時にのみ保持**。`graph.sqlite` 等の core 成果物には**永続化しない** |
| 生成物の取り扱い | 顧客コンテキストを反映した `docs/generated/*.md`（AI_MANAGED ブロック）は顧客情報を含みうる。**公開リポジトリへ push しない**運用を前提とし、生成物の置き場は社内リポジトリに限定する旨をドキュメント明記 |
| トランスポート | stdio（localhost）を既定とし、HTTP リモート接続は当面サポートしない |

## 再現性ガバナンス（Tracked<T> 拡張）

Context-Hub 由来のコンテキストが AI 出力に効いた場合、**どの会議/課題/やり取りが根拠か**を追跡可能にする。`Tracked<T>` に Context-Hub 由来を表す出所メタ（例: `source: "context"` + `contextRefs: [{kind, id}]`）を持たせ、change-summary / explain の出力に証拠リンクを残す。これにより「AI がでっち上げた背景」と「実際の顧客やり取りに基づく背景」を監査で区別できる。

## 代替案

| 案 | 採否 | 理由 |
|---|---|---|
| A. **ContextProvider アダプタ層を OSS core に opt-in 追加** | 採用 | dx-mcp 前例と整合、OSS 純度を保ちつつ社内で有効化可能、データ境界を強制しやすい |
| B. SourceAdapter に相乗り | 却下 | 扱うデータ種別が異なる category error。SF メタデータ抽象を汚染する |
| C. context-hub 実装を別 private パッケージに分離 | 不採用（保留） | OSS 純度は最大だが 2 リポジトリ管理コスト。インターフェースは OSS、実装も opt-in で OSS 内に置く方針を優先 |
| D. core が LLM を直接叩いて注入 | 却下 | core の「決定的コア + 外部 AI 生成」哲学と再現性ガバナンスを破壊する |

## アダプタ設計の最小骨子

```
core (TS, deterministic)
   │
   ├── SourceAdapter (既存: SF メタデータ源 / local・dx-mcp)
   │
   ├── ContextProvider (新規 IF: types/context-provider.ts)
   │     ├── NoneContextProvider     (default, OSS-safe, 何も返さない)
   │     └── ContextHubProvider      (opt-in, Context-Hub MCP stdio 経由)
   │           tools: get_project_context / search_context /
   │                  get_issues / get_meeting / get_members
   │
   └── `yohaku context <kind> <fqn>` コマンド
         → ContextProvider に関連コンテキストを問い合わせ、証拠として出力
              ↓ (材料として消費)
scaffold/.claude (orchestration, external AI)
   ├── explain-writer subagent     … 材料に「Context-Hub 由来文脈」を追加
   └── change-summary command      … 変更の背景（顧客要望/会議決定）を反映
```

- `ContextProvider` IF: `relatedContext(target: {kind, fqn}) -> Promise<ContextBrief>`（関連コンテキスト要約 + 証拠 refs）を最小メソッドとする。
- `ContextHubProvider` は MCP stdio クライアントを内包（dx-mcp 同様、公式 MCP TypeScript SDK 経由）。
- 有効化は `yohaku init --context context-hub` ないし設定ファイルで opt-in。未設定なら `none`。

## トレードオフ

- `ContextProvider` 抽象を先に切ることで多少のオーバーヘッド → 後付け分離より安価（dx-mcp と同じ判断）。
- 顧客機密の取り扱いが OSS リポジトリの責務範囲に入る → データ境界ルールをドキュメントとコード（opt-in/非永続）の両方で強制し、生成物の公開禁止を明記して対処。
- Context-Hub の MCP/スキーマ変更に追従が必要 → 結合は MCP ツール契約に限定し、AI-Project-Manager 側で確立した「契約テスト」方式を core 側にも適用する。

## 影響範囲

- `packages/core/src/types/context-provider.ts` 新設、`adapters/context-hub/` 新設、`adapters/none/` または既定 none 実装。
- `yohaku context` コマンドを CLI に追加。
- `scaffold/.claude/agents/explain-writer.md.eta` の「材料」節に Context-Hub 由来文脈を追加。change-summary 系コマンドにも背景反映を追加。
- README / IMPLEMENTATION_GUIDE にデータ境界章（生成物の公開禁止、opt-in 手順）を追記。
- `profiles`（minimal/standard/full）での context-hub 有効化方針を定義（当面 full のみ想定）。

## 関連

- [2026-05-07 dx-mcp-adapter-pattern](./2026-05-07-dx-mcp-adapter-pattern.md) — opt-in アダプタ前例
- AI-Project-Manager / Context-Hub の camelCase 契約修正（2026-05-29）— 同じ Context-Hub を消費する姉妹結合。契約テスト方式を流用する
