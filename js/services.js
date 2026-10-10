'use strict';
/* Optional extras that use free public services. Everything here fails quietly
   when offline: the invite still works, the extra card just doesn't appear. */
const OFFLINE = () => navigator.onLine === false;
const cacheGet = (k, ttl) => { try { const v = JSON.parse(localStorage.getItem('soiree.c.' + k) || 'null'); if (v && Date.now() - v.t < ttl) return v.d; } catch (e) {} return null; };
const cacheSet = (k, d) => { try { localStorage.setItem('soiree.c.' + k, JSON.stringify({ t: Date.now(), d })); } catch (e) {} };
async function fetchJSON(url, ms = 6000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); }
}

/* ---- geocoding (OpenStreetMap Nominatim; light use, results cached) ---- */
async function geocode(q) {
  q = (q || '').trim(); if (!q || OFFLINE()) return null;
  const k = 'geo:' + q.toLowerCase(), c = cacheGet(k, 30 * 864e5); if (c) return c;
  try {
    const r = await fetchJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q));
    if (r && r[0]) { const g = [+(+r[0].lat).toFixed(5), +(+r[0].lon).toFixed(5)]; cacheSet(k, g); return g; }
  } catch (e) {}
  return null;
}
async function geocodeLoose(q) {
  const parts = (q || '').split(',').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(parts.length, 3); i++) { const g = await geocode(parts.slice(i).join(', ')); if (g) return g; }
  return null;
}

/* ---- weather (Open-Meteo, no key) ---- */
const WX = { 0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Cloudy'], 45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'],
  51: ['🌦️', 'Drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Drizzle'], 61: ['🌧️', 'Rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Heavy showers'], 95: ['⛈️', 'Thunderstorms'], 96: ['⛈️', 'Thunderstorms'], 99: ['⛈️', 'Thunderstorms'] };
const useFahrenheit = () => /^en-(US|LR)|^en$/.test(navigator.language || '') && !/^en-(GB|AU|CA|NZ|IE|IN)/.test(navigator.language || '');
async function getWeather(ev) {
  if (!ev.geo || !ev.start || OFFLINE()) return null;
  const days = (new Date(ev.start) - Date.now()) / 864e5; if (days < -1 || days > 15) return null;
  const date = ev.start.slice(0, 10), f = useFahrenheit(), k = `wx:${ev.geo}:${date}:${f}`, c = cacheGet(k, 3600e3); if (c) return c;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${ev.geo[0]}&longitude=${ev.geo[1]}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}&temperature_unit=${f ? 'fahrenheit' : 'celsius'}`;
    const d = (await fetchJSON(u)).daily; if (!d || !d.time || !d.time.length) return null;
    const w = WX[d.weather_code[0]] || ['🌡️', 'Forecast'], r = { icon: w[0], label: w[1], hi: Math.round(d.temperature_2m_max[0]), lo: Math.round(d.temperature_2m_min[0]), pop: d.precipitation_probability_max[0], unit: f ? '°F' : '°C' };
    cacheSet(k, r); return r;
  } catch (e) { return null; }
}
function weatherPill(ev) {
  const pill = el('span', { class: 'wx', hidden: true });
  getWeather(ev).then(w => {
    if (!w) return;
    pill.textContent = `${w.icon} ${w.hi}${w.unit} / ${w.lo}${w.unit}` + (w.pop >= 30 ? ` · ${w.pop}% rain` : ''); pill.title = w.label; pill.hidden = false;
  });
  return pill;
}

/* ---- map card (OpenStreetMap tiles) ---- */
function tileMap(lat, lon, z = 15) {
  const n = 2 ** z, x = (lon + 180) / 360 * n, lr = lat * Math.PI / 180, y = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n;
  const tx = Math.floor(x), ty = Math.floor(y), fx = x - tx, fy = y - ty;
  const grid = el('div', { class: 'tiles', style: `left:calc(50% - ${(1 + fx) * 256}px);top:calc(50% - ${(1 + fy) * 256}px)` });
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) grid.append(el('img', { src: `https://tile.openstreetmap.org/${z}/${tx + i}/${ty + j}.png`, alt: '', width: 256, height: 256, loading: 'lazy', decoding: 'async' }));
  return el('div', { class: 'tilemap' }, grid, el('span', { class: 'pin', html: '<svg viewBox="0 0 24 34" width="30" height="42"><path d="M12 1C6 1 1.5 5.5 1.5 11.3 1.5 19 12 33 12 33s10.5-14 10.5-21.7C22.5 5.5 18 1 12 1z" fill="var(--accent)" stroke="#fff" stroke-width="2"/><circle cx="12" cy="11.3" r="4" fill="#fff"/></svg>' }),
    el('span', { class: 'attr' }, '© OpenStreetMap'));
}

