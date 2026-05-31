import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRIEVE_TYPES,
  OrgRetrieveError,
  buildPackageManifest,
  retrieveOrgSources,
} from "../../../src/adapters/org-retrieve/index.js";

describe("buildPackageManifest", () => {
  it("types 未指定なら DEFAULT_RETRIEVE_TYPES が並ぶ", () => {
    const xml = buildPackageManifest({ apiVersion: "62.0" });
    for (const t of DEFAULT_RETRIEVE_TYPES) {
      expect(xml).toContain(`<name>${t}</name>`);
    }
    expect(xml).toContain("<version>62.0</version>");
  });

  it("内部タイプ表記は Salesforce タイプ名に変換される", () => {
    const xml = buildPackageManifest({ apiVersion: "62.0", types: ["apex", "trigger"] });
    expect(xml).toContain("<name>ApexClass</name>");
    expect(xml).toContain("<name>ApexTrigger</name>");
    expect(xml).not.toContain("<name>LightningComponentBundle</name>");
  });

  it("未知のタイプはそのまま透過する (Profile 等を直接指定可)", () => {
    const xml = buildPackageManifest({ apiVersion: "62.0", types: ["Profile"] });
    expect(xml).toContain("<name>Profile</name>");
  });

  it("XML エスケープが効く", () => {
    const xml = buildPackageManifest({ apiVersion: "62.0", types: ["A&B"] });
    expect(xml).toContain("<name>A&amp;B</name>");
  });

  it("重複タイプは除去される", () => {
    const xml = buildPackageManifest({
      apiVersion: "62.0",
      types: ["apex", "ApexClass"],
    });
    const matches = xml.match(/<name>ApexClass<\/name>/g);
    expect(matches).toHaveLength(1);
  });
});

describe("retrieveOrgSources (mocked spawn)", () => {
  function makeFakeSpawn(exitCode: number, stderr = "", stdout = "") {
    return (() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => {
        if (stdout !== "") child.stdout.emit("data", Buffer.from(stdout));
        if (stderr !== "") child.stderr.emit("data", Buffer.from(stderr));
        child.emit("close", exitCode);
      });
      return child;
    }) as unknown as typeof import("node:child_process").spawn;
  }

  it("成功時に targetDir と manifestPath を返す", async () => {
    const result = await retrieveOrgSources({
      apiVersion: "62.0",
      spawnFn: makeFakeSpawn(0, "", "ok"),
    });
    expect(result.exitCode).toBe(0);
    expect(existsSync(result.manifestPath)).toBe(true);
    const xml = readFileSync(result.manifestPath, "utf8");
    expect(xml).toContain("<name>ApexClass</name>");
  });

  it("非ゼロ exit code で OrgRetrieveError が投げられる", async () => {
    await expect(
      retrieveOrgSources({
        apiVersion: "62.0",
        spawnFn: makeFakeSpawn(1, "auth required"),
      }),
    ).rejects.toBeInstanceOf(OrgRetrieveError);
  });

  it("OrgRetrieveError は exitCode と stderr を保持する", async () => {
    try {
      await retrieveOrgSources({
        apiVersion: "62.0",
        spawnFn: makeFakeSpawn(2, "boom"),
      });
      expect.fail("expected error");
    } catch (e) {
      const err = e as OrgRetrieveError;
      expect(err.exitCode).toBe(2);
      expect(err.stderr).toContain("boom");
    }
  });
});
