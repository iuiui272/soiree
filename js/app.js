'use strict';
/* Shell: responsive layout (compact / medium / expanded), floating sidebar, nav capsule, routing, views. */
const app = $('#app');
let cleanups = [], VT = false, navIdx = 0, navMax = 0;
const onLeave = fn => cleanups.push(fn);

/* =============================== layout =============================== */
const L = { mode: 'compact', open: false };
const sideDefault = () => store.get('soiree.side') !== '0';
function computeLayout() {
  const w = document.documentElement.clientWidth, m = w < 600 ? 'compact' : w < 800 ? 'medium' : 'expanded';
  if (m !== L.mode) { L.mode = m; L.open = m === 'expanded' && sideDefault(); }
  applyLayout();
}
function applyLayout() {
  const r = document.documentElement; r.dataset.layout = L.mode; r.dataset.side = L.open ? 'open' : 'closed';
  r.style.setProperty('--side', (L.mode === 'expanded' && L.open) ? '316px' : '0px'); updateNavcap(); devBadge();
}
function toggleSide(force) {
  L.open = typeof force === 'boolean' ? force : !L.open;
  if (L.mode === 'expanded') store.set('soiree.side', L.open ? '1' : '0');
  applyLayout();
}
addEventListener('resize', computeLayout);

let SB = null, NC = null;
function buildChrome() {
  SB = { nav: el('div', { class: 'sb-nav' }), list: el('div', { class: 'sb-list' }), foot: el('div', { class: 'sb-foot' }) };
  const head = el('div', { class: 'sb-head' }, el('button', { class: 'rb flat', 'aria-label': 'Hide sidebar', onclick: () => toggleSide(false) }, ico('sidebar')));
  SB.root = el('aside', { class: 'sidebar', 'aria-label': 'Sidebar' }, head, SB.nav, el('div', { class: 'sb-sec' }, 'Recents'), SB.list, SB.foot);
  NC = { toggle: el('button', { class: 'nc-b nc-toggle', 'aria-label': 'Show sidebar', onclick: () => toggleSide(true) }, ico('sidebar')),
    back: el('button', { class: 'nc-b', 'aria-label': 'Back', onclick: () => history.back() }, ico('back')),
    fwd: el('button', { class: 'nc-b', 'aria-label': 'Forward', onclick: () => history.forward() }, ico('forward')) };
  NC.root = el('div', { class: 'navcap' }, NC.toggle, NC.back, NC.fwd);
  document.body.append(el('div', { class: 'side-scrim', onclick: () => toggleSide(false) }), SB.root, NC.root);
}
function updateNavcap() { if (!NC) return; NC.back.disabled = navIdx <= 0; NC.fwd.disabled = navIdx >= navMax; }
const shortWhen = ev => ev.start ? new Date(ev.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + new Date(ev.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'No date';
const sortEvents = (list, get) => {
  const now = Date.now() - 6 * 3600e3, t = x => new Date(get(x).start).getTime() || 0;
  return list.filter(x => t(x) >= now).sort((a, b) => t(a) - t(b)).concat(list.filter(x => t(x) < now).sort((a, b) => t(b) - t(a)));
};
const sideGo = (h, o) => { go(h, null, { force: true, ...o }); if (L.mode === 'medium') toggleSide(false); };
async function drawSidebar() {
  if (!SB) return;
  const h = location.hash || '#/', onTpl = h === '#/templates', recvCtx = /^#\/(i=|v\/|r=)/.test(h), ctx = recvCtx ? 'received' : (store.get('soiree.tab') || 'created');
  let mine = [], recv = []; try { [mine, recv] = await Promise.all([DB.all('events'), DB.all('received')]); } catch (e) {}
  const active = mine.filter(e => !e.archived);
  const nav = (icon, label, count, on, fn) => el('button', { class: 'nav-i' + (on ? ' on' : ''), onclick: fn }, ico(icon, 22), el('span', {}, label), count ? el('em', {}, count) : null);
  SB.nav.replaceChildren(
    nav('calendar', 'Created', active.length, !onTpl && ctx === 'created', () => { store.set('soiree.tab', 'created'); sideGo('#/'); }),
    nav('inbox', 'Received', recv.length, !onTpl && ctx === 'received', () => { store.set('soiree.tab', 'received'); sideGo('#/'); }),
    nav('template', 'Templates', 0, onTpl, () => sideGo('#/templates')));
  const activeId = /^#\/(e|edit|v)\//.test(h) ? h.split('/')[2] : null;
  const items = ctx === 'received' ? sortEvents(recv, r => r.ev).map(r => ({ id: r.id, ev: r.ev, href: '#/v/' + r.id })) : sortEvents(active, e => e).map(e => ({ id: e.id, ev: e, href: '#/e/' + e.id }));
  SB.list.replaceChildren(...(items.length ? items.map(it => el('button', { class: 'rec' + (it.id === activeId ? ' on' : ''), onclick: () => sideGo(it.href) },
    el('i', { class: 'dot', style: `background:${meshCss(it.ev.theme.c)}` }), el('span', { class: 'rt' }, el('b', {}, it.ev.title || 'Untitled'), el('small', {}, shortWhen(it.ev))))) :
    [el('p', { class: 'sb-empty' }, ctx === 'received' ? 'Invites sent to you appear here.' : 'Your invites appear here.')]));
  SB.foot.replaceChildren(el('button', { class: 'profile', onclick: () => openSettings() }, avatarEl(38), el('span', { class: 'pn' }, el('b', {}, settings.name || 'Your profile'), el('small', {}, 'Profile & settings'))),
    el('button', { class: 'btn sm', onclick: () => sideGo('#/templates') }, ico('plus', 16), 'New'));
}
function devBadge() {
  $('#devbadge')?.remove(); if (!settings.dev || !settings.devOverlay) return;
  document.body.append(el('div', { id: 'devbadge', class: 'devbadge' }, `${document.documentElement.clientWidth}×${innerHeight} · ${L.mode}`));
}

/* =============================== routing =============================== */
function go(hash, from, o = {}) {
  const cur = location.hash || '#/', same = cur === hash;
  if (same && !o.force) return;
  const run = async () => {
    if (o.replace || same) history.replaceState({ i: navIdx }, '', hash); else { navIdx++; navMax = navIdx; history.pushState({ i: navIdx }, '', hash); }
    await render();
  };
  if (from && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && !settings.motion) {
    from.style.viewTransitionName = 'poster'; VT = true;
    document.startViewTransition(run).finished.finally(() => { VT = false; });
  } else run();
}
addEventListener('popstate', e => {
  if (e.state && typeof e.state.i === 'number') navIdx = e.state.i; else { navMax++; navIdx = navMax; history.replaceState({ i: navIdx }, ''); }
  render();
});
const needsGate = h => { if (!(IOS && !STANDALONE) || PREVIEW) return false; return GATE_GUESTS || !/^#\/(i=|r=|v\/)/.test(h); };
async function render() {
  cleanups.forEach(f => { try { f(); } catch (e) {} }); cleanups = [];
  const h = location.hash || '#/'; let view;
  try {
    if (needsGate(h)) view = Gate();
    else if (h.startsWith('#/i=')) view = await GuestView(h.slice(4));
    else if (h.startsWith('#/v/')) view = await ViewReceived(h.slice(4));
    else if (h.startsWith('#/r=')) view = await ReplyView(h.slice(4));
    else if (h === '#/templates') view = await TemplateGallery();
    else if (h === '#/new') view = await Editor(null);
    else if (h.startsWith('#/edit/')) view = await Editor(h.slice(7));
    else if (h.startsWith('#/e/')) view = await HostView(h.slice(4));
    else view = await Home();
  } catch (err) { console.error(err); view = Message('This link looks incomplete', 'Ask the host to send it again, or open it in a different app.'); }
  if (!VT) view.classList.add('enter');
  app.replaceChildren(view); window.scrollTo(0, 0);
  if (view._mount) view._mount();
  updateNavcap(); drawSidebar();
}
addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'n' && !e.shiftKey) { e.preventDefault(); go('#/templates'); }
  else if (mod && e.key === ',') { e.preventDefault(); openSettings(); }
  else if (e.key === 'Escape') { const m = $$('.modal-card.in'); if (m.length) m[m.length - 1]._close && m[m.length - 1]._close(); }
});
function $$(s, r = document) { return [...r.querySelectorAll(s)]; }

