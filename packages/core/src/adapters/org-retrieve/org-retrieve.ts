// ----------------------------------------------------------------------------
// Org からソースを一括取得して、後続パイプライン (graph build / HTML render)
// に渡せるローカルディレクトリを返す。
//
// 認証は事前完了している前提 (sf org login → defaultusername 設定済み)。
// 未認証時は sf CLI 側でエラーが出て stderr が流れる。
// ----------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackageManifest } from "./manifest.js";

export interface OrgRetrieveOptions {
  /** Salesforce API version (例: "62.0") */
  readonly apiVersion: string;
  /** 取得対象タイプ (内部表記 or Salesforce タイプ名)。空なら DEFAULT_RETRIEVE_TYPES */
  readonly types?: readonly string[];
  /** retrieve 先 (省略時は tmpdir に新規作成) */
  readonly targetDir?: string;
  /** sf CLI 実行バイナリ。テストで上書き可。既定: "sf" */
  readonly sfBin?: string;
  /** spawn を上書きするためのフック (テスト用) */
  readonly spawnFn?: typeof spawn;
}

export interface OrgRetrieveResult {
  readonly targetDir: string;
  readonly manifestPath: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export class OrgRetrieveError extends Error {
  readonly exitCode: number;
  readonly stderr: string;
  constructor(exitCode: number, stderr: string) {
    super(`sf project retrieve start failed (exit=${exitCode}): ${stderr.trim().slice(0, 500)}`);
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.name = "OrgRetrieveError";
  }
}

/**
 * sf CLI 経由で接続済み org からソースを取得する。
 *
 * 1. manifest (package.xml) を組み立てて targetDir/manifest/package.xml に書き出す
 * 2. sf project retrieve start --manifest <path> --target-metadata-dir <targetDir>
 * 3. 成功時は targetDir を返す。LocalSourceAdapter に root として渡せる
 */
export async function retrieveOrgSources(options: OrgRetrieveOptions): Promise<OrgRetrieveResult> {
  const targetDir = options.targetDir ?? mkdtempSync(join(tmpdir(), "yohaku-org-"));
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  const manifestDir = join(targetDir, "manifest");
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "package.xml");
  writeFileSync(
    manifestPath,
    buildPackageManifest({ apiVersion: options.apiVersion, types: options.types }),
    "utf8",
  );

  const spawner = options.spawnFn ?? spawn;
  const sfBin = options.sfBin ?? "sf";
  const args = [
    "project",
    "retrieve",
    "start",
    "--manifest",
    manifestPath,
    "--target-metadata-dir",
    targetDir,
    "--unzip",
  ];

  return new Promise<OrgRetrieveResult>((resolveFn, rejectFn) => {
    const child = spawner(sfBin, args, { cwd: targetDir });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      rejectFn(new OrgRetrieveError(-1, `failed to spawn ${sfBin}: ${(err as Error).message}`));
    });
    child.on("close", (code) => {
      const exitCode = code ?? 0;
      if (exitCode !== 0) {
        rejectFn(new OrgRetrieveError(exitCode, stderr));
        return;
      }
      resolveFn({ targetDir, manifestPath, exitCode, stdout, stderr });
    });
  });
}
