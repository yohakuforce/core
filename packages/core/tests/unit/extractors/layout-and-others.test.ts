import { describe, expect, it } from "vitest";
import { extractCustomMetadataRecord } from "../../../src/graph/extractors/custom-metadata-record.js";
import { extractLayout } from "../../../src/graph/extractors/layout.js";
import { extractNamedCredential } from "../../../src/graph/extractors/named-credential.js";
import { extractRemoteSiteSetting } from "../../../src/graph/extractors/remote-site-setting.js";

const LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutSections>
        <label>Info</label>
        <style>TwoColumns</style>
        <layoutColumns>
            <layoutItems><behavior>Required</behavior><field>Name</field></layoutItems>
        </layoutColumns>
        <layoutColumns>
            <layoutItems><behavior>Edit</behavior><field>Status__c</field></layoutItems>
        </layoutColumns>
    </layoutSections>
    <relatedLists>
        <fields>NAME</fields>
        <fields>Quantity__c</fields>
        <relatedList>Order_Line__c.Order__c</relatedList>
    </relatedLists>
    <quickActionList>
        <quickActionListItems><quickActionName>Submit</quickActionName></quickActionListItems>
    </quickActionList>
</Layout>`;

describe("extractLayout", () => {
  it("セクション/列/フィールド/関連リスト/クイックアクションを取れる", () => {
    const out = extractLayout({
      descriptor: {
        type: "Layout",
        fullyQualifiedName: "Order__c-Order Layout",
        sourcePath: "p",
        contentHash: "h",
      },
      content: LAYOUT_XML,
      projectRoot: ".",
    });
    expect(out?.object).toBe("Order__c");
    expect(out?.layoutName).toBe("Order Layout");
    expect(out?.sections.length).toBe(1);
    expect(out?.sections[0]?.items.length).toBe(2);
    expect(out?.sections[0]?.items[0]?.column).toBe(1);
    expect(out?.sections[0]?.items[1]?.column).toBe(2);
    expect(out?.relatedLists[0]?.fields).toContain("Quantity__c");
    expect(out?.quickActions).toContain("Submit");
  });
});

const CMR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <label>JP Standard</label>
    <protected>false</protected>
    <values><field>Country__c</field><value xsi:type="xsd:string">JP</value></values>
    <values><field>Rate__c</field><value xsi:type="xsd:double">0.10</value></values>
</CustomMetadata>`;

describe("extractCustomMetadataRecord", () => {
  it("type / record / values を取れる", () => {
    const out = extractCustomMetadataRecord({
      descriptor: {
        type: "CustomMetadataRecord",
        fullyQualifiedName: "Tax_Setting__mdt.JP_Standard",
        sourcePath: "p",
        contentHash: "h",
      },
      content: CMR_XML,
      projectRoot: ".",
    });
    expect(out?.type).toBe("Tax_Setting__mdt");
    expect(out?.recordName).toBe("JP_Standard");
    expect(out?.values.length).toBe(2);
    expect(out?.values.find((v) => v.field === "Country__c")?.value).toBe("JP");
  });
});

const NC_WITH_SECRET = `<?xml version="1.0"?>
<NamedCredential xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>EDI</label>
    <endpoint>https://edi.example.com</endpoint>
    <protocol>Password</protocol>
    <password>SECRET</password>
</NamedCredential>`;

const NC_NO_SECRET = `<?xml version="1.0"?>
<NamedCredential xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>OAuth</label>
    <endpoint>https://api.example.com</endpoint>
    <protocol>Oauth</protocol>
</NamedCredential>`;

describe("extractNamedCredential", () => {
  it("シークレットありを検出する (値そのものは出さない)", () => {
    const out = extractNamedCredential({
      descriptor: {
        type: "NamedCredential",
        fullyQualifiedName: "EDI_Service",
        sourcePath: "p",
        contentHash: "h",
      },
      content: NC_WITH_SECRET,
      projectRoot: ".",
    });
    expect(out?.hasSecret).toBe(true);
    expect(out?.endpoint).toBe("https://edi.example.com");
    // 戻り値に SECRET 文字列が含まれていない
    expect(JSON.stringify(out)).not.toContain("SECRET");
  });

  it("シークレットなしも検出できる", () => {
    const out = extractNamedCredential({
      descriptor: {
        type: "NamedCredential",
        fullyQualifiedName: "OAuth_Service",
        sourcePath: "p",
        contentHash: "h",
      },
      content: NC_NO_SECRET,
      projectRoot: ".",
    });
    expect(out?.hasSecret).toBe(false);
  });
});

const RSS_XML = `<?xml version="1.0"?>
<RemoteSiteSetting xmlns="http://soap.sforce.com/2006/04/metadata">
    <isActive>true</isActive>
    <url>https://edi.example.com</url>
    <description>EDI 連携</description>
    <disableProtocolSecurity>false</disableProtocolSecurity>
</RemoteSiteSetting>`;

describe("extractRemoteSiteSetting", () => {
  it("URL / active / disableProtocolSecurity を取れる", () => {
    const out = extractRemoteSiteSetting({
      descriptor: {
        type: "RemoteSiteSetting",
        fullyQualifiedName: "EdiService",
        sourcePath: "p",
        contentHash: "h",
      },
      content: RSS_XML,
      projectRoot: ".",
    });
    expect(out?.url).toBe("https://edi.example.com");
    expect(out?.active).toBe(true);
    expect(out?.disableProtocolSecurity).toBe(false);
  });
});

import { extractEmailTemplate } from "../../../src/graph/extractors/email-template.js";

const EMAIL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <available>true</available>
    <encodingKey>UTF-8</encodingKey>
    <name>受注確認メール</name>
    <description>受注登録時に送信</description>
    <subject>【受注確認】注文番号: {!Order__c.Name}</subject>
    <type>custom</type>
    <uiType>SF</uiType>
</EmailTemplate>`;

describe("extractEmailTemplate", () => {
  it("ラベル/件名/形式/文字コード/利用可否を取れる", () => {
    const out = extractEmailTemplate({
      descriptor: {
        type: "EmailTemplate",
        fullyQualifiedName: "Sales/OrderConfirmation",
        sourcePath: "p",
        contentHash: "h",
      },
      content: EMAIL_XML,
      projectRoot: ".",
    });
    expect(out?.fullyQualifiedName).toBe("Sales/OrderConfirmation");
    expect(out?.name).toBe("受注確認メール");
    expect(out?.subject).toContain("{!Order__c.Name}");
    expect(out?.type).toBe("custom");
    expect(out?.encodingKey).toBe("UTF-8");
    expect(out?.available).toBe(true);
  });
});
