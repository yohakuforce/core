import { describe, expect, it } from "vitest";
import { extractApexBody } from "../../../src/graph/extractors/apex-body.js";
import { extractFieldWrites } from "../../../src/graph/extractors/apex-field-writes.js";
import { stripApexComments } from "../../../src/graph/extractors/apex-body.js";

describe("extractFieldWrites", () => {
  it("captures object / field / value for a new-instance receiver and infers insert", () => {
    const src = `
      public class AccCreator {
        public void run() {
          Account acc = new Account();
          acc.Name = 'ACME';
          acc.Status__c = 'Active';
          insert acc;
        }
      }`;
    const stripped = stripApexComments(src);
    const dml = [{ kind: "insert" as const, target: "acc", viaDatabaseClass: false }];
    const writes = extractFieldWrites(stripped, dml);

    expect(writes).toHaveLength(2);
    const name = writes.find((w) => w.field === "Name");
    expect(name).toMatchObject({
      receiver: "acc",
      object: "Account",
      field: "Name",
      valueExpr: "'ACME'",
      operation: "insert",
      methodName: "run",
    });
    expect(writes.find((w) => w.field === "Status__c")?.valueExpr).toBe("'Active'");
  });

  it("resolves the object from a for-each loop variable", () => {
    const src = `
      public class Bumper {
        public void bump(List<Contact> cons) {
          for (Contact c : cons) {
            c.Title = 'Updated';
          }
          update cons;
        }
      }`;
    const writes = extractFieldWrites(stripApexComments(src), []);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ receiver: "c", object: "Contact", field: "Title" });
  });

  it("does not match equality / comparison operators", () => {
    const src = `
      public class Cmp {
        public Boolean check(Account a) {
          if (a.Status__c == 'X') { return true; }
          return a.Amount__c >= 10;
        }
      }`;
    const writes = extractFieldWrites(stripApexComments(src), []);
    expect(writes).toHaveLength(0);
  });

  it("leaves object null when the receiver type cannot be resolved", () => {
    const src = `
      public class Mystery {
        public void touch() {
          unknownVar.Foo__c = 1;
        }
      }`;
    const writes = extractFieldWrites(stripApexComments(src), []);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.object).toBeNull();
  });

  it("is surfaced on ApexBodyInfo.fieldWrites via extractApexBody", () => {
    const src = `
      public class S {
        public void f() {
          Account a = new Account();
          a.Name = 'x';
          insert a;
        }
      }`;
    const body = extractApexBody(src);
    expect(body.fieldWrites).toBeDefined();
    expect(body.fieldWrites?.[0]).toMatchObject({ object: "Account", field: "Name" });
  });
});
