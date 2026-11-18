(() => {
  const svg = document.getElementById("tree"), cap = document.getElementById("tree-cap");
  if (!svg || !cap) return;
  const NS = "http://www.w3.org/2000/svg", GOLD = 137.508 * Math.PI / 180;
  const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  let last = -1;

  const spot = (i, total, cx, cy, rx, ry) => {
    const r = Math.sqrt((i + 0.5) / total), a = i * GOLD;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  };

  function draw(days, months) {
    const weeks = Math.floor(days / 7);
    const leaves = Math.min(weeks, 60), hearts = Math.min(months, 24);
    const g = Math.min(days / 365, 1);
    const size = 0.42 + 0.58 * Math.sqrt(g);
    svg.replaceChildren();
    svg.appendChild(mk("path", { class: "ground", d: "M20 240H280" }));

    const tree = mk("g", { transform: `translate(150 240) scale(${size.toFixed(3)}) translate(-150 -240)` });
    const w = 6 + 8 * g;
    tree.appendChild(mk("path", { class: "trunk", "stroke-width": w.toFixed(1), d: "M150 240C150 215 148 190 150 150" }));
    tree.appendChild(mk("path", { class: "trunk", "stroke-width": (w * .6).toFixed(1), d: "M150 190C132 180 122 168 116 150" }));
    tree.appendChild(mk("path", { class: "trunk", "stroke-width": (w * .6).toFixed(1), d: "M150 175C168 165 180 152 186 134" }));

    const crown = mk("g", { class: "crown" });
    const n = Math.max(leaves, 2);
    for (let i = 0; i < n; i++) {
      const [x, y] = spot(i, 60, 150, 112, 82, 62);
      crown.appendChild(mk("ellipse", {
        class: "leaf" + (i % 3 === 0 ? " alt" : ""), cx: x.toFixed(1), cy: y.toFixed(1), rx: 11, ry: 7,
        transform: `rotate(${((i * 47) % 120) - 60} ${x.toFixed(1)} ${y.toFixed(1)})`,
        style: `animation-delay:${Math.min(i * 40, 1200)}ms`
      }));
    }
    for (let i = 0; i < hearts; i++) {
      const [x, y] = spot(i * 2 + 1, 60, 150, 112, 70, 52);
      crown.appendChild(mk("path", {
        class: "bloom", d: "M0 -3C-3 -9 -11 -5 -6 1L0 7L6 1C11 -5 3 -9 0 -3Z",
        transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
        style: `animation-delay:${600 + i * 70}ms`
      }));
    }
    tree.appendChild(crown);
    svg.appendChild(tree);

    const stage = days < 7 ? "A tiny sprout 🌱" : days < 30 ? "A young sapling" : days < 365 ? "Growing strong" : "A big happy tree";
    const nextWeek = 7 - (days % 7);
    cap.innerHTML = `${stage}<small>A leaf for every week, a heart for every month. Next leaf in ${nextWeek} ${nextWeek === 1 ? "day" : "days"}.</small>`;
  }

  function update() {
    const days = parseInt(document.querySelector("[data-days]")?.textContent.replace(/\D/g, ""), 10);
    if (isNaN(days) || days === last) return;
    last = days;
    draw(days, parseInt(document.getElementById("s-months")?.textContent.replace(/\D/g, ""), 10) || 0);
  }

  const line = document.getElementById("since-line");
  if (line) new MutationObserver(update).observe(line, { childList: true, characterData: true, subtree: true });
  update();
})();
