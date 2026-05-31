(() => {
  // 先に let を宣言してから init を呼び出す (TDZ 回避: function 宣言は hoist されるが let は hoist されない)
  let modal;
  let input;
  let resultsEl;
  let entries = [];
  let filtered = [];
  let selectedIdx = 0;
  let hrefPrefix = "";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const indexEl = document.getElementById("yohaku-search-index");
    if (!indexEl) {
      console.warn("[yohaku] cmdk: search index not found in page");
      return;
    }
    try {
      const data = JSON.parse(indexEl.textContent);
      entries = (data.entries || []).slice();
    } catch (e) {
      console.warn("[yohaku] cmdk: search index parse failed:", e);
      return;
    }
    hrefPrefix = (document.body && document.body.getAttribute("data-href-prefix")) || "";
    buildModal();
    injectTriggerButton();
    document.addEventListener("keydown", onGlobalKey, true);
    console.info("[yohaku] cmdk ready (" + entries.length + " entries). Press ⌘K / ⌘⇧K / Ctrl+K / Ctrl+Shift+K or click the search button.");
  }

  // ヘッダに可視の "検索" ボタンを差し込み (キーボードショートカット競合のフォールバック)
  function injectTriggerButton() {
    const header = document.querySelector(".global-header");
    if (!header) return;
    if (header.querySelector(".cmdk-trigger")) return;
    const btn = document.createElement("button");
    btn.className = "cmdk-trigger";
    btn.type = "button";
    btn.setAttribute("aria-label", "コンポーネント検索を開く");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="10.5" cy="10.5" r="6"/><path d="m20 20-5.4-5.4"/></svg>' +
      '<span>検索</span>' +
      '<span class="cmdk-trigger-kbd">⌘⇧K</span>';
    btn.addEventListener("click", open);
    header.appendChild(btn);
  }

  function buildModal() {
    modal = document.createElement("div");
    modal.className = "cmdk-root";
    modal.setAttribute("data-open", "false");
    const sIcon = '<svg class="cmdk-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="m20 20-5.4-5.4"/></svg>';
    modal.innerHTML =
      '<div class="cmdk-modal" role="dialog" aria-label="検索">' +
        '<div class="cmdk-input-row">' +
          sIcon +
          '<input id="cmdk-input" type="search" placeholder="コンポーネント / ドメインを検索…" autocomplete="off" autocapitalize="off" spellcheck="false" />' +
          '<span class="cmdk-kbd">ESC</span>' +
        '</div>' +
        '<ul class="cmdk-results" id="cmdk-results" role="listbox"></ul>' +
        '<div class="cmdk-footer">' +
          '<span><span class="cmdk-kbd">⌘K</span> / <span class="cmdk-kbd">⌘⇧K</span> / <span class="cmdk-kbd">/</span> 開閉</span>' +
          '<span><span class="cmdk-kbd">↑↓</span> 移動</span>' +
          '<span><span class="cmdk-kbd">⏎</span> 開く</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    input = modal.querySelector("#cmdk-input");
    resultsEl = modal.querySelector("#cmdk-results");
    modal.addEventListener("click", (ev) => { if (ev.target === modal) close(); });
    input.addEventListener("input", () => { filter(input.value); });
    input.addEventListener("keydown", onInputKey);
  }

  function open() {
    if (!modal) return;
    modal.setAttribute("data-open", "true");
    input.value = "";
    filter("");
    setTimeout(() => input.focus(), 0);
  }
  function close() {
    if (!modal) return;
    modal.setAttribute("data-open", "false");
  }

  function onGlobalKey(ev) {
    const isOpen = modal && modal.getAttribute("data-open") === "true";
    const mod = ev.metaKey || ev.ctrlKey;
    const key = ev.key ? ev.key.toLowerCase() : "";
    // Cmd+K / Ctrl+K (Chrome の URL バー Cmd+K と競合することがあるので) と
    // Cmd+Shift+K / Ctrl+Shift+K を両方サポートする。
    if (mod && key === "k") {
      ev.preventDefault();
      ev.stopPropagation();
      if (isOpen) close(); else open();
      return;
    }
    // Cmd+P 等の VSCode 風も拾う (Chrome の Print 競合があるので preventDefault)
    if (mod && ev.shiftKey && key === "p") {
      ev.preventDefault();
      ev.stopPropagation();
      if (isOpen) close(); else open();
      return;
    }
    if (key === "/" && !isOpen) {
      const t = ev.target;
      const tag = (t && t.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      ev.preventDefault();
      open();
    }
    if (isOpen && ev.key === "Escape") {
      ev.preventDefault();
      close();
    }
  }

  function onInputKey(ev) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1);
      renderResults();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      renderResults();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const item = filtered[selectedIdx];
      if (item) {
        window.location.href = hrefPrefix + item.href;
      }
    }
  }

  function filter(q) {
    const lq = (q || "").trim().toLowerCase();
    if (lq === "") {
      filtered = entries.slice(0, 50);
    } else {
      const scored = [];
      for (const e of entries) {
        let s = 0;
        const ni = e.nameLc.indexOf(lq);
        if (ni === 0) s += 100;
        else if (ni > 0) s += 50;
        if (e.domainLc && e.domainLc.indexOf(lq) >= 0) s += 20;
        if (e.type.indexOf(lq) >= 0) s += 10;
        if (s > 0) scored.push({ e: e, s: s });
      }
      scored.sort((a, b) => b.s - a.s || a.e.nameLc.localeCompare(b.e.nameLc));
      filtered = scored.slice(0, 50).map((x) => x.e);
    }
    selectedIdx = 0;
    renderResults();
  }

  function renderResults() {
    if (filtered.length === 0) {
      resultsEl.innerHTML = '<li class="cmdk-empty">該当なし</li>';
      return;
    }
    resultsEl.innerHTML = filtered.map((e, i) => {
      const sel = i === selectedIdx ? "true" : "false";
      const dom = e.domain ? '<span class="meta">' + escapeHtml(e.domain) + '</span>' : "";
      return '<li aria-selected="' + sel + '" data-idx="' + i + '">' +
        '<span class="type-pill t-' + escapeHtml(e.type) + '" style="font-size:9.5px;padding:1px 7px;">' + escapeHtml(e.type) + '</span>' +
        '<span class="name">' + escapeHtml(e.name) + '</span>' +
        dom +
      '</li>';
    }).join("");
    Array.from(resultsEl.querySelectorAll("li[data-idx]")).forEach((li) => {
      li.addEventListener("click", () => {
        const idx = Number(li.getAttribute("data-idx"));
        const item = filtered[idx];
        if (item) window.location.href = hrefPrefix + item.href;
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
