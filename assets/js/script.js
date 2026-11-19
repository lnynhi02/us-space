import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = import.meta.env || {};
const SITE_PASSWORD_HASH = env.VITE_SITE_PASSWORD_HASH || "";
const UNLOCK_KEY = "us-space-unlocked";
try { sessionStorage.removeItem(UNLOCK_KEY); } catch (e) {}
const PIN_BOXES = [...document.querySelectorAll(".pin-box")];
function pinValue() { return PIN_BOXES.map(box => box.dataset.digit || "").join(""); }
function clearPin() {
  PIN_BOXES.forEach(box => { box.value = ""; delete box.dataset.digit; });
  PIN_BOXES[0].focus();
}
function setPinDigit(box, digit) {
  box.dataset.digit = digit;
  box.value = digit ? "•" : "";
}
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;
function requireSupabase() {
  if (!supabase) throw new Error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  return supabase;
}
const SHARED = ["moments", "tasks", "hangouts"];

/* ===================================================
   1) SETTINGS: change your together date here.
   The day counter updates itself every second.
   =================================================== */
const START_DATE = "2026-10-23"; // format: YYYY-MM-DD

/* ===================================================
   2) STORAGE LAYER
   moments, tasks and docs (about/us) are shared via Supabase.
   moods stay in localStorage on this browser.
   =================================================== */
