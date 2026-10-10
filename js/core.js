'use strict';
/* =====================================================================
   Soirée: static, serverless invites. The invite is the link.
   ===================================================================== */

/* ---------- config ---------- */
const GATE_GUESTS = false;      // true = guests opening a shared link must also install on iOS
const PHOTO_BUDGET = 5000;      // bytes of photo allowed inside a link
const LINK_GOOD = 3500, LINK_OK = 9000;

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'value' || k === 'checked') n[k] = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; n.append(c.nodeType ? c : document.createTextNode(c)); }
  return n;
}
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5"/>',
  share: '<path d="M12 15V3.5M8 7l4-4 4 4"/><path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="3"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5a2 2 0 0 0 2 1.5h6a2 2 0 0 0 2-1.5L18 7M9 7V4.5h6V7"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="4"/><path d="M9.5 4.5v15"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 14h2.5v2.5H14zM18 18h2v2h-2zM14 19v1M20 14v2"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  nearby: '<path d="M5 11.5a10 10 0 0 1 14 0M8 14.8a5.5 5.5 0 0 1 8 0"/><circle cx="12" cy="18.5" r="1.2"/>',
  more: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v8a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 17V9M10 13h4"/>',
  template: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  inbox: '<path d="M4 13l2.5-7.5a2 2 0 0 1 1.9-1.5h7.2a2 2 0 0 1 1.9 1.5L20 13v4a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17z"/><path d="M4 13h4l1 2h6l1-2h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  wand: '<path d="M5 19L16 8"/><path d="M15 5l.8 2.2L18 8l-2.2.8L15 11l-.8-2.2L12 8l2.2-.8z"/><path d="M19 13l.5 1.5L21 15l-1.5.5L19 17l-.5-1.5L17 15l1.5-.5z"/>',
  file: '<path d="M7 3.5h6.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5"/><path d="M13 3.5V9h6"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M11 18.5h2"/>'
};
const ico = (n, s = 22) => el('span', { class: 'ico', html: `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${ICONS[n]}</svg>` });
const SPARK = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4-6.4-2.1 6.4-2.1z"/></svg>';

function toast(msg) {
  const t = el('div', { class: 'toast' }, msg); $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2200);
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch (e) {
    const t = el('textarea', { style: 'position:fixed;opacity:0' }); t.value = s; document.body.append(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} t.remove(); return ok;
  }
}
function seg(opts, val, cb, cls = '') {
  const idx = Math.max(0, opts.findIndex(o => o[0] === val));
  const root = el('div', { class: 'seg ' + cls, style: `--n:${opts.length};--i:${idx}`, role: 'tablist' }, el('span', { class: 'seg-thumb' }),
    opts.map(([v, label], i) => el('button', { type: 'button', class: 'seg-b' + (i === idx ? ' on' : ''), onclick: () => {
      root.style.setProperty('--i', i);
      root.querySelectorAll('.seg-b').forEach((b, j) => b.classList.toggle('on', j === i));
      cb(v, i);
    } }, label)));
  return root;
}
function toggle(on, cb) {
  const b = el('button', { type: 'button', class: 'sw', role: 'switch', 'aria-checked': String(!!on) });
  b.onclick = () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); cb(v); };
  return b;
}
function slider(label, min, max, step, val, fmt, cb) {
  const out = el('span', { class: 'val' }, fmt(val));
  const inp = el('input', { type: 'range', min, max, step, value: val, 'aria-label': label });
  inp.addEventListener('input', () => { const v = +inp.value; out.textContent = fmt(v); cb(v); });
  return el('div', { class: 'row col' }, el('div', { class: 'top' }, el('span', {}, label), out), inp);
}

/* ---------- settings ---------- */
const DEFAULTS = { theme: 'system', accent: '#0a84ff', name: '', presets: [],
  avatar: { kind: 'initials', emoji: '🙂', color: '#0a84ff', photo: '' },
  solid: false, motion: false, keepHQ: true, tilt: false, dev: false, devOverlay: false,
  ai: { autoDownload: true, wifiOnly: false, engine: 'auto' },
  ring: { on: true, style: 'rainbow', color: null, anim: true, w: 3, dy: 0, sc: 1 } };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const settings = (() => { let s = {}; try { s = JSON.parse(store.get('soiree.settings') || '{}'); } catch (e) {}
  return { ...DEFAULTS, ...s, ring: { ...DEFAULTS.ring, ...(s.ring || {}) }, avatar: { ...DEFAULTS.avatar, ...(s.avatar || {}) }, ai: { ...DEFAULTS.ai, ...(s.ai || {}) } }; })();
