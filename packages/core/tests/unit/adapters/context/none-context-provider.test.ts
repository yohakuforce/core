import { describe, expect, it } from "vitest";
import { NoneContextProvider } from "../../../../src/adapters/context/none-context-provider.js";

describe("NoneContextProvider (default)", () => {
  it("kind は 'none'", () => {
    expect(new NoneContextProvider().kind).toBe("none");
  });

  it("relatedContext は常に空の brief を返す", async () => {
    const p = new NoneContextProvider();
    const brief = await p.relatedContext({ kind: "apexClass", fqn: "AccountService" });
    expect(brief.empty).toBe(true);
    expect(brief.snippets).toEqual([]);
    expect(brief.target).toEqual({ kind: "apexClass", fqn: "AccountService" });
  });

  it("close は no-op で解決する", async () => {
    await expect(new NoneContextProvider().close()).resolves.toBeUndefined();
  });
});
