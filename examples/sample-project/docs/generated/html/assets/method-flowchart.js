(() => {
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
