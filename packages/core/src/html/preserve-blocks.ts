// ----------------------------------------------------------------------------
// 既存 HTML から ai_managed ブロックを保全して再 render 時に再利用する
//
// render は毎回 graph から決定的に HTML を再生成するため、html-write や手動編集
// で埋めた `business-meaning` / `concerns` 等の内容が次の render で消えてしまう。
// 本ユーティリティが既存ファイルをパースし、filled な ai_managed ブロックを
// {"type:name" → {blockId → html}} の形で返す。viewmodel がこれを使い、
// 空プレースホルダの代わりに保全コンテンツを emit する。
// ----------------------------------------------------------------------------

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseBlocks } from "../html-write/parser.js";
import type { ComponentType } from "./sections.js";

export type PreservedBlocksMap = Map<string, Map<string, string>>;

const COMPONENT_TYPES_LIST: readonly ComponentType[] = ["apex", "trigger", "lwc", "object", "flow"];
const PLACEHOLDER_HINT = "（このセクションは LLM で生成されます）";

export function preserveAiManagedBlocks(htmlOutDir: string): PreservedBlocksMap {
  const out: PreservedBlocksMap = new Map();
  if (!existsSync(htmlOutDir)) return out;
  for (const type of COMPONENT_TYPES_LIST) {
    const dir = join(htmlOutDir, "component", type);
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const fname of entries) {
      if (!fname.endsWith(".html")) continue;
      if (fname === "index.html") continue;
      const abs = join(dir, fname);
      try {
        const st = statSync(abs);
        if (!st.isFile()) continue;
      } catch {
        continue;
      }
      let html: string;
      try {
        html = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      let blocks: ReturnType<typeof parseBlocks>;
      try {
        blocks = parseBlocks(html);
      } catch {
        continue;
      }
      const filled = new Map<string, string>();
      for (const b of blocks) {
        if (b.kind !== "ai_managed") continue;
        const content = b.content.trim();
        if (content === "") continue;
        if (content.includes(PLACEHOLDER_HINT)) continue;
        filled.set(b.id, content);
      }
      if (filled.size > 0) {
        const baseName = fname.replace(/\.html$/, "");
        out.set(`${type}:${baseName}`, filled);
      }
    }
  }
  return out;
}

export function getPreserved(
  map: PreservedBlocksMap | undefined,
  type: ComponentType,
  name: string,
  blockId: string,
): string | undefined {
  if (map === undefined) return undefined;
  const safe = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
  return map.get(`${type}:${safe}`)?.get(blockId);
}
