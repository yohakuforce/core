---
type: decision
date: 2026-06-06
title: SOQL 詳細・項目代入は「決定的に抽出 → ai_managed の skeleton として seed → LLM が上書き可」とする
status: active
tags: [apex, soql, field-writes, detailed-design, ai-managed, determinism, html-render, explain-prompts]
---

# SOQL 詳細・項目代入は「決定的に抽出 → ai_managed の skeleton として seed → LLM が上書き可」とする

## 判断

Apex の詳細設計書に、

1. **SOQL 詳細**（どのオブジェクトを / どの項目を / どの条件で取得するか）
2. **項目への値の割り当て**（このオブジェクトのこの項目にこの値を、どの操作で）

を表形式で出す。両者とも **決定的パーサで初期値（skeleton）を生成**し、それを既存の **`ai_managed` ブロックの `skeleton`** として埋め込む。`ai_managed` なので **LLM が html-write で上書きでき、上書きは preserve-blocks で再生成をまたいで保持**される。

- 決定的 skeleton = 常に再生成される「床（floor）」。LLM 不在でも正しい初期値が出る。
- LLM 上書き = 条件の業務的意味補足・動的 SOQL/動的代入の取りこぼし修正など、非決定的だが本質的な詳細。
- 既存の placeholder（空 → LLM 生成）を、**決定的に埋まった表 → LLM が上書き** へ格上げした、というのが本質。

## なぜこの形か（3 層分離・禁則との整合）

ユーザ（koya）の要望は「決定的にほとんど書く今の設計書に、LLM の修正・追記を柔軟に許容したい（非決定的になってよい）」。これは一見、禁則「**AI による決定的処理の代替禁止**」と衝突しうる。

衝突を避ける鍵が **skeleton seed**:

- 決定的に取れる事実（取得項目・WHERE・LIMIT・`receiver.field = value`）は **決定的処理が出す**（＝ AI 代替ではない）。
- LLM は「決定的に取り切れない部分（条件の意味、動的 SOQL、putSObject 等）」だけを上乗せ・修正する。
- 出所は既存の `ai_managed` マーカーと placeholder/preserve の仕組みで可視（決定的 skeleton か、LLM 充填か）。

→ 「決定的を床にして、その上に AI を重ねる」三層分離の原則どおり。`Voice`/`AESTHETIC` 的にも「機械が取れるものは機械が、判断は人/AI が」。

ユーザは UI 上の選択で「表セルも LLM が直接編集可（完全非決定）」を選んだが、**決定的 skeleton を残す**ことで「正本は実装側」を担保しつつ要望（LLM が上書き可）も満たす、という折衷にした。

## 実装サマリ

決定的抽出（`graph/extractors/`）:
- `soql-parse.ts` — `raw` SOQL を括弧深度を見てトップレベル句（SELECT/FROM/WHERE/ORDER BY/LIMIT）に分解。`ApexSoqlInfo` に `fields` / `whereClause` / `orderByClause` / `limitClause` を追加。
- `apex-field-writes.ts` — `receiver.field = value` を抽出。変数→SObject 型マップ（宣言 / new / for-each）で object 解決、後続 DML から操作種別、直近メソッド宣言から methodName を推定。`ApexBodyInfo.fieldWrites` を追加。
- **SOQL/項目代入はコメントのみ除去した本文（文字列リテラル保持）から抽出**する。WHERE 値・設定値リテラルが意味を持つため（`stripApexNoise` の `''` 置換では値が消える）。`stripApexComments` を新設。

描画（`html/viewmodel/`）:
- `apex-query-detail.ts` — データモデル接点に「SOQL 詳細」表を `ai_managed(id=query-detail)` の skeleton として出す。
- `apex-field-writes.ts` — 既存の per-object タブの空 placeholder を、`fieldWrites` 由来の決定的表（項目/設定値/操作/メソッド）で seed。

AI 配線（`explain-prompts/`）:
- context に `soqlDetail` / `fieldWrites` を追加。
- `ExplainBlockKind` に `processing-detail-narrative` を追加（**既定には含めず opt-in**。`--kind` で明示）。SOQL の項目/条件・代入の値/条件まで踏み込んだ処理詳細を LLM に書かせる。HTML マーカー `processing-detail-narrative` に対応。

## 限界（既知・許容）

- 動的 SOQL（文字列結合）・動的代入（putSObject 等）は決定的には取れない → skeleton 注記 + LLM 補完前提。
- リテラル保持で抽出するため、文字列リテラル内に `]` を含む SOQL は `[...]` の貪欲最小マッチで途中終了しうる（稀）。
- `receiver.field = value` のみ対応（`+=` 等の複合代入は未対応）。

