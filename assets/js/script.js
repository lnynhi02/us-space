import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = import.meta.env || {};
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;
function requireSupabase() {
  if (!supabase) throw new Error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  return supabase;
}
const SHARED = ["moments", "tasks"];

/* ===================================================
   1) SETTINGS: change your together date here.
   The day counter updates itself every second.
   =================================================== */
const START_DATE = "2026-10-23"; // format: YYYY-MM-DD

/* ===================================================
   2) STORAGE LAYER
   moments + tasks are shared via Supabase. moods and docs
   (about/us) stay in localStorage on this browser.
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
  async list(collection) {
    if (!SHARED.includes(collection)) return this._read(collection, []);
    const { data, error } = await requireSupabase().from(collection).select("*").order("at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async add(collection, item) {
    if (!SHARED.includes(collection)) {
      const all = this._read(collection, []);
      item.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
      all.unshift(item);
      if (!this._write(collection, all)) throw new Error("Browser storage is full. Delete a photo first.");
      return item;
    }
    const { data, error } = await requireSupabase().from(collection).insert(item).select().single();
    if (error) throw error;
    return data;
  },
  async update(collection, id, patch) {
    if (!SHARED.includes(collection)) {
      const all = this._read(collection, []).map(x => x.id === id ? { ...x, ...patch } : x);
      this._write(collection, all);
      return;
    }
    const { error } = await requireSupabase().from(collection).update(patch).eq("id", id);
    if (error) throw error;
  },
  async remove(collection, id) {
    if (!SHARED.includes(collection)) {
      this._write(collection, this._read(collection, []).filter(x => x.id !== id));
      return;
    }
    if (collection === "moments") {
      const { data: row } = await requireSupabase().from("moments").select("path").eq("id", id).maybeSingle();
      if (row && row.path) await requireSupabase().storage.from("photos").remove([row.path]);
    }
    const { error } = await requireSupabase().from(collection).delete().eq("id", id);
    if (error) throw error;
  },
  async getDoc(key) { return this._read("doc:" + key, {}); },
  async setDoc(key, value) { this._write("doc:" + key, value); },
  async uploadPhoto(file) {
    const blob = await shrinkImageBlob(file, 900, 0.8);
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
    const path = id + ".jpg";
    const { error } = await requireSupabase().storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data } = requireSupabase().storage.from("photos").getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
};

function shrinkImageBlob(file, maxSize, quality) {
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
      c.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not read that image.")), "image/jpeg", quality);
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
let selfKey = null;
localStorage.removeItem("person");

function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function fmtDate(t) {
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function notice(msg) { const n = $("notice"); n.textContent = msg; n.hidden = !msg; }
function reloadPhotos() { loadPhotos().catch(e => notice("Couldn't load photos: " + (e.message || e))); }
function reloadTasks() { loadTasks().catch(e => notice("Couldn't load notes: " + (e.message || e))); }
function el(tag, props = {}, text) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  if (text !== undefined) e.textContent = text; // textContent keeps typed text safe
  return e;
}
function displayName(key) {
  if (key === "a") return "Nhi";
  if (key === "b") return "Dun";
  return "Someone";
}
function setHello() { $("hello").textContent = "Welcome"; }
function requireIdentity() {
  if (selfKey) return true;
  notice("Choose Nhi or Dun first.");
  return false;
}
function setIdentity(key) {
  selfKey = key;
  $("selfNhi").classList.toggle("on", key === "a");
  $("selfDun").classList.toggle("on", key === "b");
  setHello();
  notice("");
  reloadPhotos(); reloadTasks(); loadMoods();
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

  let years = now.getFullYear() - s.getFullYear();
  let months = now.getMonth() - s.getMonth();
  if (now.getDate() < s.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  years = Math.max(years, 0);

  $("s-years").textContent = years;
  $("s-months").textContent = Math.max(years * 12 + months, 0);
  $("s-weeks").textContent = Math.floor(days / 7).toLocaleString();
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
  const c = el("figcaption");
  c.appendChild(el("div", {}, (m.caption ? m.caption + " — " : "") + displayName(m.author)));
  c.appendChild(el("div", {}, fmtDate(m.at)));
  if (canDelete && selfKey && m.author === selfKey) {
    const d = el("button", { className: "link-btn", type: "button" }, "delete");
    d.onclick = async () => {
      if (!confirm("Delete this photo?")) return;
      try { await store.remove("moments", m.id); reloadPhotos(); }
      catch (e) { notice(e.message || "Couldn't delete photo."); }
    };
    const line = el("div"); line.appendChild(d); c.appendChild(line);
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
   7) NOTES
   =================================================== */
