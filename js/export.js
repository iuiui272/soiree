'use strict';
/* Save as image, .soiree files (AirDrop via the share sheet), import, backups. */

/* ---- (de)serialising events that hold a local full-quality Blob ---- */
async function serEvent(ev) {
  const c = structuredClone({ ...ev, theme: { ...ev.theme, hq: undefined } });
  if (ev.theme.hq) c.theme.hqData = await blobToDataURL(ev.theme.hq);
  return c;
}
function deserEvent(o) {
  const ev = structuredClone(o);
  if (ev.theme.hqData) { ev.theme.hq = dataURLToBlob(ev.theme.hqData); delete ev.theme.hqData; }
  ev.theme.pz = ev.theme.pz || [1, 50, 50]; ev.bring = ev.bring || []; ev.qs = ev.qs || [];
  return ev;
}

/* ---- poster -> canvas (mirrors the CSS renderer, so Safari needs no extras) ---- */
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
function wrapLines(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
async function posterCanvas(ev, W = 1080) {
  const H = W * 4 / 3, u = W / 100, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), t = ev.theme, f = FONTS[t.f] || FONTS.system, pz = t.pz || [1, 50, 50];
  const rad = (t.o / 3.6) * u; x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, rad) : x.rect(0, 0, W, H); x.clip();
  const src = t.k === 'photo' ? (t.hq ? hqUrl(t.hq) : t.photo) : '';
  let drewPhoto = false;
  if (src) {
    try {
      const img = await loadImg(src), s = Math.max(W / img.width, H / img.height) * pz[0], w = img.width * s, h = img.height * s;
      const fxp = pz[1] / 100, fyp = pz[2] / 100, ox = -(w - W) * fxp, oy = -(h - H) * fyp;
      if (t.b && 'filter' in x) x.filter = `blur(${t.b * u * .278}px)`;
      x.drawImage(img, ox, oy, w, h); x.filter = 'none'; drewPhoto = true;
    } catch (e) {}
  }
  if (!drewPhoto) {
    if (t.k === 'linear') {
      const a = t.a * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), len = Math.abs(W * dx) + Math.abs(H * dy);
      const g = x.createLinearGradient(W / 2 - dx * len / 2, H / 2 - dy * len / 2, W / 2 + dx * len / 2, H / 2 + dy * len / 2);
      g.addColorStop(0, t.c[0]); g.addColorStop(.55, t.c[1]); g.addColorStop(1, t.c[2]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else {
      x.fillStyle = t.c[1]; x.fillRect(0, 0, W, H);
      [[.2, .15, 0], [.85, .25, 1], [.3, .92, 2], [.92, .96, 0]].forEach(([px, py, ci]) => {
        const cx = px * W, cy = py * H, r = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * .55;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, t.c[ci]); g.addColorStop(1, hexA(t.c[ci], 0)); x.fillStyle = g; x.fillRect(0, 0, W, H);
      });
    }
  }
  x.fillStyle = t.n >= 0 ? `rgba(0,0,0,${t.n / 100})` : `rgba(255,255,255,${-t.n / 100})`; x.fillRect(0, 0, W, H);

  /* text */
  const ink = inkFor(t) === 'dark' ? '#1d1d1f' : '#ffffff', pad = 9 * u, maxW = W - pad * 2, left = t.lo !== 'center';
  x.textAlign = left ? 'left' : 'center'; x.textBaseline = 'top'; x.fillStyle = ink;
  if (ink === '#ffffff') { x.shadowColor = 'rgba(0,0,0,.16)'; x.shadowBlur = 14 * u * .3; }
  const blocks = [], addBlock = (text, size, weight, lh, alpha, gapTop, maxLines, family, upper) => {
    if (!text) return; x.font = `${weight} ${size}px ${family}`;
    let lines = wrapLines(x, upper ? text.toUpperCase() : text, maxW); if (maxLines && lines.length > maxLines) lines = lines.slice(0, maxLines);
    blocks.push({ lines, size, weight, lh: size * lh, alpha, gapTop, family });
  };
  const [date, time] = whenParts(ev), sans = '-apple-system,"SF Pro Text",system-ui,sans-serif';
  addBlock(ev.title || 'Event title', 12.5 * u, f.fw, 1.03, 1, 0, 0, f.ff, f.tt === 'uppercase');
  addBlock(date, 4.6 * u, 600, 1.25, 1, 3 * u, 0, sans); addBlock(time, 4.6 * u, 600, 1.25, 1, 0, 0, sans);
  addBlock(ev.loc, 4.1 * u, 400, 1.3, .86, 1.2 * u, 0, sans); addBlock(ev.host ? 'Hosted by ' + ev.host : '', 4.1 * u, 400, 1.3, .86, 1.2 * u, 0, sans);
  addBlock(ev.desc, 3.7 * u, 400, 1.38, .84, 3 * u, 5, sans);
  const total = blocks.reduce((s, b) => s + b.gapTop + b.lines.length * b.lh, 0);
  let y = t.lo === 'center' ? (H - total) / 2 : t.lo === 'left' ? 14 * u : H - pad - total;
  const tx = left ? pad : W / 2;
  for (const b of blocks) { y += b.gapTop; x.globalAlpha = b.alpha; x.font = `${b.weight} ${b.size}px ${b.family}`; for (const l of b.lines) { x.fillText(l, tx, y); y += b.lh; } }
  x.globalAlpha = 1; x.shadowBlur = 0; x.shadowColor = 'transparent';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const s of ev.stickers) { x.save(); x.translate(s.x / 100 * W, s.y / 100 * H); x.rotate(s.r * Math.PI / 180); x.font = `${s.s * u}px -apple-system,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; x.fillText(s.e, 0, 0); x.restore(); }
  return c;
}
async function savePosterImage(ev) {
  toast('Making image…');
  const c = await posterCanvas(ev), blob = await new Promise(r => c.toBlob(r, 'image/png')), name = (ev.title || 'invite').replace(/[^\w-]+/g, '-') + '.png';
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = el('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---- .soiree files ---- */
async function exportInviteFile(ev) {
  const body = JSON.stringify({ soiree: 2, type: 'invite', ev: await serEvent(ev) });
  await saveBlob((ev.title || 'invite').replace(/[^\w-]+/g, '-') + '.soiree', body, 'application/json');
}
async function exportAllFile() {
  const events = await Promise.all((await DB.all('events')).map(serEvent));
  const received = await Promise.all((await DB.all('received')).map(async r => ({ ...r, ev: await serEvent(r.ev) })));
  const body = JSON.stringify({ soiree: 2, type: 'backup', events, received, replies: await DB.all('replies'), settings: { ...settings, avatar: settings.avatar } });
  await saveBlob('soiree-backup.soiree', body, 'application/json');
}
async function saveReceived(ev, extra = {}) {
  const old = await DB.get('received', ev.id);
  const rec = { id: ev.id, savedAt: old ? old.savedAt : Date.now(), my: old ? old.my : null, ...extra, ev };
  await DB.put('received', rec); return rec;
}
async function importPayload(d, opts = {}) {
  if (!d || !d.soiree) throw new Error('not a soiree file');
  if (d.type === 'invite') { const ev = deserEvent(d.ev); await saveReceived(ev, { imported: true }); return { kind: 'invite', ev }; }
  if (d.type === 'backup' || d.events) {
    for (const e of d.events || []) await DB.put('events', deserEvent(e));
    for (const r of d.received || []) await DB.put('received', { ...r, ev: deserEvent(r.ev) });
    for (const r of d.replies || []) await DB.put('replies', r);
    if (d.settings && opts.settings !== false) { Object.assign(settings, d.settings, { ring: { ...DEFAULTS.ring, ...(d.settings.ring || {}) }, avatar: { ...DEFAULTS.avatar, ...(d.settings.avatar || {}) }, ai: { ...DEFAULTS.ai, ...(d.settings.ai || {}) } }); saveSettings(); applyTheme(); applyRing(); }
    return { kind: 'backup', count: (d.events || []).length + (d.received || []).length };
  }
  throw new Error('unknown file');
}
async function importFiles(files) {
  let last = null, n = 0;
  for (const f of files) {
    try { last = await importPayload(JSON.parse(await f.text())); n++; } catch (e) { console.warn(e); toast('“' + f.name + '” isn’t a Soirée file'); }
  }
  if (!n) return;
  if (last.kind === 'invite' && n === 1) { toast('Invite saved to Received'); go('#/v/' + last.ev.id); }
  else { toast(n === 1 ? 'Backup restored' : n + ' files imported'); render(); }
}
function pickAndImport() {
  const inp = el('input', { type: 'file', accept: '.soiree,.json,application/json', multiple: true, hidden: true, onchange: e => { importFiles([...e.target.files]); inp.remove(); } });
  document.body.append(inp); inp.click();
}
/* drop a .soiree file anywhere (desktop, iPad) */
addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
addEventListener('drop', e => { const fs = [...(e.dataTransfer?.files || [])].filter(f => /\.(soiree|json)$/i.test(f.name)); if (fs.length) { e.preventDefault(); importFiles(fs); } });
