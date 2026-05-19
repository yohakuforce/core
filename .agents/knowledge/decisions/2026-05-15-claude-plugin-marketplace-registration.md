---
type: decision
date: 2026-05-15
title: Claude Plugin Marketplace 登録方針と準備状況
status: active
tags: [v0.3.0, oss-release, claude-plugin, marketplace]
---

# Claude Plugin Marketplace 登録方針と準備状況

## サマリ

v0.3.0 公開リリースに際して、Claude Code Plugin 形式 (`claude-plugin/plugin.json`) の
登録準備状況と今後の方針を記録する。

## 現状 (2026-05-15)

Claude Code Plugin の公式 Marketplace は、Anthropic によると現在 **ベータ段階** にあり、
一般登録フローは公開されていない。主な配布経路は以下の 2 つ:

1. **GitHub リポジトリからの直接利用** (現在の推奨経路)
   ```bash
   git clone https://github.com/yohakuforce/core
   npm install && npm run build
   npm link --workspace @yohakuforce/core
   ```

2. **Plugin 形式での利用** (将来の経路)
   `claude-plugin/plugin.json` が整備されており、Marketplace が GA になれば登録可能。

## `claude-plugin/plugin.json` の現状

`claude-plugin/plugin.json` は Phase 6 で整備済み。以下の要素が含まれる:
- メタデータ (name / version / description / license / homepage / keywords)
- 互換バージョン (`claude-code >= 1.0.0`, `node >= 20.0.0`)
- インストール手順 (`npm install -g @yohakuforce/core`)
- scaffold 参照 (agents / commands / hooks / knowledge_templates)
- 3 プロファイル (minimal / standard / full)

不足している要素:
- スクリーンショット (Marketplace 要件に含まれる可能性)
- 英語版説明文 (i18n は v1.0 で対応予定)
- 動作デモ GIF

## 採用方針

**v0.3.0 時点では GitHub 直接配布を一次経路とし、Marketplace 登録は v0.4.0 以降に延期する。**

理由:
- Marketplace が GA でないため、正式登録フローが不明確
- npm publish も今回はスコープ外 (v0.4.0 で改名移行後に行う)
- v0.3.0 の北極星は「実利用 + KPI 計測」であり、配布チャネル拡張は Out of Scope

## v0.4.0 以降の準備事項

1. npm publish: `@yohakuforce/core` を npm に公開 → `npm install -g` が使えるようになる
2. plugin.json の install.command を更新 (`npm install -g @yohakuforce/core`)
3. Marketplace 登録フロー確認 (Anthropic 公式 Docs を参照)
4. 英語版 plugin.json / README 作成
5. スクリーンショット / デモ GIF の整備

## メンテナーへの確認事項

特になし。本 ADR は メンテナー承認済み方針 (今回は登録送信しない) を記録したもの。