const DOC_TAG = "__doc__";
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
  async getDoc(key) {
    const cache = this._read("doc:" + key, {});
    try {
      const prefix = DOC_TAG + ":" + key + ":";
      const { data, error } = await requireSupabase().from("tasks")
        .select("id,text").eq("kind", "doc").like("text", prefix + "%");
      if (error) throw error;
      if (data && data.length) {
        const value = JSON.parse(String(data[0].text).slice(prefix.length));
        if (value && typeof value === "object") {
          this._write("doc:" + key, value);
          return value;
        }
      }
      if (cache && Object.keys(cache).length) await this.setDoc(key, cache);
      return cache;
    } catch (e) {
      return cache;
    }
  },
  async setDoc(key, value) {
    this._write("doc:" + key, value);
    const prefix = DOC_TAG + ":" + key + ":";
    const text = prefix + JSON.stringify(value);
    const sb = requireSupabase();
    const { data, error } = await sb.from("tasks")
      .select("id").eq("kind", "doc").like("text", prefix + "%");
    if (error) throw error;
    if (data && data.length) {
      const { error: updateError } = await sb.from("tasks")
        .update({ text, at: Date.now() }).eq("id", data[0].id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await sb.from("tasks")
        .insert({ kind: "doc", text, from: "", done: false, doneBy: "", at: Date.now() });
      if (insertError) throw insertError;
    }
  },
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
const MOOD_NAMES = ["happy", "loved", "tired", "worried", "annoyed", "sick"];
const PAGES = ["home", "about", "gallery", "notes", "together"];
let selfKey = null;
let allMoments = [], hangouts = [], calDay = null;
let photoPage = 1, lastPhotoPageSize = 0;
const calMonth = new Date(); calMonth.setDate(1);
localStorage.removeItem("person");

function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function dayDate(key) { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); }
function momentDay(m) { return m.day || dateKey(new Date(m.at)); } // old photos have no day: use the upload date
function fmtDate(t) {
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function notice(msg) { const n = $("notice"); n.textContent = msg; n.hidden = !msg; }
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
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
  document.querySelectorAll("#nav a").forEach(a => {
    const on = a.dataset.page === p;
    a.classList.toggle("on", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

/* ===================================================
   6) GALLERY
   =================================================== */
function photoCard(m, canDelete) {
  const f = el("figure", { className: "photo" });
  f.appendChild(el("img", { src: m.url, alt: m.caption || "Photo", loading: "lazy" }));
  const c = el("figcaption");
  const cap = el("div", { className: "photo-caption" }, m.caption || "");
  if (m.caption) cap.title = m.caption;
  c.appendChild(cap);
  c.appendChild(el("div", { className: "photo-date" }, fmtDate(m.day ? dayDate(m.day) : m.at)));
  c.appendChild(el("div", { className: "photo-who" }, displayName(m.author)));
  if (canDelete && selfKey && m.author === selfKey) {
    const d = el("button", { className: "link-btn", type: "button" }, "delete");
    d.onclick = async () => {
      if (!confirm("Delete this photo?")) return;
      try { await store.remove("moments", m.id); reloadPhotos(); }
      catch (e) { notice(e.message || "Couldn't delete photo."); }
    };
    const line = el("div", { className: "photo-actions" }); line.appendChild(d); c.appendChild(line);
  }
  f.appendChild(c);
  return f;
}
function photoPageSize() {
  if (window.matchMedia("(max-width: 520px)").matches) return 10;
  if (window.matchMedia("(max-width: 1200px)").matches) return 12;
  return 16;
}
function renderPhotoPager(pages) {
  const box = $("photo-pager"); box.textContent = "";
  if (pages <= 1) { box.hidden = true; return; }
  box.hidden = false;
  for (let p = 1; p <= pages; p++) {
    const b = el("button", { type: "button", className: p === photoPage ? "on" : "" }, String(p));
    b.setAttribute("aria-label", "Photo page " + p);
    if (p === photoPage) b.setAttribute("aria-current", "page");
    b.onclick = () => {
      if (photoPage === p) return;
      photoPage = p;
      renderPhotos();
    };
    box.appendChild(b);
  }
}
function renderPhotos() {
  const all = $("photos"); all.textContent = "";
  const size = photoPageSize();
  lastPhotoPageSize = size;
  if (!allMoments.length) {
    all.appendChild(el("p", { className: "empty" }, "No photos yet. Add your first one."));
    $("photo-pager").hidden = true;
    return;
  }
  const pages = Math.ceil(allMoments.length / size);
  if (photoPage > pages) photoPage = pages;
  const start = (photoPage - 1) * size;
  allMoments.slice(start, start + size).forEach(m => all.appendChild(photoCard(m, true)));
  renderPhotoPager(pages);
}
async function loadPhotos() {
  const list = await store.list("moments");
  allMoments = list; renderCalendar(); renderDay(); renderPhotos();
}

/* ===================================================
   6b) CALENDAR (ticks = days we hung out, marked by hand)
   =================================================== */
function reloadHangouts() { loadHangouts().catch(e => notice("Couldn't load calendar: " + (e.message || e))); }
async function loadHangouts() { hangouts = await store.list("hangouts"); renderCalendar(); renderDay(); }
function setGalleryTab(name) {
  const photos = name !== "cal";
  $("gtab-photos").classList.toggle("on", photos);
  $("gtab-cal").classList.toggle("on", !photos);
  $("gtab-photos").setAttribute("aria-selected", String(photos));
  $("gtab-cal").setAttribute("aria-selected", String(!photos));
  $("gpanel-photos").hidden = !photos;
  $("gpanel-cal").hidden = photos;
}
// Calendar marks: birthdays every year, and our anniversary once each year's date has passed.
const BIRTHDAYS = [
  { month: 8, day: 15, name: "Nhi" },   // 15/08
  { month: 10, day: 20, name: "Dun" }   // 20/10
];
function specialDay(key) {
  const [y, m, d] = key.split("-").map(Number), out = [];
  BIRTHDAYS.forEach(b => { if (b.month === m && b.day === d) out.push({ kind: "birthday", icon: "🎂🥳", label: b.name + "'s birthday" }); });
  const s = startDate(); // our first day, 23/10
  if (m === s.getMonth() + 1 && d === s.getDate() && y >= s.getFullYear() && key <= dateKey(new Date())) {
    const yrs = y - s.getFullYear();
    out.push({ kind: "anni", icon: "💞", label: yrs === 0 ? "Our first day" : yrs + (yrs === 1 ? " year" : " years") + " together" });
  }
  return out;
}
function renderCalendar() {
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  $("cal-title").textContent = calMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const hang = new Set(hangouts.map(h => h.day));
  const photoDays = new Set(allMoments.map(momentDay));
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday first
  const n = new Date(y, mo + 1, 0).getDate();
  const today = dateKey(new Date());
  const grid = $("cal"); grid.textContent = "";
  for (let i = 0; i < offset; i++) grid.appendChild(el("span"));
  let count = 0;
  for (let d = 1; d <= n; d++) {
    const key = y + "-" + pad(mo + 1) + "-" + pad(d);
    const on = hang.has(key); if (on) count++;
    const sp = specialDay(key);
    const kinds = new Set(sp.map(x => x.kind));
    const cls = ["cal-day"];
    if (on) cls.push("hang");
    if (kinds.has("birthday")) cls.push("birthday");
    if (kinds.has("anni")) cls.push("anni");
    if (key === today) cls.push("today");
    if (key === calDay) cls.push("sel");
    const b = el("button", { type: "button", className: cls.join(" ") });
    b.appendChild(el("span", {}, String(d)));
    if (sp.length) { b.appendChild(el("span", { className: "cal-mark", "aria-hidden": "true" }, sp.map(x => x.icon).join(""))); b.title = sp.map(x => x.label).join(", "); }
    if (on) b.appendChild(el("span", { className: "cal-heart" }, "♥"));
    else if (photoDays.has(key)) b.appendChild(el("span", { className: "cal-dot" }));
    b.setAttribute("aria-pressed", String(key === calDay));
    b.setAttribute("aria-label", dayDate(key).toLocaleDateString([], { month: "long", day: "numeric" }) + (on ? ", we hung out" : "") + (photoDays.has(key) ? ", has photos" : "") + (sp.length ? ", " + sp.map(x => x.label).join(", ") : ""));
    b.onclick = () => { calDay = key; renderCalendar(); renderDay(); };
    grid.appendChild(b);
  }
  $("cal-count").textContent = count ? count + (count === 1 ? " day" : " days") + " together this month ♥" : "No hangout days marked this month.";
}
function renderDay() {
  const box = $("cal-day"); box.textContent = "";
  if (!calDay) return;
  box.appendChild(el("h3", { className: "cal-day-title" }, dayDate(calDay).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })));
  specialDay(calDay).forEach(x => box.appendChild(el("p", { className: "lead" }, x.icon + " " + x.label)));
  const h = hangouts.find(x => x.day === calDay);
  const row = el("div", { className: "row" });
  const mark = el("button", { className: h ? "btn ghost" : "btn", type: "button" }, h ? "♥ We hung out (tap to undo)" : "♥ Mark as hangout day");
  mark.onclick = async () => {
    if (!requireIdentity()) return;
    try {
      if (h) await store.remove("hangouts", h.id);
      else await store.add("hangouts", { day: calDay, by: selfKey, at: Date.now() });
      reloadHangouts();
    } catch (e) { notice(e.message || "Couldn't update the calendar."); }
  };
  const add = el("button", { className: "btn ghost", type: "button" }, "Add photos for this day");
  add.onclick = () => { $("photo-day").value = calDay; setGalleryTab("photos"); $("caption").focus(); };
  row.append(mark, add);
  box.appendChild(row);
  const list = allMoments.filter(m => momentDay(m) === calDay);
  const grid = el("div", { className: "grid" });
  if (!list.length) grid.appendChild(el("p", { className: "empty" }, "No photos for this day yet."));
  list.forEach(m => grid.appendChild(photoCard(m, true)));
  box.appendChild(grid);
}

/* ===================================================
   7) NOTES
   =================================================== */
const noteKind = t => (t.kind === "message" ? "message" : t.kind === "bucket" ? "bucket" : t.kind === "doc" ? "doc" : "todo"); // old notes have no kind: they are to-dos
function setNoteTab(name) {
  const tabs = { todo: "todo", message: "msg", bucket: "bucket" };
  if (!tabs[name]) name = "todo";
  Object.entries(tabs).forEach(([k, id]) => {
    const on = k === name;
    $("tab-" + id).classList.toggle("on", on);
    $("tab-" + id).setAttribute("aria-selected", String(on));
    $("panel-" + id).hidden = !on;
  });
}
async function loadTasks() {
  const all = await store.list("tasks");
  renderTodos(all.filter(t => noteKind(t) === "todo").sort((a, b) => (!!a.done - !!b.done) || (b.at - a.at)));
  renderMessages(all.filter(t => noteKind(t) === "message").sort((a, b) => b.at - a.at));
  renderBucket(all.filter(t => noteKind(t) === "bucket").sort((a, b) => (!!a.done - !!b.done) || (b.at - a.at)));
}
function renderTodos(list) {
  const box = $("tasks"); box.textContent = "";
  if (!list.length) { box.appendChild(el("p", { className: "empty" }, "No to-dos yet.")); return; }
  list.forEach(t => {
    const row = el("div", { className: "task" + (t.done ? " done" : "") });
    const chk = el("button", { className: "check", type: "button", title: "Mark done" }, t.done ? "✓" : "");
    chk.setAttribute("aria-pressed", String(!!t.done));
    chk.onclick = async () => {
      if (!requireIdentity()) return;
      try {
        await store.update("tasks", t.id, { done: !t.done, doneBy: t.done ? "" : selfKey });
        reloadTasks();
      } catch (e) { notice(e.message || "Couldn't update to-do."); }
    };
    const body = el("div", { className: "task-body" });
    body.appendChild(el("div", { className: "task-text" }, t.text));
    body.appendChild(el("div", { className: "meta" },
      "From " + displayName(t.from) + " - " + fmtDate(t.at) + (t.done ? " ✓" : "")));
    if (selfKey && t.from === selfKey) {
      const d = el("button", { className: "link-btn", type: "button" }, "remove");
      d.style.paddingLeft = "0";
      d.onclick = async () => {
        try { await store.remove("tasks", t.id); reloadTasks(); }
        catch (e) { notice(e.message || "Couldn't remove to-do."); }
      };
      body.appendChild(d);
    }
    row.append(chk, body);
    box.appendChild(row);
  });
}
// Bucket list: same table as to-dos (kind "bucket"). Done items stay as memories.
function renderBucket(list) {
  const box = $("bucket"), prog = $("bucket-progress"); box.textContent = "";
  const done = list.filter(t => t.done).length;
  prog.textContent = list.length ? done + " of " + list.length + " done" : "";
  if (!list.length) { box.appendChild(el("p", { className: "empty" }, "Nothing here yet. Dream a little.")); return; }
  list.forEach(t => {
    const row = el("div", { className: "task bucket" + (t.done ? " done" : "") });
    const chk = el("button", { className: "check", type: "button", title: "We did it" }, t.done ? "✓" : "");
    chk.setAttribute("aria-pressed", String(!!t.done));
    chk.onclick = async () => {
      if (!requireIdentity()) return;
      try { await store.update("tasks", t.id, { done: !t.done, doneBy: t.done ? "" : selfKey }); reloadTasks(); }
      catch (e) { notice(e.message || "Couldn't update bucket list."); }
    };
    const body = el("div", { className: "task-body" });
    body.appendChild(el("div", { className: "task-text" }, t.text));
    body.appendChild(el("div", { className: "meta" },
      displayName(t.from) + "'s wish - " + fmtDate(t.at) + (t.done ? " ✓" : "")));
    if (selfKey && t.from === selfKey) {
      const d = el("button", { className: "link-btn", type: "button" }, "remove");
      d.style.paddingLeft = "0";
      d.onclick = async () => {
        try { await store.remove("tasks", t.id); reloadTasks(); }
        catch (e) { notice(e.message || "Couldn't remove item."); }
      };
      body.appendChild(d);
    }
    row.append(chk, body);
    box.appendChild(row);
  });
}
// Messages reuse done/doneBy as the heart: "done" = the other person tapped the heart.
function renderMessages(list) {
  const box = $("messages"); box.textContent = "";
  if (!list.length) { box.appendChild(el("p", { className: "empty" }, "No messages yet. Write the first one.")); return; }
  list.forEach(m => {
    const card = el("div", { className: "msg" });
    card.appendChild(el("div", { className: "msg-text" }, m.text));
    const foot = el("div", { className: "msg-foot" });
    foot.appendChild(el("span", { className: "meta" }, displayName(m.from) + " - " + fmtDate(m.at)));
    const mine = !!selfKey && m.from === selfKey;
    if (selfKey && !mine) {
      const h = el("button", { className: "heart" + (m.done ? " on" : ""), type: "button", title: m.done ? "Remove heart" : "I read this" }, "♥");
      h.setAttribute("aria-pressed", String(!!m.done));
      h.setAttribute("aria-label", "I read this");
      h.onclick = async () => {
        try { await store.update("tasks", m.id, { done: !m.done, doneBy: m.done ? "" : selfKey }); reloadTasks(); }
        catch (e) { notice(e.message || "Couldn't update message."); }
      };
      foot.appendChild(h);
    } else if (m.done) {
      foot.appendChild(el("span", { className: "meta" }, "♥ " + (m.doneBy ? displayName(m.doneBy) : "read")));
    }
    if (mine) {
      const d = el("button", { className: "link-btn", type: "button" }, "remove");
      d.onclick = async () => {
        try { await store.remove("tasks", m.id); reloadTasks(); }
        catch (e) { notice(e.message || "Couldn't remove message."); }
      };
      foot.appendChild(d);
    }
    card.appendChild(foot);
    box.appendChild(card);
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
        try {
          await store.setDoc("about", about);
          notice("");
          loadAbout();
        } catch (e) {
          notice("Saved on this device only: " + (e.message || e));
          loadAbout();
        }
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
    b.setAttribute("aria-label", "I feel " + (MOOD_NAMES[MOODS.indexOf(m)] || "something"));
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
let queuedPhotos = [];
let uploading = false;
const photoKey = f => f.name + ":" + f.size + ":" + f.lastModified;
function renderQueue() {
  const box = $("queue"); box.textContent = "";
  $("upload").disabled = uploading || !queuedPhotos.length;
  $("pick").disabled = uploading;
  queuedPhotos.forEach((item, index) => {
    const card = el("div", { className: "queue-item" });
    const img = el("img", { src: item.url, alt: item.file.name, loading: "lazy" });
    const name = el("div", { className: "meta queue-name" }, item.file.name);
    const remove = el("button", { className: "link-btn", type: "button" }, "remove");
    remove.onclick = () => {
      URL.revokeObjectURL(item.url);
      queuedPhotos.splice(index, 1);
      renderQueue();
      $("upload-msg").textContent = queuedPhotos.length ? queuedPhotos.length + " photo(s) ready to upload." : "";
    };
    card.append(img, name, remove);
    box.appendChild(card);
  });
}
$("pick").onclick = () => { if (requireIdentity()) $("file").click(); };
$("file").onchange = function () {
  const files = [...this.files].filter(f => f.type.startsWith("image/")); this.value = "";
  if (!files.length) { notice("Please choose image files."); return; }
  if (!requireIdentity()) return;
  notice("");
  const seen = new Set(queuedPhotos.map(x => photoKey(x.file)));
  files.forEach(file => {
    const key = photoKey(file);
    if (seen.has(key)) return;
    seen.add(key);
    queuedPhotos.push({ file, url: URL.createObjectURL(file) });
  });
  renderQueue();
  $("upload-msg").textContent = queuedPhotos.length + " photo(s) ready to upload.";
};
$("upload").onclick = async () => {
  if (!queuedPhotos.length || uploading) return;
  if (!requireIdentity()) return;
  const caption = $("caption").value.trim();
  const day = $("photo-day").value || dateKey(new Date());
  const batch = [...queuedPhotos];
  uploading = true; notice(""); renderQueue();
  let uploaded = 0;
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    $("upload-msg").textContent = "Uploading " + (i + 1) + " of " + batch.length + "…";
    try {
      const photo = await store.uploadPhoto(item.file);
      await store.add("moments", {
        author: selfKey,
        caption,
        url: photo.url,
        path: photo.path,
        day,
        at: Date.now()
      });
      const index = queuedPhotos.indexOf(item);
      if (index > -1) { URL.revokeObjectURL(item.url); queuedPhotos.splice(index, 1); }
      uploaded++;
      renderQueue();
    } catch (e) { notice(e.message || "Upload failed."); }
  }
  uploading = false; renderQueue();
  if (uploaded) {
    $("caption").value = "";
    $("photo-day").value = dateKey(new Date());
    reloadPhotos();
  }
  $("upload-msg").textContent = queuedPhotos.length
    ? uploaded + " uploaded, " + queuedPhotos.length + " failed. Try again or remove them."
    : (uploaded ? "Uploaded " + uploaded + " photo(s)." : "Nothing uploaded.");
};
$("task-add").onclick = async () => {
  const text = $("task-text").value.trim();
  if (!text || !requireIdentity()) return;
  try {
    await store.add("tasks", { text, kind: "todo", from: selfKey, done: false, doneBy: "", at: Date.now() });
    $("task-text").value = "";
    reloadTasks();
  } catch (e) { notice(e.message || "Couldn't add to-do."); }
};
$("task-text").addEventListener("keydown", e => { if (e.key === "Enter") $("task-add").click(); });
$("msg-add").onclick = async () => {
  const text = $("msg-text").value.trim();
  if (!text || !requireIdentity()) return;
  try {
    await store.add("tasks", { text, kind: "message", from: selfKey, done: false, doneBy: "", at: Date.now() });
    $("msg-text").value = "";
    reloadTasks();
  } catch (e) { notice(e.message || "Couldn't send message."); }
};
$("bucket-add").onclick = async () => {
  const text = $("bucket-text").value.trim();
  if (!text || !requireIdentity()) return;
  try {
    await store.add("tasks", { text, kind: "bucket", from: selfKey, done: false, doneBy: "", at: Date.now() });
    $("bucket-text").value = "";
    reloadTasks();
  } catch (e) { notice(e.message || "Couldn't add to bucket list."); }
};
$("bucket-text").addEventListener("keydown", e => { if (e.key === "Enter") $("bucket-add").click(); });
$("msg-text").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("msg-add").click(); });
$("gtab-photos").onclick = () => setGalleryTab("photos");
$("gtab-cal").onclick = () => setGalleryTab("cal");
$("cal-prev").onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); };
$("cal-next").onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); };
$("tab-todo").onclick = () => setNoteTab("todo");
$("tab-msg").onclick = () => setNoteTab("message");
$("tab-bucket").onclick = () => setNoteTab("bucket");
$("moodClear").onclick = async () => {
  const today = dateKey(new Date());
  const list = await store.list("moods");
  for (const m of list.filter(x => x.day === today)) await store.remove("moods", m.id);
  loadMoods();
};