const saveSettings = () => store.set('soiree.settings', JSON.stringify(settings));
const mqDark = matchMedia('(prefers-color-scheme: dark)');
function lumOf(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16), f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f((n >> 16) & 255) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255);
}
function applyTheme() {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && mqDark.matches);
  const r = document.documentElement;
  r.dataset.theme = dark ? 'dark' : 'light';
  r.style.setProperty('--accent', settings.accent);
  r.style.setProperty('--on-accent', lumOf(settings.accent) > .5 ? '#000' : '#fff');
  r.dataset.solid = settings.solid ? '1' : '0'; r.dataset.motion = settings.motion ? 'reduce' : 'full';
  const m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#000000' : '#f2f2f7';
}
mqDark.addEventListener('change', applyTheme);

/* ---------- device ---------- */
const UA = navigator.userAgent;
const QS = new URLSearchParams(location.search);
const SIM = QS.get('sim');                     // ?sim=393x852 simulates a Dynamic Island screen on any device
const PREVIEW = QS.has('preview') || !!SIM;    // ?preview skips the iOS install gate (for testing)
const IPAD = /iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IPHONE = /iPhone|iPod/.test(UA);
const IOS = IPAD || IPHONE;
const STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const DEVICE = IPAD ? 'iPad' : IPHONE ? 'iPhone' : (/Android/.test(UA) ? 'Android' : 'Desktop browser');
if (IOS && STANDALONE) document.documentElement.classList.add('ios-app');
let deferredPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (!location.hash || location.hash === '#/') render(); });