async function loadTasks() {
  const list = (await store.list("tasks")).sort((a, b) => (a.done - b.done) || (b.at - a.at));
  const box = $("tasks"); box.textContent = "";
  if (!list.length) { box.appendChild(el("p", { className: "empty" }, "No notes yet.")); return; }
  list.forEach(t => {
    const row = el("div", { className: "task" + (t.done ? " done" : "") });
    const chk = el("button", { className: "check", type: "button", title: "Mark done" }, t.done ? "✓" : "");
    chk.setAttribute("aria-pressed", String(!!t.done));
    chk.onclick = async () => {
      if (!requireIdentity()) return;
      try {
        await store.update("tasks", t.id, { done: !t.done, doneBy: t.done ? "" : selfKey });
        reloadTasks();
      } catch (e) { notice(e.message || "Couldn't update note."); }
    };
    const body = el("div", { className: "task-body" });
    body.appendChild(el("div", { className: "task-text" }, t.text));
    body.appendChild(el("div", { className: "meta" },
      "From " + displayName(t.from) + " - " + fmtDate(t.at) + (t.done ? " · done by " + (t.doneBy ? displayName(t.doneBy) : "?") + " ✓" : "")));
    if (selfKey && t.from === selfKey) {
      const d = el("button", { className: "link-btn", type: "button" }, "remove");
      d.style.paddingLeft = "0";
      d.onclick = async () => {
        try { await store.remove("tasks", t.id); reloadTasks(); }
        catch (e) { notice(e.message || "Couldn't remove note."); }
      };
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
  $("title").textContent = a && b ? a + " & " + b : "Our Space";
}

/* ===================================================
   9) MOODS (a fresh list every day)
   =================================================== */
async function loadMoods() {
  const today = dateKey(new Date());
  const list = (await store.list("moods")).filter(m => m.day === today);
  const mine = selfKey ? list.find(m => m.name === selfKey) : null;
  document.querySelectorAll("#mood-buttons button").forEach(b =>
    b.setAttribute("aria-pressed", String(!!mine && mine.mood === b.textContent)));
  const box = $("mood-list"); box.textContent = "";
  list.forEach(m => box.appendChild(el("div", {}, displayName(m.name) + " feels " + m.mood + " today")));
}
function buildMoodButtons() {
  MOODS.forEach(m => {
    const b = el("button", { type: "button", title: "I feel " + m }, m);
    b.onclick = async () => {
      if (!requireIdentity()) return;
      const today = dateKey(new Date());
      const existing = (await store.list("moods")).find(x => x.day === today && x.name === selfKey);
      if (existing) await store.update("moods", existing.id, { mood: m });
      else await store.add("moods", { name: selfKey, mood: m, day: today });
      loadMoods();
    };
    $("mood-buttons").appendChild(b);
  });
}

/* ===================================================
   10) BUTTONS + START
   =================================================== */
$("pick").onclick = () => { if (requireIdentity()) $("file").click(); };
$("file").onchange = async function () {
  const files = [...this.files]; this.value = "";
  if (!files.length) return;
  if (!requireIdentity()) return;
  const caption = $("caption").value.trim();
  notice("");
  for (let i = 0; i < files.length; i++) {
    $("upload-msg").textContent = "Uploading " + (i + 1) + " of " + files.length + "…";
    try {
      const photo = await store.uploadPhoto(files[i]);
      await store.add("moments", { author: selfKey, caption: i === 0 ? caption : "", url: photo.url, path: photo.path, at: Date.now() });
    } catch (e) { notice(e.message || "Upload failed."); }
  }
  $("caption").value = ""; $("upload-msg").textContent = "";
  reloadPhotos();
};
$("task-add").onclick = async () => {
  const text = $("task-text").value.trim();
  if (!text || !requireIdentity()) return;
  try {
    await store.add("tasks", { text, from: selfKey, done: false, doneBy: "", at: Date.now() });
    $("task-text").value = "";
    reloadTasks();
  } catch (e) { notice(e.message || "Couldn't send note."); }
};
$("task-text").addEventListener("keydown", e => { if (e.key === "Enter") $("task-add").click(); });
$("moodClear").onclick = async () => {
  const today = dateKey(new Date());
  const list = await store.list("moods");
  for (const m of list.filter(x => x.day === today)) await store.remove("moods", m.id);
  loadMoods();
};

$("selfNhi").onclick = () => setIdentity("a");
$("selfDun").onclick = () => setIdentity("b");

window.addEventListener("hashchange", route);
setHello();
$("selfNhi").classList.toggle("on", selfKey === "a");
$("selfDun").classList.toggle("on", selfKey === "b");
route(); buildMoodButtons();
tick(); setInterval(tick, 1000);
reloadPhotos(); reloadTasks(); loadAbout(); loadMoods();
