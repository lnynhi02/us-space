
/* tree-sound.js — plays a different track for each season on the tree in the "Together" page.
   - Tracks live in assets/tree-sound/ : spring.mp3, summer.mp3, autumn.mp3, winter.mp3 (they loop).
   - Follows the same season as tree.js (data-season on #tree, or the device date).
   - Starts only after the user taps the speaker button (browsers block autoplay).
   - Only the current season's file is downloaded, and only once playing starts.
   - Fades in/out, crossfades when the season changes, pauses when you leave the Together page or the tab.
   Note: it has to be opened through a web server (http/https), not by double-clicking index.html. */
(() => {
  const svg = document.getElementById("tree");
  const card = svg && svg.closest(".tree-card");
  const section = document.getElementById("together");
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!svg || !card || !AC) return;

  const FILES = Object.assign({
    spring: "assets/tree-sound/spring.mp3",
    summer: "assets/tree-sound/summer.mp3",
    autumn: "assets/tree-sound/autumn.mp3",
    winter: "assets/tree-sound/winter.mp3"
  }, window.TREE_SOUND_SRC || {});
  const NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
  const K_ON = "us-tree-sound", K_VOL = "us-tree-vol";
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
  };

  // Same season rule as tree.js (Northern Hemisphere by device date; data-season overrides)
  const curSeason = () => {
    const s = svg.dataset.season; if (NAMES[s]) return s;
    const m = new Date().getMonth();
    return m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
  };

  let ctx, master, cur = null, offTimer = null;
  let on = store.get(K_ON) === "1";
  let vol = Math.min(1, Math.max(0, parseFloat(store.get(K_VOL) ?? ".6") || 0));
  let playing = false, season = curSeason();
  const tracks = {};

  function ensure() {
    if (ctx) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(ctx.destination);
  }

  // One looping <audio> per season, created the first time it is needed
  function track(s) {
    if (tracks[s]) return tracks[s];
    const el = new Audio();
    el.loop = true; el.preload = "none"; el.src = FILES[s];
    el.addEventListener("error", () => console.warn("tree-sound: cannot load", FILES[s]));
    const g = ctx.createGain(); g.gain.value = 0;
    ctx.createMediaElementSource(el).connect(g); g.connect(master);
    return (tracks[s] = { el, g, timer: null });
  }

  function enter(s, fade = 2.5) {
    const t = track(s), now = ctx.currentTime;
    clearTimeout(t.timer);
    t.g.gain.cancelScheduledValues(now);
    t.g.gain.setValueAtTime(t.g.gain.value, now);
    t.g.gain.linearRampToValueAtTime(1, now + fade);
    t.el.play().catch(() => {});
    cur = t;
  }

  function leave(t, fade) {
    const now = ctx.currentTime;
    t.g.gain.cancelScheduledValues(now);
    t.g.gain.setValueAtTime(t.g.gain.value, now);
    t.g.gain.linearRampToValueAtTime(0, now + fade);
    clearTimeout(t.timer);
    t.timer = setTimeout(() => { if (cur !== t) t.el.pause(); }, fade * 1000 + 100);
  }

  function setSeason(s) {
    if (s === season) return;
    season = s;
    if (playing) { const old = cur; enter(s, 3); old && leave(old, 3); }
    label();
  }

  function start() {
    ensure();
    clearTimeout(offTimer);
    ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(vol, ctx.currentTime, .3);
    season = curSeason();
    playing = true;
    enter(season);
    label();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    const t = cur; cur = null;
    t && leave(t, .8);
    offTimer = setTimeout(() => { if (!playing) ctx.suspend(); }, 1200);
  }

  // Plays only when: user turned it on + tab visible + Together page open
  function sync() {
    const want = on && !document.hidden && section && !section.hidden;
    if (want && !playing) start();
    else if (!want && playing) stop();
    else if (want && ctx && ctx.state !== "running") ctx.resume();
    if (want) setSeason(curSeason());
  }

  // A small chime when the tree is tapped (same tap that releases the heart)
  function chime() {
    const m = 74 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)], f = 440 * Math.pow(2, (m - 69) / 12), t = ctx.currentTime + .02;
    [[1, 1, 1], [2.76, .35, .6]].forEach(([k, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * k;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.06 * a, t + .004);
      g.gain.exponentialRampToValueAtTime(.0001, t + 2.2 * d);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 2.3 * d);
    });
  }

  /* --------------------------------- UI --------------------------------- */
  const st = document.createElement("style");
  st.textContent = `
.tree-card{position:relative}
.ts-bar{position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:8px;z-index:2}
.ts-btn{display:inline-flex;align-items:center;gap:6px;font:600 13px var(--sans,system-ui,sans-serif);color:var(--accent,#4F6B4A);
  background:var(--paper,#FBF9EE);border:1px solid var(--line,#D6D2B6);border-radius:999px;padding:6px 12px 6px 10px;cursor:pointer}
.ts-btn:hover{filter:brightness(1.04)}.ts-btn:active{transform:scale(.97)}
.ts-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ts-btn .w{display:none}.ts-btn[aria-pressed=true] .w{display:inline}.ts-btn[aria-pressed=true] .x{display:none}
.ts-vol{width:70px;accent-color:var(--accent,#4F6B4A);display:none}
.ts-btn[aria-pressed=true]+.ts-vol{display:block}`;
  document.head.appendChild(st);

  const bar = document.createElement("div"); bar.className = "ts-bar";
  bar.innerHTML = `<button class="ts-btn" type="button" aria-pressed="false">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path class="w" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/><path class="x" d="m16 9 5 6m0-6-5 6"/></svg>
    <span></span></button>
    <input class="ts-vol" type="range" min="0" max="100" aria-label="Volume">`;
  card.prepend(bar);
  const btn = bar.querySelector(".ts-btn"), txt = btn.querySelector("span"), range = bar.querySelector(".ts-vol");
  range.value = Math.round(vol * 100);

  function label() {
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    txt.textContent = on ? NAMES[season] : "Sound";
  }

  btn.addEventListener("click", () => { on = !on; store.set(K_ON, on ? "1" : "0"); label(); sync(); });
  range.addEventListener("input", () => {
    vol = range.value / 100; store.set(K_VOL, String(vol));
    if (master && playing) master.gain.setTargetAtTime(vol, ctx.currentTime, .1);
  });
  svg.addEventListener("click", () => { if (playing) chime(); });

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("hashchange", sync);
  if (section) new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(() => setSeason(curSeason())).observe(svg, { attributes: true, attributeFilter: ["data-season"] });

  // If sound was left on last time, browsers still need one tap before it can start
  if (on) {
    const arm = () => { sync(); if (playing) ["click", "touchend", "keydown"].forEach(e => document.removeEventListener(e, arm, true)); };
    ["click", "touchend", "keydown"].forEach(e => document.addEventListener(e, arm, true));
  }

  label();
  sync();
})();
