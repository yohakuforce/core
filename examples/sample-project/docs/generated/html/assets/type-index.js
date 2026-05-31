(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("filter-input");
    const grid = document.getElementById("type-index-grid");
    const counter = document.getElementById("filter-counter");
    if (!input || !grid) return;
    const cards = Array.from(grid.querySelectorAll(".type-index-card"));
    function apply() {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      for (const c of cards) {
        const text = (c.getAttribute("data-name") || "") + " " + (c.getAttribute("data-domain") || "");
        const match = q === "" || text.indexOf(q) >= 0;
        c.classList.toggle("hidden", !match);
        if (match) shown++;
      }
      if (counter) counter.textContent = q === "" ? "" : shown + " / " + cards.length + " 件表示中";
    }
    input.addEventListener("input", apply);
  });
})();
