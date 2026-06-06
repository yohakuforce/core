import { describe, expect, it } from "vitest";
import { extractFlowBody } from "../../../src/graph/extractors/flow-body.js";

const FLOW_NODE = {
  start: { connector: { targetReference: "Get_Accounts" } },
  recordLookups: [
    {
      name: "Get_Accounts",
      label: "Get Accounts",
      object: "Account",
      connector: { targetReference: "Is_VIP" },
    },
    { name: "Get_Contacts", label: "Get Contacts", object: "Contact" },
  ],
  recordCreates: { name: "Create_Task", object: "Task" },
  recordUpdates: { name: "Update_Account", object: "Account" },
  decisions: [
    {
      name: "Is_VIP",
      rules: [{ name: "yes", label: "VIP", connector: { targetReference: "Assign_Owner" } }],
      defaultConnector: { targetReference: "Update_Account" },
      defaultConnectorLabel: "Not VIP",
    },
  ],
  assignments: [{ name: "Assign_Owner", connector: { targetReference: "Send_Email" } }],
  loops: [
    {
      name: "Loop_Each",
      nextValueConnector: { targetReference: "Assign_Owner" },
      noMoreValuesConnector: { targetReference: "Send_Email" },
    },
  ],
  actionCalls: [
    {
      name: "Send_Email",
      actionName: "emailAlert",
      faultConnector: { targetReference: "Update_Account" },
    },
    { name: "Notify_External", actionName: "myInvocable" },
  ],
  subflows: [{ name: "Run_Common", flowName: "Common_Subflow" }],
  screens: [{ name: "Welcome_Screen" }],
  waits: [],
};

describe("extractFlowBody", () => {
  it("セクション横断で要素を集約する", () => {
    const body = extractFlowBody(FLOW_NODE);
    const kinds = new Set(body.elements.map((e) => e.kind));
    expect(kinds.has("recordLookup")).toBe(true);
    expect(kinds.has("recordCreate")).toBe(true);
    expect(kinds.has("recordUpdate")).toBe(true);
    expect(kinds.has("decision")).toBe(true);
    expect(kinds.has("assignment")).toBe(true);
    expect(kinds.has("loop")).toBe(true);
    expect(kinds.has("actionCall")).toBe(true);
    expect(kinds.has("subflow")).toBe(true);
    expect(kinds.has("screen")).toBe(true);
  });

  it("recordObjects を整列・重複排除する", () => {
    const body = extractFlowBody(FLOW_NODE);
    expect(body.recordObjects).toEqual(["Account", "Contact", "Task"]);
  });

  it("subflows と actionCalls を抽出する", () => {
    const body = extractFlowBody(FLOW_NODE);
    expect(body.subflows).toContain("Common_Subflow");
    expect(body.actionCalls).toContain("emailAlert");
    expect(body.actionCalls).toContain("myInvocable");
  });

  it("空ノードでも壊れない", () => {
    const body = extractFlowBody({});
    expect(body.elements.length).toBe(0);
    expect(body.subflows.length).toBe(0);
    expect(body.recordObjects.length).toBe(0);
    expect(body.edges).toEqual([]);
  });

  it("recordLookup の 取得項目 / 絞り込み条件 / 並び / 件数 を抽出する", () => {
    const node = {
      recordLookups: [
        {
          name: "Get_Gold",
          object: "Customer__c",
          queriedFields: ["Id", "Name", "Tier__c"],
          filters: [
            { field: "Tier__c", operator: "EqualTo", value: { stringValue: "Gold" } },
            { field: "OwnerId", operator: "EqualTo", value: { elementReference: "$User.Id" } },
          ],
          filterLogic: "and",
          sortField: "Name",
          sortOrder: "Asc",
          getFirstRecordOnly: "true",
        },
      ],
    };
    const el = extractFlowBody(node).elements.find((e) => e.name === "Get_Gold");
    expect(el?.queriedFields).toEqual(["Id", "Name", "Tier__c"]);
    expect(el?.filters).toEqual([
      { field: "Tier__c", operator: "EqualTo", value: "'Gold'" },
      { field: "OwnerId", operator: "EqualTo", value: "{!$User.Id}" },
    ]);
    expect(el?.filterLogic).toBe("and");
    expect(el?.sortField).toBe("Name");
    expect(el?.getFirstRecordOnly).toBe(true);
  });

  it("recordCreate/Update の inputAssignments (項目←値) を抽出する", () => {
    const node = {
      recordUpdates: [
        {
          name: "Set_Tier",
          object: "Customer__c",
          inputAssignments: [
            { field: "Tier__c", value: { stringValue: "Platinum" } },
            { field: "Active__c", value: { booleanValue: "true" } },
          ],
        },
      ],
      recordCreates: [
        { name: "By_Ref", object: "Task", inputReference: "newTaskVar" },
      ],
    };
    const els = extractFlowBody(node).elements;
    const upd = els.find((e) => e.name === "Set_Tier");
    expect(upd?.inputAssignments).toEqual([
      { field: "Tier__c", value: "'Platinum'" },
      { field: "Active__c", value: "true" },
    ]);
    expect(els.find((e) => e.name === "By_Ref")?.inputReference).toBe("newTaskVar");
  });

  it("レコードトリガ Flow の起動条件 (object/タイミング/条件式) を抽出する", () => {
    const node = {
      start: {
        object: "Order__c",
        recordTriggerType: "CreateAndUpdate",
        triggerType: "RecordAfterSave",
        filterFormula: "ISPICKVAL({!$Record.Status__c}, \"Approved\")",
        connector: { targetReference: "Create_Shipment" },
      },
      recordCreates: [{ name: "Create_Shipment", object: "Shipment__c" }],
    };
    const st = extractFlowBody(node).startTrigger;
    expect(st?.object).toBe("Order__c");
    expect(st?.recordTriggerType).toBe("CreateAndUpdate");
    expect(st?.conditionFormula).toContain("ISPICKVAL");
  });

  it("非トリガ Flow では startTrigger を出さない", () => {
    expect(extractFlowBody(FLOW_NODE).startTrigger).toBeUndefined();
  });

  it("非 record 要素には詳細フィールドを付けない", () => {
    const el = extractFlowBody(FLOW_NODE).elements.find((e) => e.kind === "decision");
    expect(el?.filters).toBeUndefined();
    expect(el?.inputAssignments).toBeUndefined();
  });

  it("connector / decision rules / fault / loop / start を edges として返す", () => {
    const body = extractFlowBody(FLOW_NODE);
    const edges = body.edges ?? [];
    // start
    expect(edges.some((e) => e.kind === "start" && e.to === "Get_Accounts")).toBe(true);
    // 通常 connector
    expect(edges.some((e) => e.from === "Get_Accounts" && e.to === "Is_VIP")).toBe(true);
    // decision rule
    expect(
      edges.some((e) => e.kind === "rule" && e.label === "VIP" && e.to === "Assign_Owner"),
    ).toBe(true);
    // decision default
    expect(
      edges.some((e) => e.kind === "default" && e.label === "Not VIP" && e.to === "Update_Account"),
    ).toBe(true);
    // fault
    expect(
      edges.some((e) => e.kind === "fault" && e.from === "Send_Email" && e.to === "Update_Account"),
    ).toBe(true);
    // loop next / no more
    expect(edges.some((e) => e.kind === "loop" && e.from === "Loop_Each")).toBe(true);
    expect(edges.some((e) => e.kind === "noMore" && e.from === "Loop_Each")).toBe(true);
  });
});