/* =============================== shared view pieces =============================== */
function bar({ left, title, right, solid } = {}) {
  return el('div', { class: 'bar' + (solid ? ' solid' : '') }, el('div', { class: 'side' }, left), el('div', { class: 'ttl' }, title || ''), el('div', { class: 'side' }, right));
}
function collapseOnScroll(b, sentinel) {
  const io = new IntersectionObserver(([e]) => b.classList.toggle('scrolled', !e.isIntersecting), { rootMargin: `-${(parseFloat(getComputedStyle(b).minHeight) || 56)}px 0px 0px 0px` });
  io.observe(sentinel); onLeave(() => io.disconnect());
}
const backBtn = (to = '#/') => el('button', { class: 'rb only-compact', 'aria-label': 'Back', onclick: () => go(to) }, ico('back'));
const compactBack = backBtn;
const gearBtn = () => el('button', { class: 'rb only-compact', 'aria-label': 'Settings', onclick: () => openSettings() }, ico('sliders'));
function Message(title, text) {
  return el('div', { class: 'view' }, bar({ left: backBtn() }), el('div', { class: 'empty' }, el('div', { class: 'app-icon lg sq', html: SPARK }), el('h2', { class: 'large' }, title), el('p', {}, text), el('button', { class: 'btn', onclick: () => go('#/') }, 'Go to my invites')));
}
function detailRows(ev) {
  const [date, time] = whenParts(ev), rows = [];
  const row = (icon, a, b) => el('div', { class: 'detail-row' }, el('div', { class: 'ci' }, ico(icon, 19)), el('div', {}, el('b', {}, a), b ? el('small', {}, b) : null));
  if (date) rows.push(row('calendar', date, time));
  if (ev.loc) rows.push(el('div', { class: 'detail-row' }, el('div', { class: 'ci' }, ico('pin', 19)), el('a', { href: 'https://maps.apple.com/?q=' + encodeURIComponent(ev.loc), target: '_blank', rel: 'noopener' }, el('b', {}, ev.loc), el('small', {}, 'Open in Maps'))));
  if (ev.host) rows.push(row('person', 'Hosted by ' + ev.host, ev.reply ? 'Replies go to ' + ev.reply : ''));
  if (ev.deadline) rows.push(row('clock', 'Reply by ' + new Date(ev.deadline).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }), ev.cap ? `Limited to ${ev.cap} guests` : ''));
  else if (ev.cap) rows.push(row('person', `Limited to ${ev.cap} guests`, ''));
  return rows.length ? el('div', { class: 'group' }, rows) : null;
}
function startCountdown(ev, node) {
  const tick = () => { node.textContent = until(ev.start); node.parentElement.style.display = node.textContent ? '' : 'none'; };
  tick(); const id = setInterval(tick, 30000); onLeave(() => clearInterval(id));
}
const PAL = ['#ff6b6b', '#ff9f43', '#feca57', '#1dd1a1', '#48dbfb', '#5f7cff', '#a55eea', '#ff6fb5'];
const hue = s => PAL[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
function attachTilt(P) {
  if (settings.motion) return;
  const w = P.wrap; w.classList.add('tilt');
  const set = (x, y) => { w.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg'); w.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg'); P.stk.style.setProperty('--px', (x * -10).toFixed(1) + 'px'); P.stk.style.setProperty('--py', (y * -10).toFixed(1) + 'px'); };
  w.addEventListener('pointermove', e => { const r = w.getBoundingClientRect(); set(((e.clientX - r.left) / r.width - .5) * 2, ((e.clientY - r.top) / r.height - .5) * 2); });
  w.addEventListener('pointerleave', () => set(0, 0));
  if (settings.tilt && window.DeviceOrientationEvent) {
    const dev = e => { if (e.gamma == null) return; set(clamp(e.gamma / 30, -1, 1), clamp((e.beta - 45) / 30, -1, 1)); };
    addEventListener('deviceorientation', dev); onLeave(() => removeEventListener('deviceorientation', dev));
  }
}
function QRBlock(link, px = 260) {
  const c = el('canvas', { class: 'qr', role: 'img', 'aria-label': 'QR code for the invite link' });
  if (!QR.draw(c, link, px)) return el('p', { class: 'note' }, 'This invite is too big for a QR code. Remove the photo or some stickers, or share the link instead.');
  return c;
}
async function openQR(ev) {
  const s = sheet('QR code', { height: 'auto' }), link = await buildLink(ev);
  s.body.append(el('div', { class: 'qrwrap' }, QRBlock(link), el('p', { class: 'note', style: 'text-align:center' }, 'Scan with the Camera app. It opens the invite in the browser.')),
    el('div', { class: 'stack', style: 'margin-top:12px' }, el('button', { class: 'btn sec block', onclick: async () => { await copyText(link); toast('Link copied'); } }, ico('copy', 18), 'Copy link')));
}

