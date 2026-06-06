import { describe, expect, it } from "vitest";
import {
  parseSoqlDetail,
  splitTopLevelCommas,
} from "../../../src/graph/extractors/soql-parse.js";

describe("splitTopLevelCommas", () => {
  it("splits a flat field list", () => {
    expect(splitTopLevelCommas("Id, Name, Status__c")).toEqual(["Id", "Name", "Status__c"]);
  });

  it("keeps function arguments together", () => {
    expect(splitTopLevelCommas("Id, toLabel(Type), COUNT(Id)")).toEqual([
      "Id",
      "toLabel(Type)",
      "COUNT(Id)",
    ]);
  });

  it("keeps a subquery as one element", () => {
    expect(splitTopLevelCommas("Id, (SELECT Id, Name FROM Contacts), Name")).toEqual([
      "Id",
      "(SELECT Id, Name FROM Contacts)",
      "Name",
    ]);
  });
});

describe("parseSoqlDetail", () => {
  it("parses fields / where / order by / limit", () => {
    const d = parseSoqlDetail(
      "SELECT Id, Name, Status__c FROM Account WHERE Status__c = 'Active' AND CreatedDate > :dt ORDER BY Name DESC LIMIT 100",
    );
    expect(d.fields).toEqual(["Id", "Name", "Status__c"]);
    expect(d.whereClause).toBe("Status__c = 'Active' AND CreatedDate > :dt");
    expect(d.orderByClause).toBe("Name DESC");
    expect(d.limitClause).toBe("100");
  });

  it("returns no where/order/limit when absent", () => {
    const d = parseSoqlDetail("SELECT Id FROM Contact");
    expect(d.fields).toEqual(["Id"]);
    expect(d.whereClause).toBeUndefined();
    expect(d.orderByClause).toBeUndefined();
    expect(d.limitClause).toBeUndefined();
  });

  it("does not treat keywords inside a subquery as top-level clauses", () => {
    const d = parseSoqlDetail(
      "SELECT Id, (SELECT Id FROM Opportunities WHERE IsWon = true LIMIT 5) FROM Account WHERE Industry = 'Tech'",
    );
    expect(d.fields).toEqual(["Id", "(SELECT Id FROM Opportunities WHERE IsWon = true LIMIT 5)"]);
    // top-level WHERE only, not the subquery's
    expect(d.whereClause).toBe("Industry = 'Tech'");
    // the subquery LIMIT must not leak to top level
    expect(d.limitClause).toBeUndefined();
  });

  it("picks the top-level FROM object, not a subquery's FROM", () => {
    const d = parseSoqlDetail(
      "SELECT Id, Product__c, (SELECT Id FROM Inventories__r) FROM Lot__c WHERE Product__c IN :ids ORDER BY Expiration_Date__c ASC NULLS LAST",
    );
    expect(d.object).toBe("Lot__c");
    expect(d.fields).toEqual(["Id", "Product__c", "(SELECT Id FROM Inventories__r)"]);
    expect(d.orderByClause).toBe("Expiration_Date__c ASC NULLS LAST");
  });

  it("does not match identifiers that merely start with a keyword (ORDERED)", () => {
    const d = parseSoqlDetail("SELECT Id, Ordered__c FROM Account");
    expect(d.fields).toEqual(["Id", "Ordered__c"]);
    expect(d.orderByClause).toBeUndefined();
  });

  it("captures a bind-variable LIMIT expression verbatim", () => {
    const d = parseSoqlDetail("SELECT Id FROM Lead LIMIT :maxRows");
    expect(d.limitClause).toBe(":maxRows");
  });
});
