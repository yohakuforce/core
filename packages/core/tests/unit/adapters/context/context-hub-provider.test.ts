import { describe, expect, it } from "vitest";
import { ContextHubProvider } from "../../../../src/adapters/context/context-hub-provider.js";
import { FakeTransport } from "./fake-transport.js";

function toolText(payload: object) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

function makeProvider(searchResult: object) {
  const t = new FakeTransport();
  t.responder = (req) => {
    if (req.method === "initialize") return { protocolVersion: "2024-11-05", capabilities: {} };
    if (req.method === "tools/call") return toolText(searchResult);
    return undefined;
  };
  return { t, provider: new ContextHubProvider({ projectId: "proj-001", transport: t }) };
}

describe("ContextHubProvider", () => {
  it("kind は 'context-hub'", () => {
    const { provider } = makeProvider({ results: [] });
    expect(provider.kind).toBe("context-hub");
  });

  it("search_context の結果を ContextSnippet に変換する", async () => {
    const { provider } = makeProvider({
      results: [
        { score: 0.92, title: "設計会議", snippet: "JWT で合意", documentId: "d-1" },
        { score: 0.81, title: "課題#42", snippet: "顧客が再ログインを要望", documentId: "d-2" },
      ],
    });
    const brief = await provider.relatedContext({ kind: "apexClass", fqn: "AuthService" });
    expect(brief.empty).toBe(false);
    expect(brief.snippets).toHaveLength(2);
    expect(brief.snippets).toContainEqual({
      text: "JWT で合意",
      score: 0.92,
      ref: { kind: "document", id: "d-1", title: "設計会議" },
    });
  });

  it("最初に initialize を送り、その後 tools/call を送る", async () => {
    const { t, provider } = makeProvider({ results: [] });
    await provider.relatedContext({ kind: "flow", fqn: "Order_After_Insert" });
    expect(t.sent[0]?.method).toBe("initialize");
    expect(t.sent.some((m) => m.method === "notifications/initialized")).toBe(true);
    const call = t.sent.find((m) => m.method === "tools/call");
    expect(call?.params).toMatchObject({
      name: "search_context",
      arguments: { projectId: "proj-001", query: "flow Order_After_Insert", topK: 5 },
    });
  });

  it("2 回目以降は initialize を再送しない", async () => {
    const { t, provider } = makeProvider({ results: [] });
    await provider.relatedContext({ kind: "object", fqn: "Account" });
    await provider.relatedContext({ kind: "object", fqn: "Contact" });
    const inits = t.sent.filter((m) => m.method === "initialize");
    expect(inits).toHaveLength(1);
  });

  it("空 results は empty=true の brief になる", async () => {
    const { provider } = makeProvider({ results: [] });
    const brief = await provider.relatedContext({ kind: "object", fqn: "Lead" });
    expect(brief.empty).toBe(true);
    expect(brief.snippets).toEqual([]);
  });

  it("snippet が空の結果は除外する", async () => {
    const { provider } = makeProvider({
      results: [
        { score: 0.5, title: "no body", snippet: "", documentId: "d-x" },
        { score: 0.4, title: "ok", snippet: "有効な断片", documentId: "d-y" },
      ],
    });
    const brief = await provider.relatedContext({ kind: "object", fqn: "Lead" });
    expect(brief.snippets).toHaveLength(1);
    expect(brief.snippets[0]?.ref.id).toBe("d-y");
  });

  it("ツールが error を返したら投げる", async () => {
    const { provider } = makeProvider({ error: "projectId and query are required" });
    await expect(provider.relatedContext({ kind: "object", fqn: "Lead" })).rejects.toThrow(
      /search_context failed/,
    );
  });
});
