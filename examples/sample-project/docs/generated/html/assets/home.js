(() => {
  const DATA_DIR = "./data";

  document.addEventListener("DOMContentLoaded", async () => {
    initTabs();
    initSearch();
    initSidebarFilter();
    await Promise.all([
      loadStats(),
      loadDomains(),
      loadHotspots(),
      loadArchitecture(),
    ]);
  });

  function initTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.getAttribute("data-tab")));
    });
  }
  function activateTab(name) {
    document.querySelectorAll(".tab-button").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.setAttribute("data-active", p.getAttribute("data-panel") === name ? "true" : "false");
    });
  }

  function initSearch() {
    const input = document.getElementById("global-search");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll(".component-list li").forEach((li) => {
        const text = li.textContent.toLowerCase();
        li.style.display = q === "" || text.includes(q) ? "" : "none";
      });
      document.querySelectorAll(".sidebar .type-list li").forEach((li) => {
        const text = li.textContent.toLowerCase();
        li.classList.toggle("hidden", q !== "" && !text.includes(q));
      });
    });
  }

  function initSidebarFilter() {}

  async function loadStats() {
    const stats = await fetchJson(DATA_DIR + "/stats.json");
    if (!stats) return;
    const grid = document.getElementById("stats-grid");
    if (!grid) return;
    grid.innerHTML = stats.byType.map((s) =>
      `<div class="stat-card">
        <div class="stat-type">${escapeHtml(s.type)}</div>
        <div class="stat-count">${s.count}</div>
        <div class="stat-meta">avg: ${s.avgSize} / max: ${s.maxSize}</div>
      </div>`
    ).join("");
    const totals = document.getElementById("stats-totals");
    if (totals) totals.textContent = "全コンポーネント: " + stats.totals.components;
  }

  async function loadDomains() {
    const dom = await fetchJson(DATA_DIR + "/domains.json");
    if (!dom) return;
    const list = document.getElementById("domain-list");
    if (!list) return;
    if (dom.domains.length === 0) {
      list.innerHTML = '<p class="muted">ドメイン未定義です。<code>yohaku domains init</code> で初期化してください (Phase 5)。</p>';
    } else {
      list.innerHTML = dom.domains.map((d) =>
        `<li>
          <div><span class="domain-name">${escapeHtml(d.label)}</span><span class="domain-count">(${d.members.length})</span></div>
          <ul class="domain-members">
            ${d.members.map((m) => `<li><code>${escapeHtml(m.type)}:${escapeHtml(m.name)}</code></li>`).join("")}
          </ul>
        </li>`
      ).join("");
    }
    const u = document.getElementById("unclassified-count");
    if (u) u.textContent = "未分類: " + dom.unclassifiedCount;
  }

  async function loadHotspots() {
    const h = await fetchJson(DATA_DIR + "/hotspots.json");
    if (!h) return;
    const el = document.getElementById("hotspots-list");
    if (!el) return;
    if (h.items.length === 0) {
      el.innerHTML = '<p class="muted">' + escapeHtml(h.note) + '</p>';
    } else {
      el.innerHTML = '<ul>' + h.items.map((it) =>
        `<li><code>${escapeHtml(it.type)}:${escapeHtml(it.name)}</code> — ${escapeHtml(it.reason)}</li>`
      ).join("") + '</ul>';
    }
  }

  async function loadArchitecture() {
    const arch = await fetchJson(DATA_DIR + "/architecture.json");
    if (!arch) return;
    renderArchHtml(arch);
    renderArchMermaid(arch);
    initDiagramSwitcher();
  }

  function renderArchHtml(arch) {
    const canvas = document.getElementById("arch-html");
    if (!canvas) return;
    const byType = { object: [], apex: [], trigger: [], flow: [], lwc: [] };
    for (const n of arch.nodes) (byType[n.type] || (byType[n.type] = [])).push(n);
    canvas.innerHTML = ['object', 'apex', 'trigger', 'flow']
      .filter((k) => (byType[k] || []).length > 0)
      .map((k) =>
        `<div class="arch-group">
          <h3>${escapeHtml(k)} (${byType[k].length})</h3>
          <ul>${byType[k].map((n) => `<li><code>${escapeHtml(n.label)}</code></li>`).join("")}</ul>
        </div>`
      ).join("") +
      `<div class="arch-edges">
        <h3>依存エッジ (${arch.edges.length})</h3>
        <ul>${arch.edges.slice(0, 200).map((e) =>
          `<li><code>${escapeHtml(e.from)}</code> <span class="edge-kind">— ${escapeHtml(e.kind)} →</span> <code>${escapeHtml(e.to)}</code></li>`
        ).join("")}</ul>
        ${arch.edges.length > 200 ? '<p class="muted">先頭 200 件のみ表示</p>' : ''}
      </div>`;
  }

  function renderArchMermaid(arch) {
    const container = document.getElementById("arch-mermaid");
    if (!container) return;
    if (typeof window.mermaid === "undefined") {
      container.classList.add("error");
      container.innerHTML = '<p class="mermaid-error-msg">Mermaid が読み込まれませんでした。HTML ビューに切り替えてください。</p>';
      autoSwitchToHtml();
      return;
    }
    try {
      const lines = ["flowchart LR"];
      for (const n of arch.nodes) {
        const safeId = n.id.replace(/[^A-Za-z0-9_]/g, "_");
        lines.push("  " + safeId + "[\"" + n.label.replace(/"/g, "'") + "\"]");
      }
      for (const e of arch.edges) {
        const f = e.from.replace(/[^A-Za-z0-9_]/g, "_");
        const t = e.to.replace(/[^A-Za-z0-9_]/g, "_");
        lines.push("  " + f + " -->|" + e.kind + "| " + t);
      }
      const source = lines.join("\n");
      window.mermaid.initialize({ startOnLoad: false, theme: "default" });
      window.mermaid.render("arch-svg", source).then((res) => {
        container.innerHTML = res.svg;
        const svg = container.querySelector("svg");
        if (svg && svg.getBoundingClientRect().width > window.innerWidth * 1.5) {
          autoSwitchToHtml("図が広すぎたため HTML ビューに切替");
        }
      }).catch((err) => {
        container.classList.add("error");
        container.innerHTML = '<p class="mermaid-error-msg">Mermaid 描画失敗: ' + escapeHtml(String(err)) + '</p>';
        autoSwitchToHtml("Mermaid 描画失敗のため切替");
      });
    } catch (e) {
      container.classList.add("error");
      container.innerHTML = '<p class="mermaid-error-msg">Mermaid 例外: ' + escapeHtml(String(e)) + '</p>';
      autoSwitchToHtml();
    }
  }

  function initDiagramSwitcher() {
    document.querySelectorAll(".diagram-switcher button").forEach((btn) => {
      btn.addEventListener("click", () => setDiagramMode(btn.getAttribute("data-mode")));
    });
  }
  function setDiagramMode(mode) {
    document.querySelectorAll(".diagram-switcher button").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-mode") === mode ? "true" : "false");
    });
    const html = document.getElementById("arch-html");
    const mer = document.getElementById("arch-mermaid");
    if (html) html.style.display = mode === "html" ? "" : "none";
    if (mer) mer.style.display = mode === "mermaid" ? "" : "none";
  }
  function autoSwitchToHtml(note) {
    setDiagramMode("html");
    const noteEl = document.querySelector(".diagram-switcher .fallback-note");
    if (noteEl && note) noteEl.textContent = note;
  }

  async function fetchJson(path) {
    try {
      const r = await fetch(path);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