$("selfNhi").onclick = () => setIdentity("a");
$("selfDun").onclick = () => setIdentity("b");

let started = false;
function startApp() {
  if (started) return;
  started = true;
  window.addEventListener("hashchange", route);
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (photoPageSize() !== lastPhotoPageSize) { photoPage = 1; renderPhotos(); }
    }, 150);
  });
  calDay = dateKey(new Date()); $("photo-day").value = calDay;
  route(); buildMoodButtons();
  tick(); setInterval(tick, 1000);
  reloadPhotos(); reloadTasks(); reloadHangouts(); loadAbout(); loadMoods();
}
function showGateError(message) {
  const error = $("gateError");
  error.textContent = message;
  error.hidden = false;
}
function unlock() {
  $("gate").hidden = true;
  $("gateError").hidden = true;
  startApp();
}
PIN_BOXES.forEach((box, i) => {
  box.addEventListener("input", () => {
    const digit = box.value.replace(/\D/g, "").slice(-1);
    setPinDigit(box, digit);
    $("gateError").hidden = true;
    if (digit && i < PIN_BOXES.length - 1) PIN_BOXES[i + 1].focus();
  });
  box.addEventListener("focus", () => box.select());
  box.addEventListener("keydown", event => {
    if (event.key === "Backspace" && !box.value && i > 0) {
      event.preventDefault();
      setPinDigit(PIN_BOXES[i - 1], "");
      PIN_BOXES[i - 1].focus();
    }
    if (event.key === "ArrowLeft" && i > 0) {
      event.preventDefault();
      PIN_BOXES[i - 1].focus();
    }
    if (event.key === "ArrowRight" && i < PIN_BOXES.length - 1) {
      event.preventDefault();
      PIN_BOXES[i + 1].focus();
    }
  });
  box.addEventListener("paste", event => {
    const text = (event.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
    if (!text) return;
    event.preventDefault();
    text.slice(0, PIN_BOXES.length - i).split("").forEach((digit, offset) => {
      setPinDigit(PIN_BOXES[i + offset], digit);
    });
    PIN_BOXES[Math.min(i + text.length, PIN_BOXES.length - 1)].focus();
  });
});
$("gateForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!SITE_PASSWORD_HASH) { showGateError("Password not configured."); return; }
  const pass = pinValue();
  if (pass.length !== PIN_BOXES.length) { showGateError("Enter 4 digits."); return; }
  try {
    if (await sha256(pass) === SITE_PASSWORD_HASH) unlock();
    else { showGateError("Wrong password."); clearPin(); }
  } catch (e) { showGateError("Could not check password."); }
});
setHello();
$("selfNhi").classList.toggle("on", selfKey === "a");
$("selfDun").classList.toggle("on", selfKey === "b");
PIN_BOXES[0].focus();