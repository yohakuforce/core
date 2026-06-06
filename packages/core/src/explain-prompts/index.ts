// ----------------------------------------------------------------------------
// yohaku explain-prompts エントリポイント
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";
import type { KnowledgeGraph } from "../types/graph.js";
import { buildContextFor } from "./context-builder.js";
import { buildOverallInstructions, buildPrompt } from "./prompt-builder.js";
import type { ExplainBlockKind, ExplainPromptItem, ExplainPromptsOutput } from "./types.js";

export type { ExplainBlockKind, ExplainPromptItem, ExplainPromptsOutput } from "./types.js";
export { buildContextFor } from "./context-builder.js";
export { buildPrompt, buildOverallInstructions } from "./prompt-builder.js";

// processing-detail-narrative は出力が大きくなるため既定には含めず、
// `--kind processing-detail-narrative` で明示的にオプトインする。
const DEFAULT_KINDS: readonly ExplainBlockKind[] = ["business-meaning", "concerns"];
const VALID_KINDS = new Set<ExplainBlockKind>([
  "business-meaning",
  "concerns",
  "processing-detail-narrative",
]);

export interface BuildExplainPromptsOptions {
  /** 対象ブロック種別。未指定なら ["business-meaning", "concerns"] */
  readonly kinds?: readonly ExplainBlockKind[];
  /** 対象コンポーネントタイプ。未指定なら全タイプ */
  readonly typesFilter?: readonly ComponentType[];
  /** 対象名のホワイトリスト (graph 内に存在する fullyQualifiedName のみ) */
  readonly namesFilter?: readonly string[];
  /** 1 回の出力に含める item の上限 (LLM のコンテキスト上限対策) */
  readonly maxItems?: number;
}

export function buildExplainPrompts(
  graph: KnowledgeGraph,
  options?: BuildExplainPromptsOptions,
): ExplainPromptsOutput {
  const kinds = (options?.kinds ?? DEFAULT_KINDS).filter((k) => VALID_KINDS.has(k));
  const typesFilter = options?.typesFilter;
  const namesFilter = options?.namesFilter !== undefined ? new Set(options.namesFilter) : undefined;

  const items: ExplainPromptItem[] = [];
  const addCandidate = (type: ComponentType, name: string): void => {
    if (typesFilter !== undefined && !typesFilter.includes(type)) return;
    if (namesFilter !== undefined && !namesFilter.has(name)) return;
    const context = buildContextFor(type, name, graph);
    if (context === null) return;
    for (const kind of kinds) {
      if (!isKindApplicable(type, kind)) continue;
      items.push({
        type,
        name,
        blockId: kind,
        prompt: buildPrompt(type, name, kind),
        context,
      });
    }
  };

  for (const c of graph.apexClasses) {
    if (c.isTest) continue; // テストクラスは業務的意味づけ対象外
    addCandidate("apex", c.fullyQualifiedName);
  }
  for (const t of graph.apexTriggers) addCandidate("trigger", t.fullyQualifiedName);
  for (const l of graph.lwcs) addCandidate("lwc", l.fullyQualifiedName);
  for (const o of graph.objects) addCandidate("object", o.fullyQualifiedName);
  for (const f of graph.flows) addCandidate("flow", f.fullyQualifiedName);

  const cap = options?.maxItems;
  const cappedItems = cap !== undefined && cap > 0 ? items.slice(0, cap) : items;

  return {
    version: 1,
    format: "yohaku-explain-prompts",
    generatedAt: graph.meta.builtAt,
    instructions: buildOverallInstructions(),
    outputTemplate: {
      version: 1,
      components: [
        { type: "apex", name: "ExampleService", blocks: { "business-meaning": "<p>...</p>" } },
      ],
    },
    items: cappedItems,
  };
}

/**
 * "concerns" は apex / trigger / flow のみ。lwc / object には自動懸念検出が
 * 無いので、不要なノイズを LLM に渡さないようスキップする。
 */
function isKindApplicable(type: ComponentType, kind: ExplainBlockKind): boolean {
  if (kind === "business-meaning") return true;
  if (kind === "concerns") return type === "apex" || type === "trigger" || type === "flow";
  if (kind === "processing-detail-narrative") {
    return type === "apex" || type === "trigger" || type === "flow";
  }
  return false;
}