/* Dynamic Island: no API exposes it, so match the screen size (CSS points, portrait) against known models. Values are approximate. */
const ISLANDS = {
  '393x852': { w: 126, h: 37, t: 11, name: 'iPhone 14 Pro, 15, 15 Pro or 16' },
  '430x932': { w: 126, h: 37, t: 11, name: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max or 16 Plus' },
  '402x874': { w: 125, h: 37, t: 14, name: 'iPhone 16 Pro or 17' },
  '440x956': { w: 125, h: 37, t: 14, name: 'iPhone 16 Pro Max or 17 Pro Max' },
  '420x912': { w: 125, h: 37, t: 14, name: 'iPhone Air' }
};
const screenKey = () => SIM || Math.min(screen.width, screen.height) + 'x' + Math.max(screen.width, screen.height);
const islandModel = () => ((IPHONE || SIM) ? ISLANDS[screenKey()] : null);

/* ---------- storage (IndexedDB, with in-memory fallback) ---------- */
function makeIDB() {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('soiree', 2);
    r.onupgradeneeded = () => { const d = r.result, mk = (n, k) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: k }); }; mk('events', 'id'); mk('received', 'id'); mk('replies', 'key'); mk('drafts', 'id'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (s, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(s, mode); const rq = fn(t.objectStore(s)); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
  return { all: s => tx(s, 'readonly', o => o.getAll()), get: (s, k) => tx(s, 'readonly', o => o.get(k)), put: (s, v) => tx(s, 'readwrite', o => o.put(v)), del: (s, k) => tx(s, 'readwrite', o => o.delete(k)), clear: s => tx(s, 'readwrite', o => o.clear()), probe: open };
}
function makeMem() {
  const m = { events: new Map(), received: new Map(), replies: new Map(), drafts: new Map() }, kp = { events: 'id', received: 'id', replies: 'key', drafts: 'id' };
  return { all: async s => [...m[s].values()], get: async (s, k) => m[s].get(k), put: async (s, v) => { m[s].set(v[kp[s]], v); }, del: async (s, k) => { m[s].delete(k); }, clear: async s => m[s].clear(), probe: async () => {}, mem: true };
}
let DB = makeIDB();
const normEvent = e => { if (!e) return e; e.bring = e.bring || []; e.qs = e.qs || []; e.cap = e.cap || 0; e.deadline = e.deadline || ''; e.music = e.music || ''; e.album = e.album || ''; e.geo = e.geo || null; e.archived = !!e.archived; if (e.theme) e.theme.pz = e.theme.pz || [1, 50, 50]; return e; };
async function initDB() {
  try { await DB.probe(); } catch (e) { console.warn('IndexedDB unavailable, using memory', e); DB = makeMem(); }
  const base = DB;
  DB = { ...base, mem: base.mem,
    all: async s => { const r = await base.all(s); if (s === 'events' || s === 'drafts') r.forEach(normEvent); else if (s === 'received') r.forEach(x => normEvent(x.ev)); return r; },
    get: async (s, k) => { const r = await base.get(s, k); if (r) { if (s === 'events' || s === 'drafts') normEvent(r); else if (s === 'received') normEvent(r.ev); } return r; } };
}

/* ---------- invite model ---------- */
const PRESETS = [
  { n: 'Sunset', c: ['#ff9a5a', '#ff5e7e', '#7b5cff'] }, { n: 'Lagoon', c: ['#2dd4bf', '#3b82f6', '#1e1b4b'] },
  { n: 'Orchid', c: ['#f0abfc', '#a78bfa', '#312e81'] }, { n: 'Citrus', c: ['#fde047', '#fb923c', '#f43f5e'] },
  { n: 'Meadow', c: ['#bef264', '#34d399', '#0f766e'] }, { n: 'Cotton', c: ['#fbcfe8', '#bae6fd', '#e9d5ff'] },
  { n: 'Midnight', c: ['#0f172a', '#4338ca', '#be185d'] }, { n: 'Peach', c: ['#fed7aa', '#fda4af', '#fcd34d'] },
  { n: 'Glacier', c: ['#e0f2fe', '#7dd3fc', '#6366f1'] }, { n: 'Cherry', c: ['#fb7185', '#be123c', '#4c0519'] },
  { n: 'Slate', c: ['#e2e8f0', '#94a3b8', '#334155'] }, { n: 'Aurora', c: ['#22d3ee', '#a3e635', '#c084fc'] }
];
const FONTS = {
  system: { n: 'Classic', ff: '-apple-system,"SF Pro Display",system-ui,sans-serif', fw: 800, ls: '-.035em', tt: 'none' },
  rounded: { n: 'Rounded', ff: 'ui-rounded,"SF Pro Rounded","Nunito",system-ui,sans-serif', fw: 800, ls: '-.02em', tt: 'none' },
  serif: { n: 'Serif', ff: 'ui-serif,"New York",Georgia,"Times New Roman",serif', fw: 700, ls: '-.02em', tt: 'none' },
  mono: { n: 'Mono', ff: 'ui-monospace,"SF Mono",Menlo,monospace', fw: 700, ls: '-.05em', tt: 'none' },
  poster: { n: 'Poster', ff: '-apple-system,"SF Pro Display","Helvetica Neue",system-ui,sans-serif', fw: 900, ls: '-.05em', tt: 'uppercase' }
};
const EMOJI = ['🎈', '🎉', '🎊', '🥳', '🎂', '🍰', '🍾', '🥂', '🍕', '🌮', '🍹', '🪩', '🎶', '🎤', '🕺', '💃', '🌴', '🔥', '✨', '💖', '🌈', '⭐', '🎁', '🦄'];
const toLocal = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function newEvent() {
  const d = new Date(); d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7)); d.setHours(19, 0, 0, 0);
  return { id: uid(), title: '', host: settings.name || '', reply: '', start: toLocal(d), end: '', loc: '', desc: '',
    bring: [], qs: [], cap: 0, deadline: '', music: '', album: '', geo: null, archived: false,
    theme: { k: 'mesh', c: [...PRESETS[0].c], a: 150, photo: '', url: '', avg: 0, b: 0, n: 0, f: 'system', tx: 'auto', fx: 'none', o: 32, lo: 'center', pz: [1, 50, 50] },
    stickers: [], created: Date.now(), shared: 0 };
}
function whenParts(ev) {
  if (!ev.start) return ['', ''];
  const d = new Date(ev.start), tf = { hour: 'numeric', minute: '2-digit' };
  let time = d.toLocaleTimeString(undefined, tf);
  if (ev.end) time += ' – ' + new Date(ev.end).toLocaleTimeString(undefined, tf);
  return [d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), time];
}
function until(s) {
  const ms = new Date(s) - Date.now(); if (!s || isNaN(ms)) return '';
  if (ms < 0) return ms > -6 * 3600e3 ? 'Happening now' : 'This event has passed';
  const m = Math.floor(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  if (d >= 1) return `In ${d} day${d > 1 ? 's' : ''}${d < 4 && h ? `, ${h} hr` : ''}`;
  if (h >= 1) return `In ${h} hr ${m % 60} min`;
  return `In ${m} min`;
}

/* ---------- link packing: JSON + raw photo bytes, deflated, base64url ---------- */
const b64e = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64d = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const pipe = async (bytes, tr) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(tr)).arrayBuffer());
const HAS_CS = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
async function packBin(obj, img = new Uint8Array(0)) {
  const jb = new TextEncoder().encode(JSON.stringify(obj)), all = new Uint8Array(4 + jb.length + img.length);
  new DataView(all.buffer).setUint32(0, jb.length); all.set(jb, 4); all.set(img, 4 + jb.length);
  return HAS_CS ? 'z' + b64e(await pipe(all, new CompressionStream('deflate-raw'))) : 'p' + b64e(all);
}
async function unpackBin(s) {
  let all = b64d(s.slice(1));
  if (s[0] === 'z') all = await pipe(all, new DecompressionStream('deflate-raw'));
  const n = new DataView(all.buffer, all.byteOffset).getUint32(0);
  return { obj: JSON.parse(new TextDecoder().decode(all.subarray(4, 4 + n))), img: all.subarray(4 + n) };
}
const D_WIRE = { x: 'auto', y: 'none', f: 'system', z: 'center', o: 32, a: 150, b: 0, n: 0, av: 0, cp: 0 };
function toWire(ev, hasImg) {
  const t = ev.theme;
  const w = { v: 1, i: ev.id, t: ev.title, h: ev.host, r: ev.reply, s: ev.start, e: ev.end, l: ev.loc, d: ev.desc, k: t.k, c: t.c.map(x => x.slice(1)), a: t.a, u: t.url, av: t.avg, b: t.b, n: t.n, f: t.f, x: t.tx, y: t.fx, o: t.o, z: t.lo,
    st: ev.stickers.map(s => [s.e, Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10, Math.round(s.s), Math.round(s.r)]),
    bl: ev.bring || [], qs: (ev.qs || []).map(q => q.q), cp: ev.cap || 0, dl: ev.deadline, mu: ev.music, al: ev.album, gp: ev.geo,
    pz: t.pz && (t.pz[0] !== 1 || t.pz[1] !== 50 || t.pz[2] !== 50) ? t.pz.map(v => Math.round(v * 100) / 100) : null };
  for (const k of Object.keys(w)) if (w[k] === '' || w[k] == null || (k in D_WIRE && w[k] === D_WIRE[k]) || ((k === 'st' || k === 'bl' || k === 'qs') && !w[k].length)) delete w[k];
  if (hasImg) w.pm = t.photo.startsWith('data:image/webp') ? 'w' : 'j';
  return w;
}
function fromWire(w, img) {
  const t = { k: w.k || 'mesh', c: (w.c || []).map(x => '#' + x), a: w.a ?? 150, photo: '', url: w.u || '', avg: w.av || 0, b: w.b || 0, n: w.n || 0, f: w.f || 'system', tx: w.x || 'auto', fx: w.y || 'none', o: w.o ?? 32, lo: w.z || 'center', pz: w.pz || [1, 50, 50] };
  while (t.c.length < 3) t.c.push('#888888');
  if (img && img.length) t.photo = `data:${w.pm === 'w' ? 'image/webp' : 'image/jpeg'};base64,` + btoa(Array.from(img, c => String.fromCharCode(c)).join(''));
  return { id: w.i, title: w.t || '', host: w.h || '', reply: w.r || '', start: w.s || '', end: w.e || '', loc: w.l || '', desc: w.d || '', theme: t,
    stickers: (w.st || []).map(a => ({ e: a[0], x: a[1], y: a[2], s: a[3], r: a[4] })), created: Date.now(), shared: 0,
    bring: w.bl || [], qs: (w.qs || []).map((q, i) => ({ id: i, q })), cap: w.cp || 0, deadline: w.dl || '', music: w.mu || '', album: w.al || '', geo: w.gp || null, archived: false };
}
const photoBytes = url => { const b = atob(url.slice(url.indexOf(',') + 1)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const baseUrl = () => location.origin + location.pathname;
async function buildLink(ev) {
  const img = ev.theme.photo ? photoBytes(ev.theme.photo) : undefined;
  return baseUrl() + '#/i=' + await packBin(toWire(ev, !!img), img);
}

/* ---------- photo squeeze: shrink until it fits the link budget ---------- */
const WEBP = (() => { try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch (e) { return false; } })();
async function compressImage(file, budget = PHOTO_BUDGET) {
  const bmp = await createImageBitmap(file), mime = WEBP ? 'image/webp' : 'image/jpeg';
  let best = null;
  const finish = (r) => {
    let avg = 0x555555;
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; avg = (d[0] << 16) | (d[1] << 8) | d[2]; } catch (e) {}
    return { ...r, avg, from: file.size, tooBig: r.bytes > budget };
  };
  for (const D of [420, 340, 280, 220, 180, 140, 110, 84, 64, 48]) {
    const sc = Math.min(1, D / Math.max(bmp.width, bmp.height)), w = Math.max(8, Math.round(bmp.width * sc)), h = Math.max(8, Math.round(bmp.height * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h);
    for (const q of [.7, .55, .42, .32, .22]) {
      const u = c.toDataURL(mime, q), bytes = Math.floor((u.length - u.indexOf(',') - 1) * 3 / 4);
      if (!best || bytes < best.bytes) best = { url: u, bytes, w, h };
      if (bytes <= budget) return finish({ url: u, bytes, w, h });
    }
  }
  return finish(best);
}


/* ---------- local full-quality photo + avatars ---------- */
const hqMap = new WeakMap();
const hqUrl = b => { if (!b) return ''; let u = hqMap.get(b); if (!u) { u = URL.createObjectURL(b); hqMap.set(b, u); } return u; };
async function makeHQ(file, max = 2048, q = .88) {
  const bmp = await createImageBitmap(file), sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q));
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = u => { const m = /^data:(.*?);base64,(.*)$/.exec(u); const b = atob(m[2]), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new Blob([a], { type: m[1] }); };
function avatarEl(size = 40, a = settings.avatar, name = settings.name) {
  const initials = (name || '').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '·';
  const n = el('span', { class: 'avatar', style: `width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px;background:${a.color}` });
  if (a.kind === 'photo' && a.photo) { n.style.background = `center/cover url("${a.photo}")`; }
  else if (a.kind === 'emoji') { n.textContent = a.emoji; n.style.fontSize = Math.round(size * .55) + 'px'; n.style.background = `color-mix(in srgb,${a.color} 26%,var(--surface))`; }
  else n.textContent = initials;
  return n;
}

/* ---------- poster rendering ---------- */
const meshCss = c => `radial-gradient(at 20% 15%,${c[0]} 0,transparent 55%),radial-gradient(at 85% 25%,${c[1]} 0,transparent 50%),radial-gradient(at 30% 92%,${c[2]} 0,transparent 55%),radial-gradient(at 92% 96%,${c[0]} 0,transparent 50%),${c[1]}`;
const linCss = (c, a) => `linear-gradient(${a}deg,${c[0]},${c[1]} 55%,${c[2]})`;
function inkFor(t) {
  if (t.tx === 'light' || t.tx === 'dark') return t.tx;
  let L = (t.k === 'photo' && (t.photo || t.url)) ? lumOf('#' + (t.avg || 0x555555).toString(16).padStart(6, '0')) : lumOf(t.c[0]) * .4 + lumOf(t.c[1]) * .35 + lumOf(t.c[2]) * .25;
  L = t.n >= 0 ? L * (1 - t.n / 100) : L + (1 - L) * (-t.n / 100);
  return L > .36 ? 'dark' : 'light';
}
function makeFx(canvas) {
  const ctx = canvas.getContext('2d'), W = canvas.width = 720, H = canvas.height = 960, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, kind = 'none', parts = [], cols = ['#fff'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn(initial) {
    if (kind === 'confetti') return { x: rnd(0, W), y: initial ? rnd(-H, H) : rnd(-80, -10), w: rnd(10, 20), h: rnd(16, 30), a: rnd(0, 6.28), va: rnd(-.08, .08), vy: rnd(2.2, 4.6), sw: rnd(0, 6.28), c: cols[Math.floor(rnd(0, cols.length))] };
    return { x: rnd(0, W), y: initial ? rnd(-H, H) : rnd(-20, -5), r: rnd(3, 9), vy: rnd(.9, 2.4), sw: rnd(0, 6.28) };
  }
  function frame() {
    if (!canvas.isConnected) { raf = 0; return; }
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y += p.vy; p.sw += .03; p.x += Math.sin(p.sw) * (kind === 'snow' ? .8 : 1.2);
      if (kind === 'confetti') { p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.sw))); ctx.restore(); }
      else { ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); }
      if (p.y > H + 40) Object.assign(p, spawn(false));
    }
    if (!still) raf = requestAnimationFrame(frame); else raf = 0;
  }
  return { set(k, c) {
    cols = [...c, '#ffffff', '#ffd60a'];
    if (k === kind) return;
    kind = k; cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, W, H); parts = [];
    if (k === 'confetti' || k === 'snow') { for (let i = 0; i < (k === 'snow' ? 70 : 55); i++) parts.push(spawn(true)); raf = requestAnimationFrame(frame); }
  } };
}
function buildPoster() {
  const canvas = el('canvas', { class: 'p-fx', width: 720, height: 960 });
  const P = { bg: el('div', { class: 'p-bg' }), sharp: el('img', { class: 'p-sharp', alt: '', decoding: 'async' }), tint: el('div', { class: 'p-tint' }), shim: el('div', { class: 'p-shim' }), canvas,
    title: el('h2', { class: 'p-title' }), when: el('p', { class: 'p-when' }), host: el('p', { class: 'p-host' }), loc: el('p', { class: 'p-loc' }), desc: el('p', { class: 'p-desc' }), stk: el('div', { class: 'p-stk' }), fx: null };
  P.content = el('div', { class: 'p-content' }, P.title, P.when, P.loc, P.host, P.desc);
  P.poster = el('div', { class: 'poster' }, P.bg, P.sharp, P.tint, P.shim, canvas, P.content, P.stk);
  P.wrap = el('div', { class: 'pw' }, P.poster);
  P.sharp.addEventListener('load', () => P.sharp.classList.add('on'));
  P.sharp.addEventListener('error', () => { P.sharp.classList.remove('on'); P.sharp.removeAttribute('src'); P.sharp.dataset.src = ''; });
  return P;
}
function paint(P, ev, o = {}) {
  const t = ev.theme, p = P.poster, f = FONTS[t.f] || FONTS.system;
  p.className = 'poster lo-' + t.lo + (o.mini ? ' mini' : '') + (t.fx === 'shimmer' && !o.mini ? ' shim' : '');
  p.style.setProperty('--c', (t.o / 3.6).toFixed(2));
  p.style.setProperty('--ff', f.ff); p.style.setProperty('--fw', f.fw); p.style.setProperty('--ls', f.ls); p.style.setProperty('--tt', f.tt);
  p.dataset.ink = inkFor(t);
  const psrc = t.k === 'photo' ? (t.hq ? hqUrl(t.hq) : t.photo) : '', pz = t.pz || [1, 50, 50];
  if (psrc) { P.bg.style.background = ''; P.bg.style.backgroundImage = `url("${psrc}")`; P.bg.style.backgroundPosition = `${pz[1]}% ${pz[2]}%`; } else P.bg.style.background = t.k === 'linear' ? linCss(t.c, t.a) : meshCss(t.c);
  P.bg.style.transformOrigin = P.sharp.style.transformOrigin = `${pz[1]}% ${pz[2]}%`; P.sharp.style.objectPosition = `${pz[1]}% ${pz[2]}%`;
  const bs = (1 + t.b / 90) * (psrc ? pz[0] : 1); p.style.setProperty('--bs', bs.toFixed(3));
  P.bg.style.filter = P.sharp.style.filter = t.b ? `blur(calc(${t.b} * .2778cqw))` : '';
  const url = t.k === 'photo' ? t.url : '';
  if ((P.sharp.dataset.src || '') !== url) { P.sharp.classList.remove('on'); P.sharp.dataset.src = url; if (url) P.sharp.src = url; else P.sharp.removeAttribute('src'); }
  P.tint.style.background = t.n >= 0 ? `rgba(0,0,0,${t.n / 100})` : `rgba(255,255,255,${-t.n / 100})`;
  const [date, time] = whenParts(ev);
  P.title.textContent = ev.title || (o.mini ? 'Untitled' : 'Event title');
  P.title.classList.toggle('ph', !ev.title);
  P.when.textContent = date ? date + (time ? '\n' + time : '') : '';
  P.loc.textContent = ev.loc || ''; P.host.textContent = ev.host ? 'Hosted by ' + ev.host : ''; P.desc.textContent = ev.desc || '';
  P.stk.replaceChildren(...ev.stickers.map((s, i) => el('span', { class: 'stk' + (o.sel === i ? ' sel' : ''), 'data-i': i, style: `left:${s.x}%;top:${s.y}%;--s:${s.s};--r:${s.r}deg` }, s.e)));
  if (o.live) { P.fx = P.fx || makeFx(P.canvas); P.fx.set(t.fx, t.c); }
}
const mkPoster = (ev, o) => { const P = buildPoster(); paint(P, ev, o); return P; };