/* =============================== gate =============================== */
function Gate() {
  const step = (t, i) => el('li', {}, el('span', {}, t), ico(i));
  return el('div', { class: 'view gate' }, el('div', { class: 'gate-card' },
    el('div', { class: 'app-icon lg sq', html: SPARK }), el('h1', {}, 'Add Soirée to your Home Screen'),
    el('p', { class: 'lead' }, `On ${IPAD ? 'iPad' : 'iPhone'}, Soirée works as an app. Your invites stay saved on this device and open full screen.`),
    el('ol', { class: 'steps' }, step('Tap the Share button in Safari', 'share'), step('Choose Add to Home Screen', 'plus'), step('Open Soirée from your Home Screen', 'sparkle')),
    el('p', { class: 'fine' }, 'You only need this to create invites. Opening someone’s invite link works without it.')));
}

/* =============================== home =============================== */
async function Home() {
  const [mine, recv] = await Promise.all([DB.all('events'), DB.all('received')]);
  let tab = store.get('soiree.tab') || 'created', q = '', showArch = false;
  const grid = el('div', { class: 'grid' }), archBox = el('div');
  const match = ev => !q || (ev.title || '').toLowerCase().includes(q) || (ev.loc || '').toLowerCase().includes(q);
  const card = (ev, href, cap) => { const P = mkPoster(ev, { mini: true }); return el('button', { class: 'card', onclick: () => go(href, P.wrap) }, P.wrap, el('div', { class: 'cap' }, el('b', {}, ev.title || 'Untitled'), cap || until(ev.start) || 'No date')); };
  const bnr = (!deferredPrompt || STANDALONE || store.get('soiree.noinstall')) ? null : el('div', { class: 'banner sq' }, el('div', { class: 'app-icon sm sq', html: SPARK }), el('div', { class: 'bt' }, el('b', {}, 'Install Soirée'), 'Open it like an app and keep invites offline.'),
    el('button', { class: 'btn sm', onclick: async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; render(); } }, 'Install'),
    el('button', { class: 'rb sm', 'aria-label': 'Dismiss', onclick: () => { store.set('soiree.noinstall', '1'); render(); } }, ico('x', 16)));
  function draw() {
    const created = sortEvents(mine.filter(e => !e.archived && match(e)), e => e), archived = mine.filter(e => e.archived && match(e));
    const received = sortEvents(recv.filter(r => match(r.ev)), r => r.ev);
    const list = tab === 'created' ? created : received;
    if (!list.length) {
      grid.replaceChildren(el('div', { class: 'empty', style: 'grid-column:1/-1' }, el('div', { class: 'app-icon lg sq', html: SPARK }),
        el('h2', { style: 'font-size:22px;font-weight:700' }, q ? 'No matches' : tab === 'created' ? 'No invites yet' : 'Nothing received yet'),
        el('p', {}, q ? 'Try a different search.' : tab === 'created' ? 'Pick a design, then share it as a link. No account needed.' : 'Invites people send you show up here once you open their link, or when you import a file.'),
        q ? null : tab === 'created' ? el('button', { class: 'btn', onclick: () => go('#/templates') }, 'Create invite') : el('button', { class: 'btn sec', onclick: pickAndImport }, ico('file', 18), 'Import an invite file')));
    } else grid.replaceChildren(...list.map(it => tab === 'created' ? card(it, '#/e/' + it.id) : card(it.ev, '#/v/' + it.id, it.my ? ({ g: 'Going', m: 'Maybe', n: 'Can’t go' }[it.my.status] + ' · ' + until(it.ev.start)) : null)));
    archBox.replaceChildren(...(tab === 'created' && archived.length ? [el('button', { class: 'linkbtn arch', onclick: () => { showArch = !showArch; draw(); } }, ico('archive', 16), `Archived (${archived.length})`, el('span', { class: 'chev' }, showArch ? '▾' : '▸')),
      showArch ? el('div', { class: 'grid' }, archived.map(e => card(e, '#/e/' + e.id, 'Archived'))) : null] : []));
  }
  draw();
  const sentinel = el('h1', { class: 'large' }, 'Invites');
  const more = () => openMenu('More', [
    { label: 'Import invite file', icon: 'file', fn: pickAndImport }, { label: 'Receive nearby', icon: 'nearby', fn: () => openNearby({}) },
    { label: 'Browse templates', icon: 'template', fn: () => go('#/templates') }, { label: 'Settings', icon: 'sliders', fn: () => openSettings() }]);
  const b = bar({ title: 'Invites', right: [el('button', { class: 'rb', 'aria-label': 'More', onclick: more }, ico('more')), el('button', { class: 'rb accent', 'aria-label': 'New invite', onclick: () => go('#/templates') }, ico('plus'))] });
  const view = el('div', { class: 'view' }, b, el('div', { class: 'wrap wide' }, sentinel, bnr,
    seg([['created', 'Created'], ['received', 'Received']], tab, v => { tab = v; store.set('soiree.tab', v); draw(); drawSidebar(); }, 'big'),
    el('div', { class: 'searchrow' }, ico('search', 18), el('input', { type: 'search', class: 'search', placeholder: 'Search', 'aria-label': 'Search invites', oninput: e => { q = e.target.value.toLowerCase(); draw(); } })), grid, archBox));
  view._mount = () => collapseOnScroll(b, sentinel);
  return view;
}

