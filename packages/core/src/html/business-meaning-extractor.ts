// ----------------------------------------------------------------------------
// 既存 HTML ファイルから business-meaning ブロックの中身を抽出
//
// `<!-- yohaku:block kind="ai_managed" id="business-meaning" start -->`
// 〜 `<!-- yohaku:block kind="ai_managed" id="business-meaning" end -->`
// の content を取り出す。placeholder (テンプレ既定文言) は filled=false として
// 扱う = 集約画面には出さない。
// ----------------------------------------------------------------------------

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ComponentType } from "./sections.js";

const COMPONENT_TYPES_LIST: readonly ComponentType[] = [
  "apex",
  "trigger",
  "lwc",
  "object",
  "flow",
];

const MARKER_START =
  /<!--\s*yohaku:block\s+kind="ai_managed"\s+id="business-meaning"\s+start\s*-->/;
const MARKER_END =
  /<!--\s*yohaku:block\s+kind="ai_managed"\s+id="business-meaning"\s+end\s*-->/;
const PLACEHOLDER_HINT = "（このセクションは LLM で生成されます）";

/**
 * `<htmlOutDir>/component/<type>/<name>.html` を走査して、
 * filled な business-meaning を `{ "apex:Foo": "<HTML>", ... }` で返す。
 * テスト時/初回 build 時など HTML が無い場合は空 Map。
 */
export function extractBusinessMeanings(htmlOutDir: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(htmlOutDir)) return result;
  for (const type of COMPONENT_TYPES_LIST) {
    const typeDir = join(htmlOutDir, "component", type);
    if (!existsSync(typeDir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(typeDir);
    } catch {
      continue;
    }
    for (const fname of entries) {
      if (!fname.endsWith(".html")) continue;
      if (fname === "index.html") continue;
      const abs = join(typeDir, fname);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      let html: string;
      try {
        html = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      const meaning = extractMeaning(html);
      if (meaning === undefined) continue;
      // ファイル名 → fully qualified name の復元: sanitize の逆引きは厳密にはできないが、
      // sanitize は危険文字を _ に置換するだけなので、graph の名前と完全一致でなくとも
      // sanitize した上で同じになる元の名前で lookup できる。
      // 単純化: file 名そのまま (拡張子除く) を key 末尾に使う。Phase 15 では graph の
      // 名前と一致するケースがほとんどなのでこれで十分。
      const baseName = fname.replace(/\.html$/, "");
      result.set(`${type}:${baseName}`, meaning);
    }
  }
  return result;
}

function extractMeaning(html: string): string | undefined {
  const startMatch = MARKER_START.exec(html);
  if (startMatch === null) return undefined;
  const afterStart = html.slice(startMatch.index + startMatch[0].length);
  const endMatch = MARKER_END.exec(afterStart);
  if (endMatch === null) return undefined;
  const content = afterStart.slice(0, endMatch.index).trim();
  if (content === "") return undefined;
  // プレースホルダ (LLM で生成されます と書かれているテンプレ既定) は filled とみなさない
  if (content.includes(PLACEHOLDER_HINT)) return undefined;
  return content;
}