## 影響

- `ApexSoqlInfo` / `ApexBodyInfo` への追加は **すべて optional** で後方互換。既存テスト・golden は不変で通過。
- 既定の `explain-prompts` 出力は不変（新 kind は opt-in）。

## Flow への展開（同日・同方針）

Apex と対称に Flow にも同じ「決定的 seed → ai_managed → LLM 上書き」を適用した。

- 型: `FlowRecordFilter` / `FlowFieldAssignment` を追加し、`FlowElementInfo` に `queriedFields` / `filters` / `filterLogic` / `inputAssignments` / `inputReference` / `sortField` / `sortOrder` / `getFirstRecordOnly` を optional 追加（後方互換）。
- 抽出: `flow-body.ts` の record 要素から上記を抽出。`flowValueToString` で FlowElementReferenceOrValue（stringValue / elementReference `{!ref}` / booleanValue / numberValue 等）を表示用文字列化。Flow XML は既に parse 済みオブジェクトで渡るため `asArray`/`asString`/`asBoolean` を使用。
- 描画: `html/viewmodel/flow-detail.ts` を新設し、`data-model-touchpoints` セクション内に
  - 「レコード取得・絞り込み 詳細」表（要素/操作/オブジェクト/取得項目/絞り込み条件/並び/件数、id=`flow-query-detail`）
  - 「項目値の割り当て」表（要素/オブジェクト/操作/項目/設定値、id=`flow-field-writes`）
  を ai_managed skeleton として seed。Flow は schema 上 `field-writes`/`field-assignment` セクションが not-applicable のため、新セクションを足さず data-model-touchpoints 内に同居させて audit を回避。
- AI 配線: `buildContextForFlow` に `recordDetail` / `fieldAssignments` を追加。`processing-detail-narrative` kind は flow にも applicable。
- 実 XML スモークで filters(`Tier__c EqualTo 'Gold'`) / inputAssignments(`Tier__c ← 'Platinum'`) が正しく表へ出ることを確認（full suite 565 passed）。

## 残（Flow）

- decision 要素の分岐条件と record 操作の結びつき（どの分岐で設定されるか）は決定的には出さず LLM 補完前提。
- Loop 内 record 操作の集約・filterLogic のカスタム式の可視化は未対応。

## koya フィードバック対応（同日・3点 + α）

1. **SOQL 主オブジェクトのバグ修正**: サブクエリを含む SOQL で `SOQL_FROM_REGEX` が最初の FROM（=サブクエリの `FROM Inventories__r`）を主オブジェクトに誤検出していた。`soql-parse` に**トップレベル FROM**（括弧深度 0）の解決を追加し `ApexSoqlInfo.primaryObject` を正す。これにより全クエリで項目・オブジェクトのラベル解決が効くようになった（例: クエリ2 が `Inventories__r` → `ロット Lot__c`）。
2. **Apex / Flow の記述統一**: 「取得(クエリ)」= 1クエリ/1要素=1表の縦カード、「項目割り当て」= `項目/設定値/操作/設定箇所` の表、で Apex と Flow をそろえた。Flow の項目割り当てを旧「設定項目←値」リストから Apex と同じ表形式（オブジェクト単位パネル）に変更。
3. **Flow フローチャート**: 既存の `render/flow-flowchart.ts`（`buildFlowFlowchart`）を `internal-flow` セクションに配線。`method-flowchart.js`（既存・Flowページにも読み込み済）が `.mermaid-host` を描画するため、同じ `.method-flow / .mermaid-host / .mermaid-source` 構造で出力し、フローチャート/テーブル切替を再利用。
4. **(α) Flow 起動条件**: レコードトリガ Flow の `start`（object / recordTriggerType / filterFormula or filters）を抽出（`FlowStartTrigger`）し、io-contract に「起動条件（いつ動くか）」表を追加。非エンジニアが「いつ動くか」を読めるように。
5. **(α) XML エンティティ復号**: parse-xml は XXE 対策で `processEntities=false`。filterFormula 等の `&quot;` がそのまま出ていたため、Flow の表示テキストに限り定義済み 5 エンティティのみ安全に復号する `decodeBasicXmlEntities` を追加。

全体: full suite 577 passed。`makeFieldLabelResolver` + `renderRefInline` でラベル＋API名併記＝日本語可読＋曖昧さゼロ。CSS（query-card / detail-kv / detail-list）追加済。
