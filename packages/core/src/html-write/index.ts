// ----------------------------------------------------------------------------
// yohaku html-write エントリポイント
// ----------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeFileName } from "../html/escape.js";
import type { ComponentType } from "../html/sections.js";
import { applyBlockUpdates } from "./parser.js";
import type {
  HtmlWriteInput,
  HtmlWriteResult,
  HtmlWriteComponentEntry,
} from "./types.js";
import { HtmlWriteInputError } from "./types.js";

export {
  parseBlocks,
  applyBlockUpdates,
  HtmlBlockParseError,
} from "./parser.js";
export type { ParsedBlock } from "./parser.js";
export {
  HtmlWriteInputError,
} from "./types.js";
export type {
  HtmlWriteInput,
  HtmlWriteResult,
  HtmlWriteComponentEntry,
} from "./types.js";

const COMPONENT_TYPES: readonly ComponentType[] = [
  "apex",
  "trigger",
  "lwc",
  "object",
  "flow",
];

export interface ApplyHtmlWriteOptions {
  /** docs/generated/html などのホームディレクトリ */
  readonly htmlOutDir: string;
  /** 入力 JSON を渡す。validateHtmlWriteInput で検証済みのものを推奨。 */
  readonly input: HtmlWriteInput;
  /** true なら書き込まずに dry-run (結果サマリだけ返す) */
  readonly dryRun?: boolean;
}

export function applyHtmlWrite(options: ApplyHtmlWriteOptions): HtmlWriteResult {
  const updated: HtmlWriteResult["updated"][number][] = [];
  const missingComponents: HtmlWriteResult["missingComponents"][number][] = [];
  const missingBlocks: HtmlWriteResult["missingBlocks"][number][] = [];
  const rejectedBlocks: HtmlWriteResult["rejectedBlocks"][number][] = [];

  for (const entry of options.input.components) {
    const path = join(
      options.htmlOutDir,
      "component",
      entry.type,
      `${sanitizeFileName(entry.name)}.html`,
    );
    if (!existsSync(path)) {
      missingComponents.push({ type: entry.type, name: entry.name });
      continue;
    }
    const html = readFileSync(path, "utf8");
    const result = applyBlockUpdates(html, entry.blocks);

    for (const id of result.missingIds) {
      missingBlocks.push({ componentName: entry.name, blockId: id });
    }
    for (const r of result.rejectedIds) {
      rejectedBlocks.push({
        componentName: entry.name,
        blockId: r.id,
        reason: r.reason,
      });
    }
    for (const id of result.updatedIds) {
      updated.push({ componentName: entry.name, blockId: id, path });
    }
    if (result.updatedIds.length > 0 && options.dryRun !== true) {
      writeFileSync(path, result.updatedHtml, "utf8");
    }
  }

  return { updated, missingComponents, missingBlocks, rejectedBlocks };
}

/**
 * raw な JSON 値を HtmlWriteInput に変換しつつ最小限の構造検証を行う。
 * 細かい schema 検証は ajv に任せる選択肢もあるが、ここでは依存最小化のため
 * 手書きで十分。
 */
export function validateHtmlWriteInput(raw: unknown): HtmlWriteInput {
  if (raw === null || typeof raw !== "object") {
    throw new HtmlWriteInputError("root must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new HtmlWriteInputError(
      `unsupported version ${String(obj.version)}, expected 1`,
    );
  }
  if (!Array.isArray(obj.components)) {
    throw new HtmlWriteInputError("components must be an array");
  }
  const components: HtmlWriteComponentEntry[] = obj.components.map(
    (c, i) => validateEntry(c, `components[${i}]`),
  );
  return { version: 1, components };
}

function validateEntry(c: unknown, where: string): HtmlWriteComponentEntry {
  if (c === null || typeof c !== "object") {
    throw new HtmlWriteInputError(`${where} must be an object`);
  }
  const o = c as Record<string, unknown>;
  if (typeof o.type !== "string" || !COMPONENT_TYPES.includes(o.type as ComponentType)) {
    throw new HtmlWriteInputError(
      `${where}.type must be one of: ${COMPONENT_TYPES.join(", ")}`,
    );
  }
  if (typeof o.name !== "string" || o.name.trim() === "") {
    throw new HtmlWriteInputError(`${where}.name must be a non-empty string`);
  }
  if (o.blocks === null || typeof o.blocks !== "object") {
    throw new HtmlWriteInputError(`${where}.blocks must be an object`);
  }
  const blocks: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.blocks as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new HtmlWriteInputError(`${where}.blocks["${k}"] must be a string`);
    }
    blocks[k] = v;
  }
  return { type: o.type as ComponentType, name: o.name, blocks };
}
