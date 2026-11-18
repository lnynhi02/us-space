/* ===================================================
   1) SETTINGS: change your together date here.
   The day counter updates itself every second.
   =================================================== */
const START_DATE = "2026-10-24"; // format: YYYY-MM-DD

/* ===================================================
   2) STORAGE LAYER
   For now this keeps data in this browser only (localStorage),
   so you and your partner will NOT see each other's data yet.
   When you add Supabase, replace the methods inside `store`
   and nothing else in this file needs to change.
   =================================================== */
const store = {
  _read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  },
  _write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
  async list(collection) { return this._read(collection, []); },
  async add(collection, item) {
    const all = this._read(collection, []);
    item.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    all.unshift(item);
    if (!this._write(collection, all)) throw new Error("Browser storage is full. Delete a photo first.");
    return item;
  },
  async update(collection, id, patch) {
    const all = this._read(collection, []).map(x => x.id === id ? { ...x, ...patch } : x);
    this._write(collection, all);
  },
  async remove(collection, id) {
    this._write(collection, this._read(collection, []).filter(x => x.id !== id));
  },
  async getDoc(key) { return this._read("doc:" + key, {}); },
  async setDoc(key, value) { this._write("doc:" + key, value); },
  // Returns a URL the <img> can show. With Supabase this becomes an upload to Storage.
  async uploadPhoto(file) { return shrinkImage(file, 900, 0.8); }
};

function shrinkImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}

/* ===================================================
   3) HELPERS
   =================================================== */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const MOODS = ["😊", "🥰", "😴", "😟", "😤", "🤒"];
const PAGES = ["home", "about", "gallery", "requests", "together"];
let me = localStorage.getItem("me") || "";

function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function fmtDate(t) {
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function notice(msg) { const n = $("notice"); n.textContent = msg; n.hidden = !msg; }
function el(tag, props = {}, text) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  if (text !== undefined) e.textContent = text; // textContent keeps typed text safe
  return e;
}
function setHello() { $("hello").textContent = me ? "Hello, " + me : "Welcome"; }
function ensureName() {
  if (me) return true;
  const n = (prompt("What’s your name?") || "").trim().slice(0, 30);
  if (!n) return false;
  me = n; localStorage.setItem("me", me); setHello();
  return true;
}

/* ===================================================
   4) DAY COUNTER (updates every second)
   =================================================== */
function startDate() {
  const [y, m, d] = START_DATE.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function tick() {
  const s = startDate(), now = new Date();
  const days = Math.max(Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
     Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())) / 864e5), 0);

  document.querySelectorAll("[data-days]").forEach(e => e.textContent = days.toLocaleString());
  const clock = pad(now.getHours()) + "h " + pad(now.getMinutes()) + "m " + pad(now.getSeconds()) + "s";
  document.querySelectorAll("[data-clock]").forEach(e => e.textContent = "+ " + clock);

  let years = now.getFullYear() - s.getFullYear();
  let months = now.getMonth() - s.getMonth();
  if (now.getDate() < s.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  years = Math.max(years, 0);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), s.getMonth(), s.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);

  $("s-years").textContent = years;
  $("s-months").textContent = Math.max(years * 12 + months, 0);
  $("s-weeks").textContent = Math.floor(days / 7).toLocaleString();
  $("s-next").textContent = Math.round((next - today) / 864e5);
  $("since-line").textContent = "Since " + s.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

/* ===================================================
   5) PAGES / ROUTING
   =================================================== */
function route() {
  let p = (location.hash || "#home").slice(1);
  if (!PAGES.includes(p)) p = "home";
  PAGES.forEach(id => { $(id).hidden = id !== p; });
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.page === p));
  window.scrollTo(0, 0);
}

/* ===================================================
   6) GALLERY
   =================================================== */
function photoCard(m, canDelete) {
  const f = el("figure", { className: "photo" });
  f.appendChild(el("img", { src: m.url, alt: m.caption || "Photo", loading: "lazy" }));
  const c = el("figcaption", {}, (m.caption ? m.caption + " — " : "") + m.author + ", " + fmtDate(m.at));
  if (canDelete && m.author === me) {
    const d = el("button", { className: "link-btn", type: "button" }, "delete");
    d.onclick = async () => { if (confirm("Delete this photo?")) { await store.remove("moments", m.id); loadPhotos(); } };
    c.appendChild(d);
  }
  f.appendChild(c);
  return f;
}
async function loadPhotos() {
  const list = await store.list("moments");
  const all = $("photos"), latest = $("latest");
  all.textContent = ""; latest.textContent = "";
  if (!list.length) {
    all.appendChild(el("p", { className: "empty" }, "No photos yet. Add your first one."));
    latest.appendChild(el("p", { className: "empty" }, "No photos yet. Add one in the Gallery."));
    return;
  }
  list.forEach(m => all.appendChild(photoCard(m, true)));
  list.slice(0, 3).forEach(m => latest.appendChild(photoCard(m, false)));
}

/* ===================================================
   7) REQUESTS
   =================================================== */
