'use strict';
/* Hidden developer menu (tap "Device" in Settings 5 times).
   The app runs inside an iframe at the exact point size of the chosen device, so the real
   layout rules (compact / medium / expanded), safe areas and the Dynamic Island ring all behave. */
const DEVICES = [
  { id: 'se', n: 'iPhone SE', w: 375, h: 667, sat: 20, sab: 0, r: 0, grp: 'iPhone' },
  { id: 'i14', n: 'iPhone 14', w: 390, h: 844, sat: 47, sab: 34, r: 44, grp: 'iPhone' },
  { id: 'i15', n: 'iPhone 15 / 16', w: 393, h: 852, sat: 59, sab: 34, r: 50, isl: '393x852', grp: 'iPhone' },
  { id: 'i17p', n: 'iPhone 16 Pro / 17 Pro', w: 402, h: 874, sat: 62, sab: 34, r: 52, isl: '402x874', grp: 'iPhone' },
  { id: 'air', n: 'iPhone Air', w: 420, h: 912, sat: 62, sab: 34, r: 54, isl: '420x912', grp: 'iPhone' },
  { id: 'i15pl', n: 'iPhone 15 / 16 Plus', w: 430, h: 932, sat: 59, sab: 34, r: 54, isl: '430x932', grp: 'iPhone' },
  { id: 'i17pm', n: 'iPhone 16 / 17 Pro Max', w: 440, h: 956, sat: 62, sab: 34, r: 56, isl: '440x956', grp: 'iPhone' },
  { id: 'duoF', n: 'iPhone Duo (folded)', w: 466, h: 678, sat: 44, sab: 30, r: 48, est: true, fold: 'duoU', grp: 'iPhone Duo' },
  { id: 'duoU', n: 'iPhone Duo (unfolded)', w: 890, h: 626, sat: 24, sab: 20, r: 36, est: true, fold: 'duoF', grp: 'iPhone Duo' },
  { id: 'mini', n: 'iPad mini', w: 744, h: 1133, sat: 24, sab: 20, r: 30, grp: 'iPad' },
  { id: 'air11', n: 'iPad Air 11″', w: 820, h: 1180, sat: 24, sab: 20, r: 30, grp: 'iPad' },
  { id: 'pro11', n: 'iPad Pro 11″', w: 834, h: 1194, sat: 24, sab: 20, r: 30, grp: 'iPad' },
  { id: 'pro13', n: 'iPad Pro 13″', w: 1032, h: 1376, sat: 24, sab: 20, r: 30, grp: 'iPad' },
  { id: 'android', n: 'Android phone', w: 412, h: 915, sat: 32, sab: 24, r: 36, grp: 'Other' },
  { id: 'desktop', n: 'Desktop browser', w: 1280, h: 800, sat: 0, sab: 0, r: 10, grp: 'Other' }
];
function openEmulator() {
  const saved = (() => { try { return JSON.parse(store.get('soiree.emu') || '{}'); } catch (e) { return {}; } })();
  let dev = DEVICES.find(d => d.id === saved.id) || DEVICES[2], rot = !!saved.rot, cw = saved.cw || 0, ch = saved.ch || 0;
  const root = el('div', { class: 'emu', role: 'dialog', 'aria-label': 'Device emulator' });
  const frame = el('div', { class: 'emu-frame' }), info = el('span', { class: 'emu-info' });
  const sel = el('select', { 'aria-label': 'Device', onchange: e => { dev = DEVICES.find(d => d.id === e.target.value); rot = false; cw = ch = 0; build(); } });
  ['iPhone', 'iPhone Duo', 'iPad', 'Other'].forEach(g => { const og = el('optgroup', { label: g }); DEVICES.filter(d => d.grp === g).forEach(d => og.append(el('option', { value: d.id }, d.n))); sel.append(og); });
  const wIn = el('input', { type: 'number', min: 200, max: 3000, 'aria-label': 'Width', onchange: () => { cw = +wIn.value; build(); } }), hIn = el('input', { type: 'number', min: 200, max: 3000, 'aria-label': 'Height', onchange: () => { ch = +hIn.value; build(); } });
  const foldBtn = el('button', { class: 'chip', onclick: () => { dev = DEVICES.find(d => d.id === dev.fold); rot = false; cw = ch = 0; sel.value = dev.id; build(); } }, 'Fold / unfold');
  const dims = () => { let w = cw || dev.w, h = ch || dev.h; if (rot) [w, h] = [h, w]; return [w, h]; };
  function build() {
    const [w, h] = dims(), pad = 12, bar = 64, aw = innerWidth - 24, ah = innerHeight - bar - 24, s = Math.min(1, aw / (w + pad * 2), ah / (h + pad * 2));
    sel.value = dev.id; wIn.value = w; hIn.value = h; foldBtn.hidden = !dev.fold;
    const q = `?preview&emu=1&sat=${dev.sat}&sab=${dev.sab}` + (dev.isl ? '&sim=' + dev.isl : '');
    frame.style.cssText = `width:${(w + pad * 2) * s}px;height:${(h + pad * 2) * s}px;border-radius:${(dev.r + pad) * s}px;padding:${pad * s}px`;
    const fr = el('iframe', { src: location.pathname + q + (location.hash || '#/'), title: dev.n, style: `width:${w}px;height:${h}px;transform:scale(${s});border-radius:${dev.r}px` });
    frame.replaceChildren(el('div', { class: 'emu-clip', style: `width:${w * s}px;height:${h * s}px;border-radius:${dev.r * s}px` }, fr));
    info.textContent = `${w} × ${h} pt${dev.est ? ' (estimated)' : ''} · ${Math.round(s * 100)}%`;
    store.set('soiree.emu', JSON.stringify({ id: dev.id, rot, cw, ch }));
  }
  const close = () => { root.remove(); removeEventListener('resize', build); removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  root.append(el('div', { class: 'emu-bar' }, sel, el('button', { class: 'chip', onclick: () => { rot = !rot; build(); } }, 'Rotate'), foldBtn,
    el('label', { class: 'emu-dim' }, 'W', wIn), el('label', { class: 'emu-dim' }, 'H', hIn), info,
    el('button', { class: 'chip', onclick: () => build() }, 'Reload'), el('button', { class: 'chip on', onclick: close }, 'Close')), el('div', { class: 'emu-stage' }, frame));
  document.body.append(root); addEventListener('resize', build); addEventListener('keydown', esc); build();
}
