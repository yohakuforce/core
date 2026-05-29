// .yohaku/config.json から ContextProvider を構築する。
//
// 設定が無い / kind が none の場合は NoneContextProvider（OSS 既定）を返す。
// 秘密値（API キー等）は設定ファイルに書かず、spawn 時に ambient env を継承して
// MCP サーバへ渡す（ChildProcessStdioTransport は process.env を継承する）。
//
// 設定例 (.yohaku/config.json):
// {
//   "contextProvider": {
//     "kind": "context-hub",
//     "command": "python",
//     "args": ["-m", "context_hub.mcp.server"],
//     "cwd": "/abs/path/to/Context-Hub",
//     "projectId": "proj-001",
//     "topK": 5
//   }
// }

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContextProvider } from "../../types/context-provider.js";
import { spawnContextHubProvider } from "./context-hub-provider.js";
import { NoneContextProvider } from "./none-context-provider.js";

export interface ContextHubConfig {
  readonly kind: "context-hub";
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly projectId: string;
  readonly topK?: number;
}

export interface NoneConfig {
  readonly kind: "none";
}

export type ContextConfig = ContextHubConfig | NoneConfig;

export class ContextConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextConfigError";
  }
}

const CONFIG_RELATIVE_PATH = join(".yohaku", "config.json");

/**
 * .yohaku/config.json の contextProvider セクションを解釈する（spawn しない・純粋）。
 * ファイルが無い / セクションが無い場合は null を返す（= None 扱い）。
 * kind が context-hub で必須項目が欠けている場合は ContextConfigError を投げる。
 */
export function parseContextConfig(projectRoot: string): ContextConfig | null {
  const path = join(projectRoot, CONFIG_RELATIVE_PATH);
  if (!existsSync(path)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new ContextConfigError(
      `.yohaku/config.json is not valid JSON: ${(err as Error).message}`,
    );
  }

  const section = (raw as { contextProvider?: unknown } | null)?.contextProvider;
  if (section === undefined || section === null) {
    return null;
  }
  if (typeof section !== "object") {
    throw new ContextConfigError("contextProvider must be an object");
  }

  const cfg = section as Record<string, unknown>;
  const kind = cfg.kind;

  if (kind === undefined || kind === "none") {
    return { kind: "none" };
  }
  if (kind !== "context-hub") {
    throw new ContextConfigError(
      `unknown contextProvider.kind: ${String(kind)} (expected "none" | "context-hub")`,
    );
  }

  if (typeof cfg.command !== "string" || cfg.command.length === 0) {
    throw new ContextConfigError('contextProvider.command is required for kind="context-hub"');
  }
  if (typeof cfg.projectId !== "string" || cfg.projectId.length === 0) {
    throw new ContextConfigError('contextProvider.projectId is required for kind="context-hub"');
  }
  const args = Array.isArray(cfg.args)
    ? cfg.args.filter((a): a is string => typeof a === "string")
    : undefined;
  const cwd = typeof cfg.cwd === "string" ? cfg.cwd : undefined;
  const topK = typeof cfg.topK === "number" ? cfg.topK : undefined;

  return { kind: "context-hub", command: cfg.command, args, cwd, projectId: cfg.projectId, topK };
}

/** ContextConfig から ContextProvider を構築する。null / none は NoneContextProvider。 */
export function createContextProvider(config: ContextConfig | null): ContextProvider {
  if (config === null || config.kind === "none") {
    return new NoneContextProvider();
  }
  return spawnContextHubProvider({
    command: config.command,
    args: config.args,
    cwd: config.cwd,
    projectId: config.projectId,
    topK: config.topK,
  });
}

/** projectRoot から設定を読み、ContextProvider を構築する便宜関数。 */
export function loadContextProvider(projectRoot: string): ContextProvider {
  return createContextProvider(parseContextConfig(projectRoot));
}