async function loadTasks() {
  const list = (await store.list("tasks")).sort((a, b) => (a.done - b.done) || (b.at - a.at));
  const box = $("tasks"); box.textContent = "";
  if (!list.length) { box.appendChild(el("p", { className: "empty" }, "No requests yet.")); return; }
  list.forEach(t => {
    const row = el("div", { className: "task" + (t.done ? " done" : "") });
    const chk = el("button", { className: "check", type: "button", title: "Mark done" }, t.done ? "✓" : "");
    chk.setAttribute("aria-pressed", String(!!t.done));
    chk.onclick = async () => {
      if (!ensureName()) return;
      await store.update("tasks", t.id, { done: !t.done, doneBy: t.done ? "" : me });
      loadTasks();
    };
    const body = el("div", { className: "task-body" });
    body.appendChild(el("div", { className: "task-text" }, t.text));
    body.appendChild(el("div", { className: "meta" },
      "From " + t.from + ", " + fmtDate(t.at) + (t.done ? " · done by " + (t.doneBy || "?") + " ✓" : "")));
    if (t.from === me) {
      const d = el("button", { className: "link-btn", type: "button" }, "remove");
      d.style.paddingLeft = "0";
      d.onclick = async () => { await store.remove("tasks", t.id); loadTasks(); };
      body.appendChild(d);
    }
    row.append(chk, body);
    box.appendChild(row);
  });
}

/* ===================================================
   8) ABOUT
   =================================================== */
async function loadAbout() {
  const about = await store.getDoc("about");
  const box = $("people"); box.textContent = "";
  ["a", "b"].forEach((key, i) => {
    const p = about[key] || {};
    const card = el("div", { className: "person" });
    card.appendChild(el("h3", {}, p.name || "Person " + (i + 1)));
    card.appendChild(el("p", {}, p.bio || "Tap Edit to write something about yourself."));
    const edit = el("button", { className: "btn ghost", type: "button" }, "Edit");
    edit.onclick = () => {
      card.textContent = "";
      const name = el("input", { type: "text", placeholder: "Name", value: p.name || "", maxLength: 40 });
      const bio = el("textarea", { rows: 5, placeholder: "A few words about you", value: p.bio || "", maxLength: 600 });
      const save = el("button", { className: "btn", type: "button" }, "Save");
      save.onclick = async () => {
        about[key] = { name: name.value.trim(), bio: bio.value.trim() };
        await store.setDoc("about", about);
        loadAbout();
      };
      const row = el("div", { className: "row" }); row.appendChild(save);
      card.append(name, bio, row);
    };
    card.appendChild(edit);
    box.appendChild(card);
  });
  const a = about.a && about.a.name, b = about.b && about.b.name;
  $("title").textContent = a && b ? a + " & " + b : "Our Little World";
}

/* ===================================================
   9) MOODS (a fresh list every day)
   =================================================== */
async function loadMoods() {
  const today = dateKey(new Date());
  const list = (await store.list("moods")).filter(m => m.day === today);
  const mine = list.find(m => m.name === me);
  document.querySelectorAll("#mood-buttons button").forEach(b =>
    b.setAttribute("aria-pressed", String(!!mine && mine.mood === b.textContent)));
  const box = $("mood-list"); box.textContent = "";
  list.forEach(m => box.appendChild(el("div", {}, m.name + " feels " + m.mood + " today")));
}
function buildMoodButtons() {
  MOODS.forEach(m => {
    const b = el("button", { type: "button", title: "I feel " + m }, m);
    b.onclick = async () => {
      if (!ensureName()) return;
      const today = dateKey(new Date());
      const existing = (await store.list("moods")).find(x => x.day === today && x.name === me);
      if (existing) await store.update("moods", existing.id, { mood: m });
      else await store.add("moods", { name: me, mood: m, day: today });
      loadMoods();
    };
    $("mood-buttons").appendChild(b);
  });
}

/* ===================================================
   10) BUTTONS + START
   =================================================== */
$("pick").onclick = () => { if (ensureName()) $("file").click(); };
$("file").onchange = async function () {
  const files = [...this.files]; this.value = "";
  const caption = $("caption").value.trim();
  notice("");
  for (let i = 0; i < files.length; i++) {
    $("upload-msg").textContent = "Uploading " + (i + 1) + " of " + files.length + "…";
    try {
      const url = await store.uploadPhoto(files[i]);
      await store.add("moments", { author: me, caption: i === 0 ? caption : "", url, at: Date.now() });
    } catch (e) { notice(e.message || "Upload failed."); }
  }
  $("caption").value = ""; $("upload-msg").textContent = "";
  loadPhotos();
};
$("task-add").onclick = async () => {
  const text = $("task-text").value.trim();
  if (!text || !ensureName()) return;
  await store.add("tasks", { text, from: me, done: false, doneBy: "", at: Date.now() });
  $("task-text").value = "";
  loadTasks();
};
$("task-text").addEventListener("keydown", e => { if (e.key === "Enter") $("task-add").click(); });

window.addEventListener("hashchange", route);
setHello(); route(); buildMoodButtons();
tick(); setInterval(tick, 1000);
loadPhotos(); loadTasks(); loadAbout(); loadMoods();
