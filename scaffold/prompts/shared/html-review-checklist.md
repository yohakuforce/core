# HTML 設計書レビューチェックリスト (全ハーネス共通)

`docs/generated/html/index.html` を人間レビューに出す前に、以下を確認する。

## サマリ視点

- [ ] ホームの「統計」タブで各タイプのカウントが想定通りか
- [ ] 「アーキテクチャ」タブが Mermaid で描画されているか (失敗時は HTML(safe) に自動切替)
- [ ] 「ドメインマップ」タブが空でないか (空なら `yohaku domains init` 未実行)
- [ ] サイドバーから 5 タイプ全て辿れるか

## Component leaf 視点 (任意の 1 件を抜き打ち)

- [ ] 12 セクションが全て生成されているか
- [ ] 「業務的意味づけ」「既知の懸念」のマーカーブロックが空のままなら、後段で AI 補完が必要
- [ ] 「依存関係」が graph と一致しているか (手動 grep で1〜2件確認)
- [ ] 「影響範囲ヒント」のコマンドが `yohaku impact <correct-entity-ref>` 形式か

## --strict の使い分け

- リリース前 / CI: `yohaku render --format html --strict` で必須セクション欠落を fail
- 日常開発: `--strict` 無しで warn のみ