/* ---------- Dynamic Island ring ---------- */
const RING_STOPS = { rainbow: '#ff3b30,#ff9500,#ffcc00,#34c759,#5ac8fa,#007aff,#af52de,#ff2d55,#ff3b30', aurora: '#64d2ff,#bf5af2,#ff6482,#ffd60a,#64d2ff' };
function ringGradient(r) {
  const c = r.color || settings.accent;
  return r.style === 'color' ? `conic-gradient(from var(--ang),${c},${c})` : `conic-gradient(from var(--ang),${RING_STOPS[r.style] || RING_STOPS.rainbow})`;
}
function ringNode(r, w, h, rw) {
  const cls = r.anim ? (r.style === 'color' ? 'pulse' : 'spin') : '';
  return el('div', { class: 'island', style: `width:${w + 2 * rw - 2}px;height:${h + 2 * rw - 2}px;margin-left:${-(w + 2 * rw - 2) / 2}px` },
    el('div', { class: 'ring ' + cls, style: `--rw:${rw}px;background:${ringGradient(r)}` }));
}
function applyRing() {
  $('#island-real')?.remove();
  const m = islandModel(), r = settings.ring;
  if (!m || !r.on || !(STANDALONE || SIM) || !matchMedia('(orientation: portrait)').matches) return;
  const w = m.w * r.sc, h = m.h * r.sc, n = ringNode(r, w, h, r.w);
  n.id = 'island-real'; n.style.top = (m.t + r.dy - r.w + 1 - (h - m.h) / 2) + 'px';
  document.body.append(n);
}
matchMedia('(orientation: portrait)').addEventListener('change', applyRing);