/* =============================== host view =============================== */
async function putReply(r) {
  const key = r.e + ':' + r.n.trim().toLowerCase(), old = await DB.get('replies', key);
  const rec = { key, eventId: r.e, n: r.n.trim(), s: r.w ? (old ? old.s : 'g') : r.s, p: r.w ? (old ? old.p : r.p || 0) : (r.p || 0), t: old && r.w ? old.t : (r.t || Date.now()),
    b: r.w ? (old && old.b) : r.b, a: r.w ? (old && old.a) : r.a, omw: r.w ? (r.t || Date.now()) : (old && old.omw) };
  await DB.put('replies', rec);
}
async function duplicateEvent(ev) {
  const c = structuredClone(ev); c.id = uid(); c.created = Date.now(); c.shared = 0; c.archived = false; c.title = (ev.title || 'Invite') + ' copy'; delete c.updated;
  await DB.put('events', c); toast('Duplicated'); go('#/edit/' + c.id);
}
async function HostView(id) {
  const ev = await DB.get('events', id); if (!ev) return Message('Invite not found', 'It may have been deleted from this device.');
  const P = mkPoster(ev, { live: true }); if (VT) P.wrap.style.viewTransitionName = 'poster'; attachTilt(P);
  const cd = el('span'), wx = weatherPill(ev), guests = el('section'), cards = extraCards(ev);
  if (ev.loc && !ev.geo) ensureGeo(ev).then(ch => { if (ch) DB.put('events', ev); });
  async function drawGuests() {
    const rs = (await DB.all('replies')).filter(r => r.eventId === id).sort((a, z) => a.t - z.t), cnt = { g: 0, m: 0, n: 0 }, label = { g: 'Going', m: 'Maybe', n: 'Can’t go' };
    let run = 0; rs.forEach(r => { r.wait = false; if (r.s === 'g') { const n = 1 + (r.p || 0); run += n; if (ev.cap && run > ev.cap) r.wait = true; else cnt.g += n; } else cnt[r.s]++; });
    const waiting = rs.filter(r => r.wait).length, shown = rs.slice().reverse();
    const pasteBox = el('div', { class: 'pastebox', hidden: true }), ta = el('textarea', { placeholder: 'Paste a reply link here', 'aria-label': 'Reply link' });
    async function addReply(text) {
      const i = text.indexOf('#/r='); if (i < 0) return toast('That doesn’t look like a reply link');
      try { const { obj } = await unpackBin(text.slice(i + 4).trim().split(/\s/)[0]); if (obj.e !== id) return toast('That reply is for a different invite'); await putReply(obj); toast(obj.n + ' added'); ta.value = ''; drawGuests(); }
      catch (e) { toast('That reply link is damaged'); }
    }
    pasteBox.append(ta, el('div', { class: 'two' }, el('button', { class: 'btn sec sm', onclick: async () => { try { ta.value = await navigator.clipboard.readText(); } catch (e) { toast('Paste into the box instead'); } } }, 'Paste'), el('button', { class: 'btn sm', onclick: () => addReply(ta.value) }, 'Add reply')));
    const detail = r => {
      const lines = []; if (r.b && r.b.length) lines.push('Bringing: ' + r.b.map(i => ev.bring[i]).filter(Boolean).join(', '));
      (r.a || []).forEach((a, i) => { if (a && ev.qs[i]) lines.push(ev.qs[i].q.replace(/\?$/, '') + ': ' + a); }); if (r.omw) lines.push('On the way');
      return lines.length ? el('small', { class: 'gd' }, lines.join('\n')) : null;
    };
    guests.replaceChildren(
      el('div', { class: 'sechead' }, el('h3', {}, 'Guests'), el('button', { class: 'linkbtn', onclick: () => { pasteBox.hidden = !pasteBox.hidden; } }, 'Add a reply')),
      el('div', { class: 'group stats' }, ['g', 'm', 'n'].map(k => el('div', {}, el('b', {}, cnt[k]), el('span', {}, label[k])))), pasteBox,
      ev.cap ? el('p', { class: 'note' }, `Limit ${ev.cap}${waiting ? ` · ${waiting} on the waitlist` : ''}`) : null,
      shown.length ? el('div', { class: 'group', style: 'margin-top:12px' }, shown.map(r => el('div', { class: 'guest' }, el('div', { class: 'av', style: `background:${hue(r.n)}` }, (r.n[0] || '?').toUpperCase()),
        el('div', { class: 'nm' }, r.n, detail(r)), el('span', { class: 'st ' + (r.wait ? 'm' : r.s) }, (r.wait ? 'Waitlist' : label[r.s]) + (r.p ? ` +${r.p}` : '')),
        el('button', { class: 'rb sm flat', 'aria-label': 'Remove ' + r.n, onclick: async () => { await DB.del('replies', r.key); drawGuests(); } }, ico('x', 16)))))
        : el('p', { class: 'note' }, 'No replies yet. When a guest answers, tap their reply link to add them, or use Add a reply to paste it.'),
      shown.length ? el('div', { style: 'margin-top:10px;text-align:center' }, el('button', { class: 'linkbtn', onclick: async () => { await copyText(shown.slice().reverse().map(r => `${r.n}: ${r.wait ? 'Waitlist' : label[r.s]}${r.p ? ' +' + r.p : ''}`).join('\n')); toast('Guest list copied'); } }, 'Copy guest list')) : null);
  }
  drawGuests();
  const menu = () => openMenu(ev.title || 'Invite', [
    { label: 'Show QR code', icon: 'qr', fn: () => openQR(ev) }, { label: 'Save as image', icon: 'image', fn: () => savePosterImage(ev) },
    { label: 'AirDrop or share as file', icon: 'file', fn: () => exportInviteFile(ev) }, { label: 'Send to a nearby phone', icon: 'nearby', fn: () => openNearby({ ev }) },
    { label: 'Send a reply reminder', icon: 'wand', fn: async () => { const t = Assist.reminder(ev, 'nudge') + ' ' + await buildLink(ev); if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) {} } else { await copyText(t); toast('Reminder copied'); } } },
    { label: 'Duplicate', icon: 'copy', fn: () => duplicateEvent(ev) },
    { label: ev.archived ? 'Move out of archive' : 'Archive', icon: 'archive', fn: async () => { ev.archived = !ev.archived; await DB.put('events', ev); toast(ev.archived ? 'Archived' : 'Restored'); render(); } },
    { label: 'Delete invite', icon: 'trash', danger: true, fn: async () => { if (!confirm('Delete this invite from this device? Guests who already have the link can still open it.')) return; await DB.del('events', id); for (const r of await DB.all('replies')) if (r.eventId === id) await DB.del('replies', r.key); toast('Invite deleted'); go('#/'); } }]);
  const b = bar({ solid: true, title: ev.title, left: backBtn(), right: [el('button', { class: 'rb', 'aria-label': 'More', onclick: menu }, ico('more')), el('button', { class: 'rb', 'aria-label': 'Edit', onclick: () => go('#/edit/' + id) }, ico('pencil'))] });
  const left = el('div', { class: 'tc-left' }, el('div', { class: 'hero' }, P.wrap), el('div', { class: 'until' }, cd, wx),
    el('div', { class: 'actions' }, el('button', { class: 'btn block', onclick: async () => { if (await shareLink(ev)) { ev.shared = Date.now(); DB.put('events', ev); } } }, ico('share', 20), 'Share invite'),
      el('div', { class: 'three' }, el('button', { class: 'btn sec', onclick: async () => { await copyText(await buildLink(ev)); toast('Link copied'); } }, ico('copy', 18), 'Copy'), el('button', { class: 'btn sec', onclick: () => openQR(ev) }, ico('qr', 18), 'QR'), el('button', { class: 'btn sec', onclick: () => addToCalendar(ev) }, ico('calendar', 18), 'Calendar'))));
  const right = el('div', { class: 'tc-right' }, cards, el('div', { style: 'margin-top:20px' }, detailRows(ev)), guests);
  const view = el('div', { class: 'view' }, b, el('div', { class: 'twocol' }, left, right));
  startCountdown(ev, cd); return view;
}