/* ---- playlist embeds ---- */
function musicEmbed(url) {
  try {
    const u = new URL(url), path = u.pathname.replace(/^\/intl-[a-z-]+/i, '');
    if (/(^|\.)open\.spotify\.com$/.test(u.hostname)) return { kind: 'Spotify', src: 'https://open.spotify.com/embed' + path + '?utm_source=generator', h: /\/(track|episode)\//.test(path) ? 152 : 352 };
    if (/(^|\.)music\.apple\.com$/.test(u.hostname)) return { kind: 'Apple Music', src: 'https://embed.music.apple.com' + u.pathname + u.search, h: /\/song\//.test(u.pathname) ? 175 : 450 };
  } catch (e) {}
  return null;
}

/* ---- extra cards under the invite: map, playlist, album ---- */
function extraCards(ev) {
  const cards = [], mapsUrl = ev.loc ? 'https://maps.apple.com/?q=' + encodeURIComponent(ev.loc) : '';
  if (ev.geo && !OFFLINE()) cards.push(el('div', { class: 'xcard' }, el('div', { class: 'xhead' }, ico('pin', 18), 'Map'),
    el('a', { href: mapsUrl || `https://maps.apple.com/?ll=${ev.geo[0]},${ev.geo[1]}`, target: '_blank', rel: 'noopener', 'aria-label': 'Open in Maps' }, tileMap(ev.geo[0], ev.geo[1]))));
  const m = ev.music && musicEmbed(ev.music);
  if (m) cards.push(el('div', { class: 'xcard' }, el('div', { class: 'xhead' }, ico('music', 18), 'Playlist'),
    OFFLINE() ? el('a', { class: 'btn sec block', href: ev.music, target: '_blank', rel: 'noopener' }, 'Open in ' + m.kind)
      : el('iframe', { src: m.src, height: m.h, loading: 'lazy', allow: 'encrypted-media; autoplay; clipboard-write', style: 'width:100%;border:0;border-radius:14px', title: m.kind + ' playlist' })));
  else if (ev.music) cards.push(el('div', { class: 'xcard' }, el('div', { class: 'xhead' }, ico('music', 18), 'Playlist'), el('a', { class: 'btn sec block', href: ev.music, target: '_blank', rel: 'noopener' }, 'Open playlist')));
  if (ev.album) cards.push(el('div', { class: 'xcard' }, el('div', { class: 'xhead' }, ico('image', 18), 'Shared album'),
    el('p', { class: 'xnote' }, 'Add your photos here during and after the party.'), el('a', { class: 'btn block', href: ev.album, target: '_blank', rel: 'noopener' }, 'Open album')));
  if (!cards.length) return null;
  return el('div', { class: 'cards', role: 'region', 'aria-label': 'More about this event' }, cards);
}
/* host side: quietly find coordinates for the typed location so guests get a map + forecast */
async function ensureGeo(ev) {
  if (!ev.loc || ev.geo || OFFLINE()) return false;
  const g = await geocodeLoose(ev.loc); if (g) { ev.geo = g; return true; } return false;
}
