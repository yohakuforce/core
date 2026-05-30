// ----------------------------------------------------------------------------
// メソッド単位フローチャート (Apex / Trigger 内部処理フロー)
//
// graph に格納された controlFlows を使い:
//   - Mermaid 描画 (buildMethodFlowchart で生成した Mermaid をブラウザで描く)
//   - HTML/CSS フォールバック (ネスト構造を treeview で表示)
// の両方を提供する。
// ----------------------------------------------------------------------------

import { buildMethodFlowchart } from "../render/method-flowchart.js";
import type { ApexControlFlowNode, ApexMethodControlFlow } from "../types/graph.js";
import { escapeAttr, escapeHtml } from "./escape.js";
import { icon } from "./icons.js";

export function renderMethodFlowcharts(
  flows: readonly ApexMethodControlFlow[],
): string {
  if (flows.length === 0) return "";
  return flows.map(renderOneFlow).join("\n    ");
}

function renderOneFlow(flow: ApexMethodControlFlow): string {
  const mermaid = buildMethodFlowchart(flow).mermaid;
  const tree = renderTree(flow.nodes);
  const id = `flow-${sanitize(flow.methodName)}`;
  return `<details class="method-flow" data-method="${escapeAttr(flow.methodName)}">
      <summary>
        <code>${escapeHtml(flow.signature)}</code>
        <span class="meta">${flow.nodes.length} ノード</span>
      </summary>
      <div class="body">
        <div class="switch-buttons" role="tablist">
          <button data-target="${escapeAttr(id)}-mermaid" aria-selected="true">${icon("diagram", { size: "13" })}Mermaid</button>
          <button data-target="${escapeAttr(id)}-tree" aria-selected="false">${icon("tree", { size: "13" })}ツリー</button>
        </div>
        <div id="${escapeAttr(id)}-mermaid" class="mermaid-host">
          <pre class="mermaid-source" data-mermaid="${escapeAttr(mermaid)}">${escapeHtml(mermaid)}</pre>
        </div>
        <div id="${escapeAttr(id)}-tree" class="fallback-tree" style="display:none;">
          ${tree}
        </div>
      </div>
    </details>`;
}

function renderTree(nodes: readonly ApexControlFlowNode[]): string {
  return `<ul>${nodes.map(renderNode).join("")}</ul>`;
}

function renderNode(n: ApexControlFlowNode): string {
  switch (n.kind) {
    case "soql":
      return `<li class="node-soql">SOQL → ${escapeHtml(n.primaryObject ?? "?")} <span style="color:var(--muted);">${escapeHtml(truncate(n.raw, 80))}</span></li>`;
    case "dml":
      return `<li class="node-dml">DML ${escapeHtml(n.verb)} → ${escapeHtml(n.target)}${n.viaDatabaseClass ? " (Database.*)" : ""}</li>`;
    case "if":
      return `<li class="node-if">if (${escapeHtml(truncate(n.condition, 60))})
        <ul>then ${renderTree(n.thenNodes).slice(4, -5)}</ul>
        ${n.elseNodes.length > 0 ? `<ul>else ${renderTree(n.elseNodes).slice(4, -5)}</ul>` : ""}
      </li>`;
    case "for":
      return `<li class="node-for">for (${escapeHtml(truncate(n.header, 60))})${renderTree(n.body)}</li>`;
    case "while":
      return `<li class="node-while">while (${escapeHtml(truncate(n.header, 60))})${renderTree(n.body)}</li>`;
    case "try":
      return `<li class="node-try">try${renderTree(n.tryNodes)}${n.catches
        .map(
          (c) =>
            `<ul>catch (${escapeHtml(c.exceptionType)})${renderTree(c.nodes)}</ul>`,
        )
        .join("")}${
        n.finallyNodes.length > 0 ? `<ul>finally${renderTree(n.finallyNodes)}</ul>` : ""
      }</li>`;
    case "return":
      return `<li class="node-return">return ${escapeHtml(truncate(n.expression, 80))}</li>`;
    case "throw":
      return `<li class="node-throw">throw ${escapeHtml(truncate(n.expression, 80))}</li>`;
    case "stmt":
      return `<li>${escapeHtml(truncate(n.text, 100))}</li>`;
  }
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * Apex/Trigger ページ用クライアント JS。
 * Mermaid ソースをレンダ + Mermaid/ツリー切替ボタン制御。
 */
export const METHOD_FLOWCHART_JS = `(() => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function ensureMermaidInit() {
    if (typeof window.mermaid === "undefined") return false;
    if (window.__yohakuMermaidInit) return true;
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: '"Salesforce Sans", -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
        themeVariables: {
          primaryColor: "#eaf5fe",
          primaryTextColor: "#032d60",
          primaryBorderColor: "#0176d3",
          lineColor: "#b0adab",
          secondaryColor: "#f3f3f3",
          tertiaryColor: "#ffffff",
          background: "#ffffff",
          mainBkg: "#ffffff",
          nodeBorder: "#dddbda",
          clusterBkg: "#fafaf9",
          clusterBorder: "#dddbda",
          edgeLabelBackground: "#ffffff"
        },
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis", padding: 12, nodeSpacing: 50, rankSpacing: 60 }
      });
      window.__yohakuMermaidInit = true;
      return true;
    } catch (e) {
      console.warn("[yohaku] mermaid init failed:", e);
      return false;
    }
  }

  function init() {
    const ready = ensureMermaidInit();
    document.querySelectorAll(".mermaid-host").forEach(async (host, idx) => {
      const pre = host.querySelector(".mermaid-source");
      if (!pre) return;
      const source = pre.getAttribute("data-mermaid") || pre.textContent || "";
      if (!ready) {
        pre.style.color = "var(--severity-high-fg)";
        pre.textContent = "Mermaid 読み込み失敗。ツリーに切替えてください。";
        autoSwitchToTree(host);
        return;
      }
      try {
        const { svg } = await window.mermaid.render("mermaid-svg-" + idx, source);
        host.innerHTML = svg;
      } catch (e) {
        console.warn("[yohaku] mermaid render failed:", e);
        pre.style.color = "var(--severity-high-fg)";
        pre.textContent = "Mermaid 描画失敗: " + (e && e.message ? e.message : String(e));
        autoSwitchToTree(host);
      }
    });

    document.querySelectorAll(".method-flow .switch-buttons button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wrapper = btn.closest(".method-flow");
        if (!wrapper) return;
        const target = btn.getAttribute("data-target");
        wrapper.querySelectorAll(".switch-buttons button").forEach((b) => {
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        wrapper.querySelectorAll(".body > div:not(.switch-buttons)").forEach((d) => {
          d.style.display = d.id === target ? "" : "none";
        });
      });
    });
  }

  function autoSwitchToTree(host) {
    const wrapper = host.closest(".method-flow");
    if (!wrapper) return;
    const treeBtn = wrapper.querySelector('.switch-buttons button[data-target$="-tree"]');
    if (treeBtn) treeBtn.click();
  }
})();
`;
