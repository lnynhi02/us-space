(() => {
  const svg = document.getElementById("tree"), cap = document.getElementById("tree-cap");
  if (!svg || !cap) return;
  const NS = "http://www.w3.org/2000/svg", GOLD = 137.508 * Math.PI / 180;
  const HEART = "M0 -3C-3 -9 -11 -5 -6 1L0 7L6 1C11 -5 3 -9 0 -3Z";
  const LEAF = "M0 0C3 -7 11 -8 16 0C11 8 3 7 0 0Z";
  const mk = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const cm = c => `color-mix(in srgb,${c},#0F1A12 var(--tr-dim))`;
  const PAL = {
    spring: { fallc: "#F2B6C2" },
    summer: { f1: "#4C8A3C", f2: "#6DB04F", f3: "#97D26A", leaf: "#2F7A2F", leaf2: "#D4E46A", fallc: "#CFE27A", hill: "#D8E2A4", hill2: "#C6D68C" },
    autumn: { f1: "#A24A1C", f2: "#D6802A", f3: "#EEB04C", leaf: "#B5401E", leaf2: "#F2C14E", fallc: "#E58A2E", hill: "#E3D2A4", hill2: "#D2BD8A" },
    winter: { f1: "#5B756F", f2: "#7D9A93", f3: "#A8BFBA", leaf: "#4F6B66", leaf2: "#C9DBD8", fallc: "#FFFFFF", hill: "#F3F7F8", hill2: "#E2EAEE" }
  };
  const EMO = { spring: "🌸", summer: "☀️", autumn: "🍂", winter: "❄️" };
  // Season follows the device date (Northern Hemisphere); data-season on the svg overrides it
  const curSeason = () => {
    const s = svg.dataset.season; if (PAL[s]) return s;
    const m = new Date().getMonth(); return m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
  };
  let last = -1;

  // ---- Styles (self-contained, prefixed tr- so nothing clashes with motion.css) ----
  if (!document.getElementById("tree-style")) {
    const st = document.createElement("style");
    st.id = "tree-style";
    st.textContent = `
#tree{--tr-sun:#F5DEA6;--tr-hill:#D5DFC6;--tr-hill2:#C3D1B0;--tr-bark:#7B5E48;--tr-bark2:#5E4636;
  --tr-f1:#6F9461;--tr-f2:#8DAF7C;--tr-f3:#AECB97;--tr-leaf:#4F6B4A;--tr-leaf2:#C6D47A;
  --tr-heart:#E28A9A;--tr-star:0;--tr-shadow:rgba(46,59,46,.16);--tr-dim:0%;--tr-snow:#F6FAFB;cursor:pointer;overflow:visible}
@media (prefers-color-scheme:dark){#tree{--tr-sun:#EDE6C0;--tr-hill:#2E4033;--tr-hill2:#26372B;--tr-bark:#9A7B62;--tr-bark2:#7A5E49;
  --tr-f1:#2F4A39;--tr-f2:#3F6249;--tr-f3:#55805C;--tr-leaf:#9DC08D;--tr-leaf2:#D8DF9A;
  --tr-heart:#F0A0AE;--tr-star:.85;--tr-shadow:rgba(0,0,0,.28);--tr-dim:45%;--tr-snow:#DCE6EA}}
#tree .tr-hill{fill:var(--tr-hill)}#tree .tr-hill2{fill:var(--tr-hill2)}
#tree .tr-shadow{fill:var(--tr-shadow)}
#tree .tr-bark{fill:var(--tr-bark)}
#tree .tr-branch{fill:none;stroke:var(--tr-bark);stroke-linecap:round}
#tree .tr-grain{fill:none;stroke:var(--tr-bark2);stroke-width:1.6;stroke-linecap:round;opacity:.55}
#tree .tr-tuft{fill:none;stroke:var(--tr-leaf);stroke-width:1.6;stroke-linecap:round;opacity:.7}
#tree .tr-f1{fill:var(--tr-f1)}#tree .tr-f2{fill:var(--tr-f2)}#tree .tr-f3{fill:var(--tr-f3)}
#tree .tr-leaf{fill:var(--tr-leaf);opacity:.9;animation:tr-flutter var(--fs,3.4s) ease-in-out infinite,tr-pop .6s cubic-bezier(.3,1.5,.5,1) backwards;animation-delay:var(--fd,0s),var(--d,0s)}
#tree .tr-leaf.alt{fill:var(--tr-leaf2)}
#tree .tr-heart{fill:var(--tr-heart);animation:tr-pop .6s cubic-bezier(.3,1.6,.5,1) backwards,tr-beat 3s ease-in-out infinite;
  animation-delay:var(--d,0s),calc(var(--d,0s) + 1s)}
#tree .tr-swing{animation:tr-swing var(--sd,4s) ease-in-out infinite;animation-delay:var(--sdl,0s)}
#tree .tr-string{fill:none;stroke:var(--tr-bark);stroke-width:1;stroke-linecap:round;opacity:.75}
#tree .tr-fall{fill:var(--tr-fallc,var(--tr-leaf2));opacity:0;animation:tr-fall var(--t,8s) ease-in infinite;animation-delay:var(--d,0s)}
#tree .tr-float{fill:var(--tr-heart);animation:tr-float 1.5s ease-out forwards}
#tree .tr-star{fill:var(--tr-sun);opacity:calc(var(--tr-star) * .9);animation:tr-twinkle 3.4s ease-in-out infinite;animation-delay:var(--d,0s)}
#tree .tr-sway{transform-origin:150px 175px;animation:tr-sway 8s ease-in-out infinite}
#tree .tr-gust{transform-origin:150px 175px;animation:tr-gust var(--gd,5s) ease-in-out infinite;animation-delay:var(--gdl,0s)}
@keyframes tr-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes tr-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes tr-swing{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(6deg)}}
@keyframes tr-sway{0%{transform:rotate(-1deg)}18%{transform:rotate(1.6deg)}34%{transform:rotate(.3deg)}55%{transform:rotate(2.4deg)}72%{transform:rotate(-.8deg)}100%{transform:rotate(-1deg)}}
@keyframes tr-gust{0%,100%{transform:rotate(-.7deg)}50%{transform:rotate(.9deg)}}
@keyframes tr-flutter{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}
@keyframes tr-fall{0%{opacity:0;transform:translate(0,0) rotate(0)}12%{opacity:.9}85%{opacity:.8}
  100%{opacity:0;transform:translate(var(--dx,20px),115px) rotate(240deg)}}
@keyframes tr-float{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translateY(-48px) scale(1.25)}}
@keyframes tr-twinkle{0%,100%{opacity:calc(var(--tr-star) * .3)}50%{opacity:var(--tr-star)}}
#tree .tr-snow{fill:var(--tr-snow)}
#tree .tr-flake{fill:var(--tr-snow);stroke:rgba(110,140,160,.4);stroke-width:.5;opacity:0;animation:tr-snowfall var(--t,9s) linear infinite;animation-delay:var(--d,0s)}
#tree .tr-gleaf{fill:var(--tr-fallc);opacity:.85}
#tree .tr-rays{opacity:calc(1 - var(--tr-star));transform-origin:238px 52px;animation:tr-spin 40s linear infinite}
@keyframes tr-snowfall{0%{opacity:0;transform:translate(0,-8px)}8%{opacity:.95}92%{opacity:.95}100%{opacity:0;transform:translate(var(--dx,10px),262px)}}
@keyframes tr-spin{to{transform:rotate(360deg)}}
#tree .tr-bird{animation:tr-fly 2.4s cubic-bezier(.2,.75,.3,1) backwards}
#tree .tr-head{transform-origin:-4px -8px;animation:tr-bob 1.5s ease-in-out 2.4s infinite}
#tree .tr-note{opacity:0;animation:tr-note 2.7s ease-out infinite}
#tree .tr-flit{animation:tr-flit var(--t,12s) ease-in-out infinite;animation-delay:var(--d,0s)}
#tree .tr-flap{animation:tr-flap .4s ease-in-out infinite}
@keyframes tr-fly{from{opacity:0;transform:translate(130px,-80px)}60%{opacity:1}to{transform:translate(0,0)}}
@keyframes tr-bob{0%,100%{transform:rotate(0)}30%{transform:rotate(-9deg)}60%{transform:rotate(3deg)}}
@keyframes tr-note{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translate(-14px,-24px) scale(1.1)}}
@keyframes tr-flit{0%,100%{transform:translate(0,0)}25%{transform:translate(34px,-16px)}50%{transform:translate(60px,6px)}75%{transform:translate(26px,18px)}}
@keyframes tr-flap{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.25)}}
#tree .tr-bloom{animation:tr-pop .6s cubic-bezier(.3,1.6,.5,1) backwards,tr-turn 16s linear infinite;animation-delay:var(--d,0s),calc(var(--d,0s) + .6s)}
@keyframes tr-turn{to{transform:rotate(360deg)}}
#tree .tr-stem{fill:none;stroke:var(--tr-leaf);stroke-width:1.1;stroke-linecap:round}
#tree .tr-pop2{animation:tr-pop .6s cubic-bezier(.3,1.6,.5,1) backwards;animation-delay:var(--d,0s)}
#tree .tr-breathe{animation:tr-beat 3s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){#tree .tr-flake{display:none}}
@media (prefers-reduced-motion:reduce){#tree *{animation:none!important}#tree .tr-fall{display:none}}
`;
    document.head.appendChild(st);
  }

  // Canopy clusters, ordered centre-out so the crown fills in as the tree grows
  const B = [[150,120,34],[128,108,28],[172,108,28],[150,92,30],[112,126,24],[190,126,24],[134,80,24],
    [168,80,24],[108,100,22],[194,100,22],[150,66,22],[124,134,22],[178,134,22]];

  function draw(days, months) {
    const weeks = Math.floor(days / 7);
    const leaves = Math.min(weeks, 60), hearts = Math.min(months, 24);
    const g = Math.min(days / 365, 1);
    const size = 0.42 + 0.58 * Math.sqrt(g);
    const prog = leaves / 60;
    const cnt = Math.max(3, Math.min(B.length, 3 + Math.round(prog * (B.length - 3))));
    const f = 0.75 + 0.25 * prog;
    const season = curSeason(), win = season === "winter";
    svg.style.cssText = Object.entries(PAL[season]).map(([k, v]) => `--tr-${k}:${cm(v)}`).join(";");
    svg.replaceChildren();

    // Sky: sun/moon glow + stars (stars only show in dark mode)
    const defs = mk("defs", {}, svg);
    const rg = mk("radialGradient", { id: "tr-glow" }, defs);
    mk("stop", { offset: "0", style: "stop-color:var(--tr-sun)", "stop-opacity": season === "summer" ? ".8" : ".55" }, rg);
    mk("stop", { offset: "1", style: "stop-color:var(--tr-sun)", "stop-opacity": "0" }, rg);
    mk("circle", { cx: 238, cy: 52, r: season === "summer" ? 70 : 46, fill: "url(#tr-glow)" }, svg);
    const sr = { summer: 19, winter: 12 }[season] || 15;
    if (season === "summer") {
      const rays = mk("g", { class: "tr-rays", style: "fill:none;stroke:#FFC93C;stroke-width:2.2;stroke-linecap:round" }, svg);
      for (let k = 0; k < 14; k++) {
        const t = k * Math.PI / 7, b = k % 2 ? 32 : 38;
        mk("path", { d: `M${(238 + Math.cos(t) * 25).toFixed(1)} ${(52 + Math.sin(t) * 25).toFixed(1)}L${(238 + Math.cos(t) * b).toFixed(1)} ${(52 + Math.sin(t) * b).toFixed(1)}` }, rays);
      }
    }
    mk("circle", { cx: 238, cy: 52, r: sr, style: "fill:" + (season === "summer" ? "color-mix(in srgb,#FFC93C calc((1 - var(--tr-star)) * 100%),var(--tr-sun))" : "var(--tr-sun)"), opacity: ".9" }, svg);
    [[30,34],[62,60],[92,26],[44,96],[270,110],[200,20],[18,70]].forEach(([x, y], i) =>
      mk("circle", { class: "tr-star", cx: x, cy: y, r: i % 2 ? 1.1 : 1.6, style: `--d:${(i * 0.5).toFixed(1)}s` }, svg));

    // Ground: two soft hills, grass tufts
    mk("path", { class: "tr-hill2", d: "M0 244C60 226 110 236 150 236C200 236 240 224 300 241V260H0Z" }, svg);
    mk("path", { class: "tr-hill", d: "M0 252C70 238 140 247 200 241C250 237 280 242 300 247V260H0Z" }, svg);
    (win ? [] : [34, 66, 98, 206, 240, 268]).forEach((x, i) => {
      const y = 246 + (i % 2) * 2;
      mk("path", { class: "tr-tuft", d: `M${x} ${y}q-2 -7 -4 -9M${x} ${y}q0 -8 1 -11M${x} ${y}q2 -6 5 -8` }, svg);
    });

    if (win) {
      [[30, 246, 30], [84, 249, 24], [196, 247, 26], [272, 246, 30]].forEach(([x, y, rx]) => mk("ellipse", { class: "tr-snow", cx: x, cy: y, rx, ry: 5, style: "stroke:rgba(110,140,160,.28);stroke-width:.6" }, svg));
      const sm = mk("g", { transform: "translate(236 246)", style: "stroke:rgba(110,140,160,.5);stroke-width:.8" }, svg);
      [[-13, 13], [-33, 9.5], [-48, 7]].forEach(([y, r]) => mk("circle", { class: "tr-snow", cx: 0, cy: y, r }, sm));
      mk("path", { d: "M-8 -35L-19 -41M8 -35L19 -43", style: "fill:none;stroke:#7B5E48;stroke-width:1.4;stroke-linecap:round" }, sm);
      mk("path", { d: "M-8.6 -41.5Q0 -38 8.6 -41.5", style: "fill:none;stroke:#D9566F;stroke-width:3;stroke-linecap:round" }, sm);
      mk("path", { d: "M0 -47.5L6 -46.2L0 -45.6Z", style: "fill:#F2862E;stroke:none" }, sm);
      [[-2.6, -49.5], [2.6, -49.5], [0, -35], [0, -30.5]].forEach(([x, y]) => mk("circle", { cx: x, cy: y, r: .9, style: "fill:#1E2A21;stroke:none" }, sm));
      mk("ellipse", { cx: 0, cy: -54.2, rx: 7.5, ry: 1.6, style: "fill:#3A4A40;stroke:none" }, sm);
      mk("rect", { x: -4.2, y: -62, width: 8.4, height: 8, rx: 1, style: "fill:#3A4A40;stroke:none" }, sm);
    }
    if (season === "summer") [[18, 9, "#FFE066"], [52, 11, "#FFFFFF"], [86, 8, "#F28FB0"], [214, 10, "#FFE066"], [252, 8, "#F28FB0"], [284, 11, "#FFFFFF"]].forEach(([x, h, c], k) => {
      const fl = mk("g", { transform: `translate(${x} ${248 + (k % 2)})` }, svg);
      mk("path", { d: `M0 0V${-h}`, style: "fill:none;stroke:var(--tr-leaf);stroke-width:1.1;stroke-linecap:round" }, fl);
      for (let p = 0; p < 5; p++) { const t = p * Math.PI * 2 / 5; mk("circle", { cx: (Math.cos(t) * 2.7).toFixed(1), cy: (-h + Math.sin(t) * 2.7).toFixed(1), r: 1.9, style: "fill:" + c }, fl); }
      mk("circle", { cx: 0, cy: -h, r: 1.6, style: "fill:#E8892B" }, fl);
    });
    if (season === "autumn") {
      const pk = mk("g", { transform: "translate(62 247)" }, svg);
      [[-4.5, 5.2, "#D9661F"], [4.5, 5.2, "#D9661F"], [0, 5, "#F28A35"]].forEach(([x, rx, c]) => mk("ellipse", { cx: x, cy: -5.5, rx, ry: 5.8, style: "fill:" + c }, pk));
      mk("path", { d: "M0 -11.5V-15M0 -14.5q3 -1 4 1", style: "fill:none;stroke:#5E7A3A;stroke-width:1.8;stroke-linecap:round" }, pk);
      [[228, 1], [241, .7]].forEach(([x, s]) => {
        const ms = mk("g", { transform: `translate(${x} 248) scale(${s})` }, svg);
        mk("rect", { x: -1.7, y: -6, width: 3.4, height: 6, rx: 1, style: "fill:#F3E9D2" }, ms);
        mk("path", { d: "M-6.5 -5A6.5 5.6 0 0 1 6.5 -5Z", style: "fill:#C8442F" }, ms);
        [[-2.5, -7.2], [2, -8.2]].forEach(([cx, cy]) => mk("circle", { cx, cy, r: 1, style: "fill:#FBF3E0" }, ms));
      });
    }
    if (season === "autumn") for (let k = 0; k < 7; k++) mk("path", { class: "tr-gleaf", d: LEAF, transform: `translate(${28 + k * 40 + (k % 2) * 9} ${247 + (k % 3) * 2}) rotate(${(k * 71) % 180 - 90}) scale(.5)` }, svg);
    const tree = mk("g", { transform: `translate(150 242) scale(${size.toFixed(3)}) translate(-150 -242)` }, svg);
    mk("ellipse", { class: "tr-shadow", cx: 150, cy: 242, rx: 38 + 30 * prog, ry: 5 }, tree);

    // Trunk: tapered, flared base, thickens with age; branches reach into the crown
    const tw = (0.7 + 0.3 * g).toFixed(3);
    const trunk = mk("g", { transform: `translate(150 0) scale(${tw} 1) translate(-150 0)` }, tree);
    mk("path", { class: "tr-bark", d: "M132 243C143 237 146 220 146 200C146 180 143 160 146 138L154 138C157 160 154 180 154 200C154 220 157 237 168 243Z" }, trunk);
    mk("path", { class: "tr-grain", d: "M151 236C152 214 152 192 151 156M147 228C147 214 147 200 148 186" }, trunk);
    const bw = 5 + 5 * g;
    mk("path", { class: "tr-branch", "stroke-width": bw.toFixed(1), d: "M149 196C136 188 124 176 114 154" }, tree);
    mk("path", { class: "tr-branch", "stroke-width": (bw * .9).toFixed(1), d: "M151 178C166 168 178 156 188 136" }, tree);
    mk("path", { class: "tr-branch", "stroke-width": (bw * .7).toFixed(1), d: "M149 214C139 210 131 204 124 194" }, tree);

    // Crown: layered foliage (shadow → mid → highlight) for depth
    const crown = mk("g", { class: "tr-sway" }, tree);
    const lay = ["f1", "f2", "f3"].map((c, k) => mk("g", { class: "tr-" + c + " tr-gust", style: `--gd:${(5.2 + k * 1.3).toFixed(1)}s;--gdl:${(-k * 1.7).toFixed(1)}s` }, crown));
    for (let i = 0; i < cnt; i++) {
      const [x, y, r] = B[i], R = r * f;
      mk("circle", { cx: x, cy: y + 3, r: R }, lay[0]);
      mk("circle", { cx: x - 3, cy: y - 2, r: R * .82 }, lay[1]);
      mk("circle", { cx: x - 8, cy: y - 9, r: R * .5 }, lay[2]);
    }
    if (win) {
      const sg = mk("g", { class: "tr-snow" }, crown);
      B.slice(0, cnt).forEach(([x, y, r], i, all) => {
        const R = r * f, cy = y - R * .62;
        if (all.some(([bx, by, br], j) => j !== i && Math.hypot(x - 2 - bx, cy - by) < br * f * .8)) return;
        mk("ellipse", { cx: x - 2, cy, rx: R * .7, ry: R * .3 }, sg);
      });
    }

    // One leaf per week, spread evenly over the whole canopy: sample a spiral, keep points
    // inside the foliage, then thin them evenly so leaves never pile up in one spot
    const n = Math.max(leaves, 2), cs = B.slice(0, cnt);
    const lx0 = Math.min(...cs.map(([x, , r]) => x - r * f)), lx1 = Math.max(...cs.map(([x, , r]) => x + r * f));
    const ly0 = Math.min(...cs.map(([, y, r]) => y - r * f)), ly1 = Math.max(...cs.map(([, y, r]) => y + r * f));
    const M = n * 3 + 40, inside = [];
    for (let k = 0; k < M; k++) {
      const q = Math.sqrt((k + 0.5) / M), a = k * GOLD;
      const x = (lx0 + lx1) / 2 + Math.cos(a) * (lx1 - lx0) / 2 * q, y = (ly0 + ly1) / 2 + Math.sin(a) * (ly1 - ly0) / 2 * q;
      if (cs.some(([bx, by, r]) => Math.hypot(x - bx, y - by) < r * f * 0.85)) inside.push([x, y]);
    }
    const ls = (0.8 - 0.2 * prog).toFixed(2);
    for (let i = 0; i < n && inside.length; i++) {
      const [x, y] = inside[Math.min(inside.length - 1, Math.floor(i * inside.length / n))];
      const gg = mk("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(i * 137) % 360}) scale(${ls}) translate(-8 0)` }, crown);
      mk("path", { class: "tr-leaf" + (i % 3 === 0 ? " alt" : ""), d: LEAF, style: `--d:${Math.min(i * 40, 1200)}ms;--fs:${(2.8 + (i % 5) * .35).toFixed(2)}s;--fd:-${((i * .37) % 3).toFixed(2)}s` }, gg);
    }

    // One flower per month, hanging from the lower edge of the crown on a little string
    const act = B.slice(0, cnt);
    const x0 = Math.min(...act.map(([x, , r]) => x - r * f)) + 10, x1 = Math.max(...act.map(([x, , r]) => x + r * f)) - 10;
    const edge = x => Math.max(...act.map(([bx, by, r]) => { const R = r * f, dx = x - bx; return Math.abs(dx) < R ? by + 3 + Math.sqrt(R * R - dx * dx) : -1e9; }));
    for (let i = 0; i < hearts; i++) {
      let x = x0 + (x1 - x0) * ((i * 0.618 + 0.13) % 1);
      if (Math.abs(x - 150) < 9) x += x < 150 ? -12 : 12;
      const e = edge(x), y = (e > 0 ? e : 150) - 5, L = 10 + (i * 7 % 5) * 4;
      const pos = mk("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, crown);
      const sw = mk("g", { class: "tr-swing", style: `--sd:${(3.6 + (i % 4) * .6).toFixed(1)}s;--sdl:${(-i * .7).toFixed(1)}s` }, pos);
      mk("path", { class: "tr-string", d: `M0 0V${L}` }, sw);
      const hg = mk("g", { transform: `translate(0 ${L + 4})` }, sw);
      const [pc, cc] = [["var(--tr-heart)", "#F2B84B"], ["#FFF4DA", "#F2A33A"], ["#C9B6F0", "#FFE08A"]][i % 3];
      const fg = mk("g", { class: "tr-bloom", style: `--d:${600 + i * 70}ms` }, hg);
      for (let p = 0; p < 5; p++) { const t = p * Math.PI * 2 / 5; mk("circle", { cx: (Math.sin(t) * 3.1).toFixed(2), cy: (-Math.cos(t) * 3.1).toFixed(2), r: 2.5, style: "fill:" + pc }, fg); }
      mk("circle", { cx: 0, cy: 0, r: 1.7, style: "fill:" + cc }, fg);
    }

    // A few leaves drifting down once the tree has some foliage
    if (leaves >= 6 && !win) {
      [[3, -30, 7, 1], [5, 26, 9, 3.5], [8, 40, 8, 6], ...(season === "autumn" ? [[1, 34, 8, 2], [6, -36, 9, 4.5], [10, 22, 7, 7], [4, -24, 10, 0.5]] : [])].forEach(([bi, dx, t, d]) => {
        const [bx, by, br] = B[bi % cnt];
        const gg = mk("g", { transform: `translate(${bx} ${(by + br * f * .7).toFixed(1)}) scale(.6)` }, crown);
        mk("path", { class: "tr-fall", d: LEAF, style: `--dx:${dx}px;--t:${t}s;--d:${d}s` }, gg);
      });
    }

    if (season === "spring") {
      const bp = mk("g", { transform: "translate(126 188)" }, tree), bird = mk("g", { class: "tr-bird" }, bp);
      const F = (c, o) => ({ ...o, style: "fill:" + cm(c) });
      mk("path", F("#4B84B8", { d: "M7 -6L18 -3L8 -1Z" }), bird);
      mk("ellipse", F("#6FA8DC", { cx: 0, cy: -6, rx: 9, ry: 6.5 }), bird);
      mk("ellipse", F("#F6E7B4", { cx: -1, cy: -3.5, rx: 6.5, ry: 3.8 }), bird);
      mk("path", F("#4B84B8", { d: "M2 -8C8 -9 12 -6 13 -3C8 -3 4 -4 2 -8Z" }), bird);
      mk("path", { d: "M-2 0V-1.5M2 0V-1.5", style: "fill:none;stroke:#C77B30;stroke-width:1;stroke-linecap:round" }, bird);
      const hd = mk("g", { class: "tr-head" }, bird);
      mk("circle", F("#6FA8DC", { cx: -8, cy: -11, r: 4.6 }), hd);
      mk("path", { d: "M-12.2 -11.6L-16.2 -10.4L-12.2 -9.6Z", style: "fill:#F2A33A" }, hd);
      mk("circle", { cx: -9.3, cy: -12, r: .9, style: "fill:#1E2A21" }, hd);
      for (let k = 0; k < 3; k++) {
        const ng = mk("g", { class: "tr-note", style: `animation-delay:${(2.4 + k * .9).toFixed(1)}s` }, mk("g", { transform: "translate(-18 -13)" }, bp));
        mk("circle", { cx: 0, cy: 0, r: 1.7, style: "fill:#F2A33A" }, ng);
        mk("path", { d: "M1.6 0V-7q2 .6 3 3.4", style: "fill:none;stroke:#F2A33A;stroke-width:1.1;stroke-linecap:round" }, ng);
      }
    }
    if (win) mk("ellipse", { class: "tr-snow", cx: 150, cy: 243, rx: 44, ry: 6, style: "stroke:rgba(110,140,160,.3);stroke-width:.6" }, tree);
    if (season === "summer") [[60, 140, 12, 0, "#F28FB0"], [205, 150, 14, 4, "#FFB347"]].forEach(([x, y, t, d, c]) => {
      const fl = mk("g", { class: "tr-flit", style: `--t:${t}s;--d:-${d}s` }, mk("g", { transform: `translate(${x} ${y})` }, svg));
      mk("path", { d: "M0 2V-3", style: "fill:none;stroke:#4A3B2A;stroke-width:1.1;stroke-linecap:round" }, fl);
      const wg = mk("g", { class: "tr-flap" }, fl);
      mk("ellipse", { cx: -3, cy: -2, rx: 3, ry: 2.4, style: "fill:" + c }, wg);
      mk("ellipse", { cx: 3, cy: -2, rx: 3, ry: 2.4, style: "fill:" + c }, wg);
    });
    if (win) for (let k = 0; k < 18; k++) mk("circle", { class: "tr-flake", cx: ((k * 53) % 290) + 5, cy: 0, r: 1 + (k % 3) * .5, style: `--t:${7 + (k % 5)}s;--d:${(-k * 0.9).toFixed(1)}s;--dx:${k % 2 ? 12 : -12}px` }, svg);
    const stage = days < 7 ? "A tiny sprout 🌱" : days < 30 ? "A young sapling" : days < 365 ? "Growing strong" : "A big happy tree";
    const nextWeek = 7 - (days % 7);
    cap.innerHTML = `${stage} ${EMO[season]}<small>A leaf for every week, a flower for every month. Next leaf in ${nextWeek} ${nextWeek === 1 ? "day" : "days"}`;
  }

  // Tap anywhere on the tree to release a floating heart
  svg.addEventListener("click", e => {
    const m = svg.getScreenCTM();
    if (!m) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    const gg = mk("g", { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(1.3)` }, svg);
    mk("path", { class: "tr-float", d: HEART }, gg);
    setTimeout(() => gg.remove(), 1600);
  });

  function update() {
    const days = parseInt(document.querySelector("[data-days]")?.textContent.replace(/\D/g, ""), 10);
    if (isNaN(days) || days === last) return;
    last = days;
    draw(days, parseInt(document.getElementById("s-months")?.textContent.replace(/\D/g, ""), 10) || 0);
  }

  const line = document.getElementById("since-line");
  if (line) new MutationObserver(update).observe(line, { childList: true, characterData: true, subtree: true });
  new MutationObserver(() => { last = -1; update(); }).observe(svg, { attributes: true, attributeFilter: ["data-season"] });
  update();
})();