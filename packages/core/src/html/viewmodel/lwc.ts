// ----------------------------------------------------------------------------
// LWC ComponentViewModel builder
// ----------------------------------------------------------------------------

import { summaryForLwc } from "../../render/summary.js";
import type {
  KnowledgeGraph,
  LightningWebComponent,
} from "../../types/graph.js";
import { escapeHtml } from "../escape.js";
import type { ComponentViewModel, SectionViewModel } from "../types.js";
import {
  changeHistorySection,
  emptyLlmPlaceholderSection,
  impactHintSection,
  listOrPlaceholderHtml,
  relatedDomainsSection,
  unique,
} from "./shared.js";

export function buildLwcViewModel(
  lwc: LightningWebComponent,
  graph: KnowledgeGraph,
  gitCwd?: string,
  preservedBlocks?: Map<string, string>,
): ComponentViewModel {
  const sections: SectionViewModel[] = [
    {
      id: "one-line-summary",
      title: "一行サマリ",
      htmlContent: `<p>${escapeMaybeMd(summaryForLwc(lwc))}</p>`,
    },
    emptyLlmPlaceholderSection(
      "business-meaning",
      "業務的意味づけ",
      "この LWC が業務上どんなユーザー体験を提供しているかを 2〜3 文で記述してください。",
      "business-meaning",
      preservedBlocks?.get("business-meaning"),
    ),
    dependenciesSection(lwc),
    publicInterfaceSection(lwc),
    dataModelTouchpointsSection(lwc),
    ioContractSection(lwc),
    testCoverageSection(),
    changeHistorySection(lwc.sourcePath, gitCwd),
    impactHintSection(`LightningComponentBundle:${lwc.fullyQualifiedName}`),
    relatedDomainsSection("lwc", lwc.fullyQualifiedName, graph),
  ];

  return { type: "lwc", name: lwc.fullyQualifiedName, sections };
}

function dependenciesSection(lwc: LightningWebComponent): SectionViewModel {
  const apexImports = unique(lwc.apexImports.map((a) => a.className));
  const children = unique(lwc.childComponents);
  return {
    id: "dependencies",
    title: "依存関係",
    htmlContent: `
    <div class="grid two-col">
      <div>
        <h3>Apex import (${apexImports.length})</h3>
        ${listOrPlaceholderHtml(apexImports, "（Apex import なし）")}
      </div>
      <div>
        <h3>子コンポーネント (${children.length})</h3>
        ${listOrPlaceholderHtml(children, "（子コンポーネントなし）")}
      </div>
    </div>`,
  };
}

function publicInterfaceSection(lwc: LightningWebComponent): SectionViewModel {
  return {
    id: "public-interface",
    title: "公開インターフェース",
    htmlContent: `
    <div class="grid two-col">
      <div>
        <h3>@api プロパティ (${lwc.publicProperties.length})</h3>
        ${listOrPlaceholderHtml(lwc.publicProperties, "（公開プロパティなし）")}
      </div>
      <div>
        <h3>カスタムイベント (${lwc.customEvents.length})</h3>
        ${listOrPlaceholderHtml(lwc.customEvents, "（カスタムイベントなし）")}
      </div>
    </div>`,
  };
}

function dataModelTouchpointsSection(
  lwc: LightningWebComponent,
): SectionViewModel {
  const wires = unique(lwc.wires.map((w) => w.target));
  return {
    id: "data-model-touchpoints",
    title: "データモデル接点",
    htmlContent: `
    <h3>@wire アダプタ (${wires.length})</h3>
    ${listOrPlaceholderHtml(wires, "（@wire は検出されませんでした）")}`,
  };
}

function ioContractSection(lwc: LightningWebComponent): SectionViewModel {
  return {
    id: "io-contract",
    title: "入出力契約",
    htmlContent: `
    <h3>入力 (@api props)</h3>
    ${listOrPlaceholderHtml(lwc.publicProperties, "（入力プロパティなし）")}
    <h3>出力 (CustomEvent)</h3>
    ${listOrPlaceholderHtml(lwc.customEvents, "（出力イベントなし）")}`,
  };
}

function testCoverageSection(): SectionViewModel {
  return {
    id: "test-coverage",
    title: "テスト被覆",
    htmlContent: `<p class="muted">Jest テスト連携は Phase 4 以降で対応予定です。</p>`,
  };
}

function escapeMaybeMd(md: string): string {
  return escapeHtml(md)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