/* =============================== guest view =============================== */
async function GuestView(payload) {
  const { obj, img } = await unpackBin(payload), ev = fromWire(obj, img);
  if (await DB.get('events', ev.id)) return HostView(ev.id);              // the host opened their own link
  const old = await DB.get('received', ev.id);
  if (old && old.ev.theme.hq) ev.theme.hq = old.ev.theme.hq;              // keep a sharper copy if we already have one
  const rec = await saveReceived(ev, { payload });
  return GuestScreen(ev, rec);
}
async function ViewReceived(id) {
  const rec = await DB.get('received', id); if (!rec) return Message('Invite not found', 'It may have been removed from this device.');
  return GuestScreen(rec.ev, rec);
}
async function GuestScreen(ev, rec) {
  const P = mkPoster(ev, { live: true }); if (VT) P.wrap.style.viewTransitionName = 'poster'; else P.wrap.classList.add('intro'); attachTilt(P);
  const cd = el('span'), wx = weatherPill(ev), cards = extraCards(ev), my = rec.my || {};
  let st = my.status || '', name = my.name || settings.name || '', plus = my.plus || 0; const claims = new Set(my.b || []), answers = [...(my.a || [])];
  const closed = ev.deadline && new Date(ev.deadline) < new Date();
  const plusOut = el('b', {}, plus), sendBtn = el('button', { class: 'btn block', disabled: true }, 'Send reply'), after = el('div');
  const sync = () => { sendBtn.disabled = !st || !name.trim(); };
  const rsvp = el('div', { class: 'rsvp' }, [['g', '🎉', 'Going'], ['m', '🤔', 'Maybe'], ['n', '😢', 'Can’t go']].map(([k, e, l]) => el('button', { class: k === st ? 'on' : '', onclick: x => { st = k; rsvp.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === x.currentTarget)); sync(); } }, el('span', {}, e), l)));
  const bring = (ev.bring || []).length ? el('div', {}, el('div', { class: 'h' }, 'Bring list'), el('div', { class: 'group' }, ev.bring.map((it, i) => {
    const b = el('button', { class: 'row chk' + (claims.has(i) ? ' on' : ''), role: 'checkbox', 'aria-checked': String(claims.has(i)), onclick: () => { claims.has(i) ? claims.delete(i) : claims.add(i); b.classList.toggle('on', claims.has(i)); b.setAttribute('aria-checked', String(claims.has(i))); } }, el('i', { class: 'tick' }, ico('check', 14)), el('span', {}, it), el('small', {}, 'I’ll bring this'));
    return b;
  })), el('p', { class: 'note' }, 'Tap what you’ll bring. The host sees your picks with your reply.')) : null;
  const qs = (ev.qs || []).length ? el('div', {}, el('div', { class: 'h' }, 'Questions'), el('div', { class: 'group' }, ev.qs.map((q, i) => el('div', { class: 'row col' }, el('label', {}, q.q), el('input', { class: 'qa', value: answers[i] || '', placeholder: 'Your answer', oninput: e => { answers[i] = e.target.value; } }))))) : null;
  async function sendReply(extra = {}) {
    name = name.trim(); settings.name = name; saveSettings();
    const reply = { e: ev.id, n: name, s: st, p: plus, t: Date.now(), b: [...claims], a: (ev.qs || []).map((q, i) => answers[i] || ''), ...extra };
    if (!extra.w) { rec.my = { name, status: st, plus, b: [...claims], a: reply.a, sentAt: Date.now() }; await DB.put('received', rec); }
    const link = baseUrl() + '#/r=' + await packBin(reply), word = { g: 'Going', m: 'Maybe', n: 'Can’t go' }[st];
    const extras = [claims.size ? 'bringing ' + [...claims].map(i => ev.bring[i]).join(', ') : '', plus ? `+${plus}` : ''].filter(Boolean).join(', ');
    const text = extra.w ? `${name} is on the way to “${ev.title}”. Tap to update your guest list:` : `${name}: ${word}${extras ? ` (${extras})` : ''} for “${ev.title}”. Tap to add me to your guest list:`, to = (ev.reply || '').trim();
    if (to.includes('@')) location.href = `mailto:${to}?subject=${encodeURIComponent('RSVP: ' + ev.title)}&body=${encodeURIComponent(text + '\n' + link)}`;
    else if (to) location.href = `sms:${to.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text + ' ' + link)}`;
    else if (navigator.share) { try { await navigator.share({ text: text + ' ' + link }); } catch (e) {} }
    else { await copyText(text + ' ' + link); toast('Reply copied. Paste it to the host.'); }
    drawAfter();
  }
  function drawAfter() {
    after.replaceChildren(...(rec.my && rec.my.status === 'g' ? [el('button', { class: 'btn sec block', onclick: () => sendReply({ w: 1 }) }, ico('pin', 18), 'I’m on my way')] : []));
  }
  sendBtn.onclick = () => sendReply(); sync(); drawAfter();
  const rsvpBlock = closed ? el('div', {}, el('div', { class: 'sechead' }, el('h3', {}, 'Replies are closed')), el('p', { class: 'note' }, 'The host stopped taking replies on ' + new Date(ev.deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) + '.'))
    : el('div', {}, el('div', { class: 'sechead' }, el('h3', {}, 'Will you come?')), rsvp,
      el('div', { class: 'group', style: 'margin-top:12px' }, el('div', { class: 'row' }, el('input', { placeholder: 'Your name', value: name, 'aria-label': 'Your name', autocomplete: 'name', oninput: e => { name = e.target.value; sync(); } })),
        el('div', { class: 'row' }, el('span', {}, 'Bringing guests'), el('div', { class: 'stepper' }, el('button', { 'aria-label': 'Fewer', onclick: () => { plus = Math.max(0, plus - 1); plusOut.textContent = plus; } }, '−'), plusOut, el('button', { 'aria-label': 'More', onclick: () => { plus = Math.min(9, plus + 1); plusOut.textContent = plus; } }, '+')))),
      bring, qs, el('div', { class: 'stack', style: 'margin-top:14px' }, sendBtn, after));
  const note = IOS && !STANDALONE ? el('p', { class: 'note', style: 'text-align:center' }, 'Tip: add Soirée to your Home Screen to keep this invite saved.') : null;
  const b = bar({ solid: true, title: ev.title, left: backBtn(), right: [gearBtn(), el('button', { class: 'rb', 'aria-label': 'More', onclick: () => openMenu(ev.title || 'Invite', [
    { label: 'Add to calendar', icon: 'calendar', fn: () => addToCalendar(ev) }, { label: 'Save as image', icon: 'image', fn: () => savePosterImage(ev) },
    { label: 'Share this invite', icon: 'share', fn: async () => { const l = rec.payload ? baseUrl() + '#/i=' + rec.payload : await buildLink(ev); if (navigator.share) { try { await navigator.share({ title: ev.title, url: l }); } catch (e) {} } else { await copyText(l); toast('Link copied'); } } },
    { label: 'AirDrop or share as file', icon: 'file', fn: () => exportInviteFile(ev) }, { label: 'Send to a nearby phone', icon: 'nearby', fn: () => openNearby({ ev }) },
    { label: 'Remove from Received', icon: 'trash', danger: true, fn: async () => { await DB.del('received', ev.id); toast('Removed'); go('#/'); } }]) }, ico('more'))] });
  const left = el('div', { class: 'tc-left' }, el('div', { class: 'hero' }, P.wrap), el('div', { class: 'until' }, cd, wx));
  const right = el('div', { class: 'tc-right' }, cards, el('div', { style: 'margin-top:20px' }, detailRows(ev)), rsvpBlock,
    el('div', { class: 'stack', style: 'margin-top:14px' }, el('button', { class: 'btn sec block', onclick: () => addToCalendar(ev) }, ico('calendar', 18), 'Add to calendar')), note,
    el('div', { class: 'foot' }, el('button', { class: 'linkbtn', onclick: () => go('#/templates') }, 'Make your own invite')));
  const view = el('div', { class: 'view' }, b, el('div', { class: 'twocol' }, left, right));
  startCountdown(ev, cd); return view;
}

/* =============================== reply landing =============================== */
async function ReplyView(payload) {
  const { obj } = await unpackBin(payload), ev = await DB.get('events', obj.e), word = { g: 'Going', m: 'Maybe', n: 'Can’t go' }[obj.s] || '';
  if (ev) { await putReply(obj); toast(obj.n + ' added to your guests'); history.replaceState({ i: navIdx }, '', '#/e/' + ev.id); return HostView(ev.id); }
  const full = baseUrl() + '#/r=' + payload;
  return el('div', { class: 'view' }, bar({ left: backBtn() }), el('div', { class: 'empty' },
    el('div', { class: 'av', style: `background:${hue(obj.n)};width:72px;height:72px;font-size:30px` }, (obj.n[0] || '?').toUpperCase()),
    el('h2', { class: 'large', style: 'margin:6px 0 0' }, `${obj.n}: ${word}${obj.p ? ` +${obj.p}` : ''}`),
    el('p', {}, 'This reply belongs to an invite saved in your Soirée app. Copy it, open the app from your Home Screen, then use Add a reply on that invite.'),
    el('button', { class: 'btn', onclick: async () => { await copyText(full); toast('Reply copied'); } }, ico('copy', 18), 'Copy reply')));
}
