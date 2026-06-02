(() => {
  const DATA_DIR = "./data";

  // 起動: DOMContentLoaded 後に必ず実行 (defer + 既に解析済みの両方をカバー)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  async function init() {
    try {
      initTabs();
      initSearch();
      initSidebarFilter();
      initBusinessFlowsScopeSwitcher();
      await Promise.all([
        loadStats(),
        loadDomains(),
        loadHotspots(),
        loadArchitecture(),
        loadBusinessFlows(),
      ]);
    } catch (err) {
      console.error("[yohaku] home init failed:", err);
      showFatalError(err);
    }
  }

  function showFatalError(err) {
    const el = document.querySelector(".home-main");
    if (!el) return;
    const msg = document.createElement("div");
    msg.className = "notice";
    msg.style.background = "#fff8f8";
    msg.style.borderColor = "#d1242f";
    msg.style.color = "#82071e";
    msg.textContent = "ホーム描画でエラーが発生しました: " + (err && err.message ? err.message : String(err));
    el.prepend(msg);
  }

  /**
   * data の取得は 3 段:
   *   1. <script type="application/json" id="yohaku-data-<name>"> を読む (file:// で確実に動く)
   *   2. それが無ければ fetch('./data/<name>.json') にフォールバック (将来サーバ配信時)
   *   3. どちらも失敗なら null
   */
  async function getData(name) {
    const inline = document.getElementById("yohaku-data-" + name);
    if (inline && inline.textContent && inline.textContent.trim() !== "") {
      try {
        return JSON.parse(inline.textContent);
      } catch (e) {
        console.warn("[yohaku] inline JSON parse failed for " + name + ":", e);
      }
    }
    try {
      const r = await fetch(DATA_DIR + "/" + name + ".json");
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

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

  function initSidebarFilter() {
    // 折りたたみグループの開閉
    document.querySelectorAll(".sidebar .sidebar-group-header").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const target = ev.target;
        if (target.closest && target.closest("a")) return; // 中の external link はスキップ
        const group = btn.closest(".sidebar-group");
        if (!group) return;
        const collapsed = group.getAttribute("data-collapsed") === "true";
        group.setAttribute("data-collapsed", collapsed ? "false" : "true");
      });
    });
  }

  async function loadStats() {
    const stats = await getData("stats");
    const grid = document.getElementById("stats-grid");
    if (!grid) return;
    if (!stats) {
      grid.innerHTML = '<p class="muted">統計データを読み込めませんでした。</p>';
      return;
    }
    const typeLabels = { apex: "Apex Classes", trigger: "Triggers", lwc: "LWC", object: "Objects", flow: "Flows" };
    grid.innerHTML = stats.byType.map((s) =>
      `<a class="stat-card t-${escapeHtml(s.type)}" href="./component/${encodeURIComponent(s.type)}/index.html" style="text-decoration:none;color:inherit;">
        <div class="stat-type">${escapeHtml(typeLabels[s.type] || s.type)}</div>
        <div class="stat-count">${s.count}</div>
        <div class="stat-meta">avg: ${s.avgSize} / max: ${s.maxSize}</div>
      </a>`
    ).join("");
    const totals = document.getElementById("stats-totals");
    if (totals) totals.textContent = "全コンポーネント: " + stats.totals.components + " 件。カードをクリックすると一覧ページへ遷移します。";
  }

  async function loadDomains() {
    const dom = await getData("domains");
    if (!dom) {
      const list = document.getElementById("domain-list");
      if (list) list.innerHTML = '<p class="muted">ドメインデータを読み込めませんでした。</p>';
      return;
    }
    const list = document.getElementById("domain-list");
    if (!list) return;
    if (!dom.domains || dom.domains.length === 0) {
      list.innerHTML = '<p class="muted">ドメイン未定義です。<code>yohaku domains init</code> を実行してください。</p>';
    } else {
      const TYPE_TO_PATH = { object: 'object', apex: 'apex', trigger: 'trigger', flow: 'flow', lwc: 'lwc' };
      function memberHref(m) {
        const safe = String(m.name).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
        return './component/' + (TYPE_TO_PATH[m.type] || m.type) + '/' + encodeURIComponent(safe) + '.html';
      }
      list.innerHTML = dom.domains.map((d) =>
        `<li>
          <div class="domain-header">
            <span class="domain-name">${escapeHtml(d.label)}</span>
            <span class="domain-count">${d.members.length} 件</span>
          </div>
          <ul class="domain-members">
            ${d.members.map((m) =>
              `<li><a href="${memberHref(m)}"><span class="type-pill t-${escapeHtml(m.type)}" style="font-size:9px;padding:1px 6px;margin-right:6px;">${escapeHtml(m.type)}</span>${m.label ? escapeHtml(m.label) + '<span class="api-name-inline">' + escapeHtml(m.name) + '</span>' : escapeHtml(m.name)}</a></li>`
            ).join("")}
          </ul>
        </li>`
      ).join("");
    }
    const u = document.getElementById("unclassified-count");
    if (u) u.textContent = "未分類コンポーネント: " + dom.unclassifiedCount + " 件 (domains.yaml に追加すると整理されます)";
  }

  async function loadHotspots() {
    const h = await getData("hotspots");
    const el = document.getElementById("hotspots-list");
    if (!el) return;
    if (!h) {
      el.innerHTML = '<p class="muted">ホットスポットデータを読み込めませんでした。</p>';
      return;
    }
    if (h.items.length === 0) {
      el.innerHTML = '<p class="muted">' + escapeHtml(h.note) + '</p>';
    } else {
      el.innerHTML = '<ul>' + h.items.map((it) =>
        `<li><code>${escapeHtml(it.type)}:${escapeHtml(it.name)}</code> — ${escapeHtml(it.reason)}</li>`
      ).join("") + '</ul>';
    }
  }

  // ===== 業務フロー (Phase 15) =====
  let bfData = null;
  let bfScope = "domain";

  function initBusinessFlowsScopeSwitcher() {
    document.querySelectorAll(".bf-scope-switcher button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = btn.getAttribute("data-scope");
        if (s !== "domain" && s !== "object") return;
        bfScope = s;
        document.querySelectorAll(".bf-scope-switcher button").forEach((b) => {
          b.setAttribute("aria-selected", b.getAttribute("data-scope") === bfScope ? "true" : "false");
        });
        renderBusinessFlows();
      });
    });
    const filter = document.getElementById("bf-filter");
    if (filter) filter.addEventListener("input", applyBusinessFlowFilter);
  }

  async function loadBusinessFlows() {
    bfData = await getData("business-flows");
    renderBusinessFlows();
  }

  function renderBusinessFlows() {
    const list = document.getElementById("bf-list");
    if (!list) return;
    if (!bfData) {
      list.innerHTML = '<p class="muted">業務フローデータを読み込めませんでした。</p>';
      return;
    }
    const flows = bfScope === "domain" ? (bfData.domainFlows || []) : (bfData.objectFlows || []);
    if (flows.length === 0) {
      const hint = bfScope === "domain"
        ? '<code>yohaku domains init</code> で domains.yaml を生成すると、ドメイン単位の業務フローがここに並びます。'
        : '<code>yohaku graph build</code> で SObject を取り込むと、オブジェクト単位の業務フローがここに並びます。';
      list.innerHTML = '<p class="muted">' + hint + '</p>';
      return;
    }
    list.innerHTML = flows.map(renderBusinessFlowCard).join("");
    applyBusinessFlowFilter();
  }

  function renderBusinessFlowCard(flow) {
    const scopeClass = flow.scope === "object" ? "scope-object" : "";
    const meaningHtml = flow.meaning
      ? '<div class="bf-meaning"><div class="bf-meaning-label">業務的意味づけ</div>' + flow.meaning + '</div>'
      : "";
    const counts = [
      ["entry", "入口", flow.entryPoints.length],
      ["process", "処理", flow.processing.length],
      ["data", "影響", flow.affectedData.length],
      ["downstream", "下流", flow.downstream.length],
    ].map((c) => '<span><strong>' + c[2] + '</strong> ' + escapeHtml(c[1]) + '</span>').join("");
    const search = flow.id + " " + flow.label + " " +
      flow.entryPoints.concat(flow.processing, flow.affectedData, flow.downstream)
        .map((s) => s.name).join(" ");
    return '<div class="bf-card" data-search="' + escapeHtml(search.toLowerCase()) + '">' +
      '<div class="bf-card-header">' +
        '<span class="bf-card-scope ' + scopeClass + '">' + escapeHtml(flow.scope === "object" ? "オブジェクト" : "ドメイン") + '</span>' +
        '<span class="bf-card-title">' + escapeHtml(flow.label) + '</span>' +
        '<span class="bf-card-counts">' + counts + '</span>' +
      '</div>' +
      meaningHtml +
      '<div class="bf-columns">' +
        renderBfColumn("entry", "入口", flow.entryPoints) +
        renderBfColumn("process", "処理", flow.processing) +
        renderBfColumn("data", "影響データ", flow.affectedData) +
        renderBfColumn("downstream", "下流", flow.downstream) +
      '</div>' +
    '</div>';
  }

  function renderBfColumn(role, label, steps) {
    const headerIcon = bfRoleIcon(role);
    const items = (steps || []).length === 0
      ? '<p class="bf-empty">該当なし</p>'
      : steps.map(bfStep).join("");
    return '<div class="bf-col">' +
      '<div class="bf-col-header">' +
        '<span class="bf-col-icon role-' + role + '">' + headerIcon + '</span>' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<span class="bf-col-count">' + (steps || []).length + '</span>' +
      '</div>' +
      items +
    '</div>';
  }

  const TYPE_PATH = { object: "object", apex: "apex", trigger: "trigger", flow: "flow", lwc: "lwc" };
  function bfStep(s) {
    const safe = String(s.name).replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
    const href = "./component/" + (TYPE_PATH[s.type] || s.type) + "/" + encodeURIComponent(safe) + ".html";
    return '<a class="bf-step t-' + escapeHtml(s.type) + '" href="' + href + '">' +
      '<span class="bf-step-name">' + escapeHtml(s.name) + '</span>' +
      (s.evidence ? '<span class="bf-step-evidence">' + escapeHtml(s.evidence) + '</span>' : '') +
    '</a>';
  }

  function bfRoleIcon(role) {
    // Simple inline SVG icon set
    if (role === "entry")      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
    if (role === "process")    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .51.32.96.81 1.18a1.65 1.65 0 0 0 1.51 0H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    if (role === "data")       return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>';
  }

  function applyBusinessFlowFilter() {
    const input = document.getElementById("bf-filter");
    const counter = document.getElementById("bf-counter");
    if (!input) return;
    const q = (input.value || "").trim().toLowerCase();
    const cards = Array.prototype.slice.call(document.querySelectorAll("#bf-list .bf-card"));
    let shown = 0;
    cards.forEach((c) => {
      const text = c.getAttribute("data-search") || "";
      const match = q === "" || text.indexOf(q) >= 0;
      c.classList.toggle("hidden", !match);
      if (match) shown++;
    });
    if (counter) counter.textContent = q === "" ? "" : shown + " / " + cards.length + " 件表示中";
  }

  async function loadArchitecture() {
    const arch = await getData("architecture");
    if (!arch) {
      const c = document.getElementById("arch-html");
      if (c) c.innerHTML = '<p class="muted">アーキテクチャデータを読み込めませんでした。</p>';
      return;
    }
    renderArchHtml(arch);
    renderArchMermaid(arch);
    initDiagramSwitcher();
  }

  function renderArchHtml(arch) {
    const canvas = document.getElementById("arch-html");
    if (!canvas) return;
    const byType = { object: [], apex: [], trigger: [], flow: [], lwc: [] };
    for (const n of arch.nodes) (byType[n.type] || (byType[n.type] = [])).push(n);
    const laneOrder = ['object', 'apex', 'trigger', 'flow'];
    // SVG icon definitions (inline, currentColor) — emoji を避ける
    const SVG = (paths) => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">' + paths + '</svg>';
    const laneIcons = {
      object: SVG('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
      apex: SVG('<path d="M8 4c-2 0-3 1-3 3v3c0 1.3-.7 2-2 2 1.3 0 2 .7 2 2v3c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v3c0 1.3.7 2 2 2-1.3 0-2 .7-2 2v3c0 2-1 3-3 3"/>'),
      trigger: SVG('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
      flow: SVG('<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7-3.3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7 3.3"/><path d="m17 3 2 3-3 2"/><path d="M7 21l-2-3 3-2"/>'),
    };
    const laneLabels = { object: 'SObjects', apex: 'Apex Classes', trigger: 'Triggers', flow: 'Flows' };
    const TYPE_TO_PATH = { object: 'object', apex: 'apex', trigger: 'trigger', flow: 'flow', lwc: 'lwc' };
    function nodeHref(n) {
      const fqn = n.id.indexOf(':') >= 0 ? n.id.slice(n.id.indexOf(':') + 1) : n.id;
      const safe = String(fqn).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
      return './component/' + (TYPE_TO_PATH[n.type] || n.type) + '/' + encodeURIComponent(safe) + '.html';
    }
    const lanesHtml = laneOrder.map((k) => {
      const items = byType[k] || [];
      return `<div class="arch-lane l-${k}">
        <div class="arch-lane-header">
          <span class="lane-icon-wrap">${laneIcons[k] || ''}</span>
          <span class="lane-title">${escapeHtml(laneLabels[k] || k)}</span>
          <span class="lane-count">${items.length}</span>
        </div>
        <div class="arch-lane-body">
        ${items.length === 0 ? '<p class="arch-empty">該当なし</p>' :
          items.map((n) =>
            `<a class="arch-node" data-node-id="${escapeHtml(n.id)}" href="${nodeHref(n)}">
              <span class="node-name">${escapeHtml(n.label)}</span>
              ${n.apiName && n.apiName !== n.label ? '<span class="node-api">' + escapeHtml(n.apiName) + '</span>' : ''}
            </a>`
          ).join("")
        }
        </div>
      </div>`;
    }).join("");
    const edgesByKind = { queries: [], writes: [], triggers: [], uses: [] };
    for (const e of arch.edges) (edgesByKind[e.kind] || (edgesByKind[e.kind] = [])).push(e);
    const ARROW_SVG = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
    const edgesHtml = arch.edges.slice(0, 300).map((e) => {
      const fromLabel = e.from.split(':').slice(1).join(':') || e.from;
      const toLabel = e.to.split(':').slice(1).join(':') || e.to;
      return `<li class="k-${escapeHtml(e.kind)}">
        <span class="edge-kind">${escapeHtml(e.kind)}</span>
        <code>${escapeHtml(fromLabel)}</code>
        ${ARROW_SVG}
        <code>${escapeHtml(toLabel)}</code>
      </li>`;
    }).join("");
    canvas.innerHTML =
      `<div class="arch-lanes">${lanesHtml}</div>
      <div class="arch-edges-panel">
        <h3>依存エッジ <span style="color:var(--muted-soft);font-weight:500;">(${arch.edges.length})</span></h3>
        <ul class="arch-edges-list">${edgesHtml}</ul>
        ${arch.edges.length > 300 ? '<p class="muted" style="font-size:12px;margin-top:10px;">先頭 300 件のみ表示</p>' : ''}
      </div>`;
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
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: "basis",
          padding: 12,
          nodeSpacing: 50,
          rankSpacing: 60
        }
      });
      window.__yohakuMermaidInit = true;
      return true;
    } catch (e) {
      console.warn("[yohaku] mermaid init failed:", e);
      return false;
    }
  }

  function renderArchMermaid(arch) {
    const container = document.getElementById("arch-mermaid");
    if (!container) return;
    if (!ensureMermaidInit()) {
      container.classList.add("error");
      container.innerHTML = '<p class="mermaid-error-msg">Mermaid が読み込まれませんでした。グループビューに切り替えてください。</p>';
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
      window.mermaid.render("arch-svg", source).then((res) => {
        container.innerHTML = res.svg;
      }).catch((err) => {
        container.classList.add("error");
        container.innerHTML = '<p class="mermaid-error-msg">Mermaid 描画失敗: ' + escapeHtml(String(err)) + '</p>';
        const note = document.querySelector(".arch-toolbar .fallback-note");
        if (note) note.textContent = "Mermaid 描画に失敗しました。グループビューをご利用ください。";
      });
    } catch (e) {
      container.classList.add("error");
      container.innerHTML = '<p class="mermaid-error-msg">Mermaid 例外: ' + escapeHtml(String(e)) + '</p>';
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
    // 既定がグループビュー (html) なので、エラー時の note 表示のみ行う
    const noteEl = document.querySelector(".arch-toolbar .fallback-note");
    if (noteEl && note) noteEl.textContent = note;
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