/* ---------- calendar + sharing ---------- */
function icsFor(ev) {
  const dt = s => s.replace(/[-:]/g, '') + '00', esc = t => (t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const end = ev.end || toLocal(new Date(new Date(ev.start).getTime() + 2 * 3600e3));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Soiree//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${ev.id}@soiree`,
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z', 'DTSTART:' + dt(ev.start), 'DTEND:' + dt(end),
    'SUMMARY:' + esc(ev.title || 'Event'), 'LOCATION:' + esc(ev.loc), 'DESCRIPTION:' + esc((ev.desc || '') + (ev.host ? `\nHosted by ${ev.host}` : '')),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Tomorrow', 'END:VALARM', 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Starting soon', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
async function saveBlob(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = el('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const addToCalendar = ev => { if (!ev.start) return toast('Add a date first'); saveBlob((ev.title || 'event').replace(/[^\w-]+/g, '-') + '.ics', icsFor(ev), 'text/calendar'); };
async function shareLink(ev) {
  const link = await buildLink(ev);
  if (navigator.share) { try { await navigator.share({ title: ev.title || 'Invite', text: `You’re invited to ${ev.title || 'my event'}`, url: link }); return true; } catch (e) { if (e.name === 'AbortError') return false; } }
  await copyText(link); toast('Link copied'); return true;
}

