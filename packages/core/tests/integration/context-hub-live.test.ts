// 実 Context-Hub MCP プロセスに対するライブ統合テスト（Node↔Python 往復）。
//
// 既定ではスキップ（cross-runtime・python venv 依存のため CI 非対象）。
// 実行方法:
//   CONTEXT_HUB_LIVE=1 \
//   CONTEXT_HUB_PY=/path/to/Context-Hub/.venv/bin/python \
//   CONTEXT_HUB_CWD=/path/to/Context-Hub \
//   npx vitest run tests/integration/context-hub-live.test.ts

import { describe, expect, it } from "vitest";
import { spawnContextHubProvider } from "../../src/adapters/context/context-hub-provider.js";

const LIVE = process.env.CONTEXT_HUB_LIVE === "1";
const PY = process.env.CONTEXT_HUB_PY ?? "python";
const CWD = process.env.CONTEXT_HUB_CWD;

describe.skipIf(!LIVE)("ContextHubProvider live (real Context-Hub MCP over stdio)", () => {
  it("spawn → initialize → search_context の往復が実プロセスで成立する", async () => {
    const provider = spawnContextHubProvider({
      command: PY,
      args: ["-m", "context_hub.mcp.server"],
      cwd: CWD,
      projectId: "proj-001",
      env: { PYTHONUNBUFFERED: "1" },
      clientOptions: { requestTimeoutMs: 15_000 },
    });
    try {
      // DB シード状況に依らず「プロトコル往復が成立する」ことを検証する。
      // 成功 → ContextBrief、検索失敗 → "search_context failed" を含む Error。
      // どちらでも spawn + 行フレーミング + initialize + tools/call + parse は通っている。
      const outcome = await provider
        .relatedContext({ kind: "apexClass", fqn: "AuthService" })
        .then((brief) => ({ ok: true as const, brief }))
        .catch((err: Error) => ({ ok: false as const, err }));

      if (outcome.ok) {
        expect(Array.isArray(outcome.brief.snippets)).toBe(true);
        expect(outcome.brief.target).toEqual({ kind: "apexClass", fqn: "AuthService" });
      } else {
        expect(outcome.err.message).toMatch(/search_context failed/);
      }
    } finally {
      await provider.close();
    }
  }, 20_000);
});
