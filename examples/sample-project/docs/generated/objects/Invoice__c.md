# Invoice (Invoice__c)

<!-- DETERMINISTIC_START id="overview" -->
- API Name: `Invoice__c`
- Custom: true
- Sharing Model: Private
- Plural Label: Invoices
- Source: `force-app/main/default/objects/Invoice__c/Invoice__c.object-meta.xml`
- Content hash: `sha256:7f8a7ec41e148c9a9e24e1db30ef5b81b66defeea4c39b10fd17011c060603de`
<!-- DETERMINISTIC_END id="overview" -->

<!-- DETERMINISTIC_START id="fields" -->
## Fields (3)


| API Name | Type | Required | Custom | References |
|---|---|---|---|---|
| `Amount__c` | Currency | ✓ | ✓ |  |
| `IsPaid__c` | Checkbox |  | ✓ |  |
| `Order__c` | Lookup | ✓ | ✓ | Order__c |


<!-- DETERMINISTIC_END id="fields" -->

<!-- DETERMINISTIC_START id="validation-rules" -->
## Validation Rules (0)


(なし)

<!-- DETERMINISTIC_END id="validation-rules" -->

<!-- DETERMINISTIC_START id="dependencies" -->
## Dependencies (0)


(なし)

<!-- DETERMINISTIC_END id="dependencies" -->

<!-- AI_MANAGED_START id="summary" -->
このオブジェクトの役割と用途 (AI 生成、再生成で上書き)。
<!-- AI_MANAGED_END id="summary" -->

<!-- AI_MANAGED_START id="narrative" -->
## このオブジェクトは何で、なぜ存在するか

このオブジェクトが業務上どの実体を表しているか、なぜカスタムオブジェクトとして切り出されているかを 2〜3 段落で記述する (AI 生成)。
<!-- AI_MANAGED_END id="narrative" -->

<!-- AI_MANAGED_START id="business-domain" -->
## 業務ドメインと位置付け

このオブジェクトが属する業務領域 (請求 / 在庫 / 与信 / 案件 等) と、隣接オブジェクトとの関係を記述する (AI 生成)。
<!-- AI_MANAGED_END id="business-domain" -->

<!-- HUMAN_MANAGED_START id="business-context" -->
<!-- 業務コンテキスト・運用上の留意点をここに記述。AI は上書きしません。 -->
<!-- HUMAN_MANAGED_END id="business-context" -->
