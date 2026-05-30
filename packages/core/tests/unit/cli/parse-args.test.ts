import { describe, expect, it } from "vitest";
import { main } from "../../../src/cli.js";

describe("CLI smoke", () => {
  it("--help が code 0 を返す", async () => {
    const code = await main(["--help"]);
    expect(code).toBe(0);
  });

  it("不明なコマンドで code 2", async () => {
    const code = await main(["unknown-command"]);
    expect(code).toBe(2);
  });

  it("graph schema --format json が code 0 を返す", async () => {
    const code = await main(["graph", "schema", "--format", "json"]);
    expect(code).toBe(0);
  });

  it("version で code 0", async () => {
    const code = await main(["version"]);
    expect(code).toBe(0);
  });

  it("render --format pdf で code 2 (不正値)", async () => {
    const code = await main(["render", "--format", "pdf"]);
    expect(code).toBe(2);
  });
});
