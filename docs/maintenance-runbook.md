# Maintenance Runbook

> メンテナー向けの運用手順書。Issue トリアージ / PR レビュー / リリースプロセスを記載する。

---

## Issue トリアージ

### ラベル体系

| ラベル | 意味 | 対応期限 |
|---|---|---|
| `bug:critical` | データ消失 / セキュリティ脆弱性 | 7 日以内にパッチリリース |
| `bug:high` | 主要機能の不具合 | 次回マイナーリリース |
| `bug:medium` | 周辺機能の不具合 | 次回マイナーまたはパッチ |
| `enhancement` | 機能改善・追加要望 | ロードマップで判断 |
| `docs` | ドキュメント修正 | 随時 |
| `question` | 使い方の質問 | Discussions へ誘導 |

### セキュリティ Issue

脆弱性報告は [SECURITY.md](../SECURITY.md) のフローに従う。GitHub Issue は使わず、GitHub Security Advisories 経由で受け付ける。

### トリアージ手順

1. `bug:critical` / `bug:high` はすぐにアサインし、再現手順を確認
2. `enhancement` は現在 Phase の Out of Scope かを確認 ([IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) 参照)
3. Scope 外の要望は `improvements/` に記録して close（「次バージョン候補として記録しました」と返答）
4. 重複 Issue は元 Issue にリンクして close

---

## PR レビュー基準

### レビュー必須チェックリスト

- [ ] CI (lint / typecheck / test) が全て pass している
- [ ] テストカバレッジが 80% 以上を維持している
- [ ] 設計 3 原則（3 層分離 / 正本は実装側 / AI に生データを読ませない）を違反していない
- [ ] 顧客固有情報が混入していない
- [ ] CLAUDE.md / AGENTS.md の禁則 14 か条に抵触していない
- [ ] 破壊的変更がある場合は CHANGELOG.md に `### Breaking Changes` セクションがある

### 承認基準

| 重大度 | 対応 |
|---|---|
| CRITICAL (セキュリティ / データ消失) | マージ不可 — 修正必須 |
| HIGH (設計原則違反 / 主要バグ) | マージ不可 — 修正必須 |
| MEDIUM (コード品質) | コメントで指摘、修正推奨 |
| LOW (スタイル) | コメントのみ、任意対応 |

---

## リリースプロセス

### バージョニング

SemVer に準拠:
- `v0.x.0`: リリース計画ベースのマイルストーン（内部検証 / 社内展開 / 社外展開）
- `v0.x.y`: バグ修正 / セキュリティパッチ

### リリース手順

```bash
# 1. テスト / lint / typecheck がすべて GREEN であることを確認
npm run build && npm run lint && npm run typecheck && npm test

# 2. CHANGELOG.md に新バージョンセクションを追加
# (未リリースの [Unreleased] セクションを [vX.Y.Z] - YYYY-MM-DD に変換)

# 3. package.json のバージョンを更新
# (ルートと workspace 配下の package.json を同期)

# 4. docs/release-notes/vX.Y.Z.md を作成

# 5. リリースコミット
git add package.json CHANGELOG.md docs/release-notes/vX.Y.Z.md
git commit -m "chore: release vX.Y.Z"

# 6. アノテーション付きタグを作成
git tag -a vX.Y.Z -m "vX.Y.Z — <リリースタイトル>"

# 7. メンテナー確認後に push
git push origin main
git push origin vX.Y.Z

# 8. GitHub Release 作成
gh release create vX.Y.Z \
  --title "vX.Y.Z — <リリースタイトル>" \
  --notes-file docs/release-notes/vX.Y.Z.md \
  --latest
```

### Hotfix プロセス

```bash
# main から hotfix ブランチを切る
git checkout -b fix/critical-security-issue

# 修正 + テスト
# ...

# main にマージ後、パッチバージョンでリリース
```

---

## 依存関係の管理

```bash
# 定期的に実行 (月 1 回目安)
npm audit
npm outdated

# production 依存に脆弱性がある場合は即対応
# dev 依存は次回リリースまでに対応
```

Dependabot の設定は `.github/dependabot.yml` で管理（Phase 7 で設定予定）。

---

## ナレッジ蓄積

リリースサイクルごとに以下を実施:

1. `.agents/knowledge/retrospectives/YYYY-MM-DD-vX.Y.Z.md` に振り返りを書く
2. 新たに発見した pitfalls / wins / improvements を対応ディレクトリに追記
3. `.agents/knowledge/INDEX.md` に 1 行サマリを追加
