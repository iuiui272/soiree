'use strict';
/* The invite editor. Sheet layout on phones and narrow windows, side panel when there is room. */
async function Editor(id) {
  let ev, orig = null;
  if (id) {
    orig = await DB.get('events', id); if (!orig) return Message('Invite not found', 'It may have been deleted from this device.');
    ev = structuredClone(orig);
    const dr = await DB.get('drafts', id);
    if (dr) { if (dr.draftAt > (orig.updated || orig.created) && confirm('Restore your unsaved edits?')) ev = dr; else await DB.del('drafts', id); }
  } else if (pendingTemplate === undefined) {
    const ids = new Set((await DB.all('events')).map(e => e.id));
    const nd = (await DB.all('drafts')).filter(d => !ids.has(d.id)).sort((a, b) => b.draftAt - a.draftAt)[0];
    if (nd && confirm('Resume your unfinished invite?')) ev = nd; else { if (nd) await DB.del('drafts', nd.id); ev = takePendingEvent(); }
  } else ev = takePendingEvent();
  const t = ev.theme;
  let tab = 'details', sel = -1, dirty = false, finished = false, linkTimer = 0, histTimer = 0, draftTimer = 0, meter = null, hist = [], hi = 0;
  const P = buildPoster(); P.wrap.classList.add('edit');
  const snap = () => JSON.stringify(ev, (k, v) => k === 'hq' ? undefined : v);
  hist = [snap()];
  const view = el('div', { class: 'view editor' }), probe = el('div', { style: 'position:absolute;visibility:hidden;padding-top:var(--sat)' });
  const fitEl = el('div', { class: 'fit' }, P.wrap), stage = el('div', { class: 'stage' }, fitEl, probe), body = el('div', { class: 'sheet-body' });
  const split = () => view.classList.contains('split'), safeTop = () => parseFloat(getComputedStyle(probe).paddingTop) || 0;
  const paintNow = () => paint(P, ev, { edit: true, live: true, sel });

  /* ----- history, draft, change ----- */
  const undoB = el('button', { class: 'rb sm flat', 'aria-label': 'Undo', disabled: true, onclick: () => stepHist(-1) }, ico('undo', 18)), redoB = el('button', { class: 'rb sm flat', 'aria-label': 'Redo', disabled: true, onclick: () => stepHist(1) }, ico('redo', 18));
  const updUR = () => { undoB.disabled = hi <= 0; redoB.disabled = hi >= hist.length - 1; };
  function stepHist(d) {
    const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n;
    const o = JSON.parse(hist[hi]), th = o.theme; delete o.theme; Object.assign(ev, o);
    Object.keys(t).forEach(k => { if (k !== 'hq') delete t[k]; }); Object.assign(t, th);
    sel = -1; dirty = true; paintNow(); renderTab(); updUR(); scheduleDraft();
  }
  const scheduleDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 900); };
  const saveDraft = () => { if (finished || !dirty) return; ev.draftAt = Date.now(); DB.put('drafts', ev).catch(() => {}); };
  const change = () => {
    dirty = true; paintNow(); scheduleDraft();
    clearTimeout(histTimer); histTimer = setTimeout(() => { const s = snap(); if (s !== hist[hi]) { hist = hist.slice(0, hi + 1); hist.push(s); hi = hist.length - 1; updUR(); } }, 450);
    clearTimeout(linkTimer); linkTimer = setTimeout(updateMeter, 350);
  };

  /* ----- sheet + fitting ----- */
  let H = 0, vis = 0;
  const eh = () => view.clientHeight || innerHeight;
  const detents = () => { H = Math.min(Math.round(eh() * .88), 760); return [150, Math.min(H, Math.round(eh() * .5)), H]; };
  function fit() {
    const sr = stage.getBoundingClientRect(), sp = split(), top = sp ? 56 + safeTop() : safeTop() + 60, v = sp ? 0 : vis;
    const w0 = Math.min(sp ? 400 : 340, sr.width - 48), availH = sr.height - top - v - 14, ph = w0 * 4 / 3, s = clamp(availH / ph, .25, 1);
    fitEl.style.setProperty('--w0', w0 + 'px'); fitEl.style.setProperty('--s', s.toFixed(4)); fitEl.style.setProperty('--ty', (top + Math.max(0, (availH - ph * s) / 2)) + 'px');
  }
  function setSheet(v, animate = true) {
    if (split()) { fit(); return; }
    detents(); vis = clamp(v, 150, H);
    sheet_.style.transition = animate ? '' : 'none'; sheet_.style.setProperty('--sh', H + 'px'); sheet_.style.setProperty('--sy', (H - vis) + 'px'); sheet_.style.setProperty('--hid', (H - vis) + 'px'); fit();
  }
  const tabs = seg([['details', 'Details'], ['look', 'Look'], ['stickers', 'Stickers'], ['assist', 'Assist'], ['share', 'Share']], tab, v => { tab = v; renderTab(); if (!split() && vis < 300) setSheet(detents()[1]); });
  const head = el('div', { class: 'sheet-head' }, el('div', { class: 'grab' }), tabs), sheet_ = el('div', { class: 'sheet' }, head, body);
  let drag = null;
  head.addEventListener('pointerdown', e => { if (!split()) drag = { y0: e.clientY, v0: vis, last: e.clientY, lt: performance.now(), vel: 0, moved: false }; });
  const mv = e => {
    if (!drag) return; const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; try { head.setPointerCapture(e.pointerId); } catch (x) {} }
    if (!drag.moved) return; const now = performance.now(); drag.vel = (e.clientY - drag.last) / (now - drag.lt || 1); drag.last = e.clientY; drag.lt = now; setSheet(drag.v0 - dy, false);
  };
  const up = () => { if (!drag) return; const d = drag; drag = null; if (!d.moved) return; head._swallow = true; setTimeout(() => head._swallow = false, 0); const proj = vis - d.vel * 180; setSheet(detents().reduce((a, c) => Math.abs(c - proj) < Math.abs(a - proj) ? c : a)); };
  head.addEventListener('click', e => { if (head._swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  const keys = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); stepHist(e.shiftKey ? 1 : -1); } };
  addEventListener('keydown', keys);
  onLeave(() => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('keydown', keys); [linkTimer, histTimer, draftTimer].forEach(clearTimeout); if (dirty && !finished) { ev.draftAt = Date.now(); DB.put('drafts', ev).catch(() => {}); } });

  /* ----- stickers + photo panning on the poster ----- */
  P.stk.addEventListener('pointerdown', e => {
    const s = e.target.closest('.stk'); if (!s) return; e.preventDefault();
    sel = +s.dataset.i; const st = ev.stickers[sel], r = P.poster.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, x0 = st.x, y0 = st.y;
    P.stk.querySelectorAll('.stk').forEach(n => n.classList.toggle('sel', n === s)); if (tab === 'stickers') renderTab();
    try { s.setPointerCapture(e.pointerId); } catch (x) {}
    const m = e2 => { st.x = clamp(x0 + (e2.clientX - sx) / r.width * 100, 0, 100); st.y = clamp(y0 + (e2.clientY - sy) / r.height * 100, 0, 100); s.style.left = st.x + '%'; s.style.top = st.y + '%'; dirty = true; };
    const u = () => { s.removeEventListener('pointermove', m); s.removeEventListener('pointerup', u); s.removeEventListener('pointercancel', u); change(); };
    s.addEventListener('pointermove', m); s.addEventListener('pointerup', u); s.addEventListener('pointercancel', u);
  });
  P.poster.addEventListener('pointerdown', e => {
    if (e.target.closest('.stk')) return;
    if (tab === 'look' && t.k === 'photo' && (t.photo || t.hq)) {
      const r = P.poster.getBoundingClientRect(), p0 = [...t.pz], sx = e.clientX, sy = e.clientY;
      const m = e2 => { t.pz = [p0[0], clamp(p0[1] - (e2.clientX - sx) / r.width * 100 / p0[0], 0, 100), clamp(p0[2] - (e2.clientY - sy) / r.height * 100 / p0[0], 0, 100)]; paintNow(); dirty = true; };
      const u = () => { removeEventListener('pointermove', m); removeEventListener('pointerup', u); change(); renderTab(); };
      addEventListener('pointermove', m); addEventListener('pointerup', u); return;
    }
    if (sel !== -1) { sel = -1; paintNow(); if (tab === 'stickers') renderTab(); }
  });

  /* ----- panels ----- */
  const refs = {};
  const inputRow = (ph, key, type = 'text', extra = {}) => el('div', { class: 'row' }, el('input', { type, placeholder: ph, value: ev[key], 'aria-label': ph, ...extra, oninput: e => { ev[key] = e.target.value; change(); } }));
  const dtRow = (label, key, clearable) => el('div', { class: 'row' }, el('label', {}, label), refs[key] = el('input', { type: 'datetime-local', value: ev[key], 'aria-label': label, oninput: e => { ev[key] = e.target.value; change(); } }),
    clearable && ev[key] ? el('button', { class: 'rb sm flat', 'aria-label': 'Clear ' + label, onclick: () => { ev[key] = ''; change(); renderTab(); } }, ico('x', 16)) : null);
  const listGroup = (arr, getV, setV, add, ph, addLabel) => {
    const g = el('div', { class: 'group' });
    const draw = () => g.replaceChildren(...arr.map((it, i) => el('div', { class: 'row' }, el('input', { value: getV(it), placeholder: ph, 'aria-label': ph, oninput: e => { setV(i, e.target.value); change(); } }),
      el('button', { class: 'rb sm flat', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); change(); draw(); } }, ico('x', 16)))),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => { add(); change(); draw(); } }, ico('plus', 14), ' ' + addLabel)));
    draw(); return g;
  };
  const act = (icon, label, fn) => el('button', { class: 'btn sec', onclick: fn }, ico(icon, 18), label);
  const panels = {
    details: () => el('div', {},
      el('div', { class: 'h' }, 'Event'), el('div', { class: 'group' }, inputRow('Event title', 'title', 'text', { autocomplete: 'off', enterkeyhint: 'next' }), inputRow('Hosted by', 'host', 'text', { autocomplete: 'name' })),
      el('div', { class: 'h' }, 'When and where'), el('div', { class: 'group' }, dtRow('Starts', 'start'),
        el('div', { class: 'row' }, el('input', { placeholder: 'Or type: next Friday 7pm', 'aria-label': 'Type a date', onchange: e => { const r = Assist.parseDate(e.target.value); if (r) { ev.start = r.start; if (refs.start) refs.start.value = r.start; e.target.value = ''; change(); toast('Date set'); } else if (e.target.value) toast('Couldn’t read that date'); } })),
        dtRow('Ends', 'end', true), inputRow('Location', 'loc', 'text', { autocomplete: 'off' }),
        el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: async () => { if (!ev.loc.trim()) return toast('Add a location first'); toast('Looking it up…'); ev.geo = null; const ok = await ensureGeo(ev); toast(ok ? 'Found it. Guests get a map and forecast.' : 'Couldn’t find that place'); change(); renderTab(); } }, ev.geo ? 'Update map pin' : 'Find on map'), ev.geo ? el('span', { class: 'val' }, '✓ Located') : null)),
      el('div', { class: 'h' }, 'About'), el('div', { class: 'group' }, el('div', { class: 'row' }, el('textarea', { placeholder: 'Tell guests what to expect', 'aria-label': 'Description', value: ev.desc, oninput: e => { ev.desc = e.target.value; change(); } }))),
      el('div', { class: 'h' }, 'Replies'), el('div', { class: 'group' }, inputRow('Phone or email for replies', 'reply', 'text', { inputmode: 'email', autocomplete: 'off', autocapitalize: 'off' }),
        el('div', { class: 'row' }, el('label', {}, 'Guest limit'), el('input', { type: 'number', min: 0, max: 999, inputmode: 'numeric', placeholder: 'No limit', value: ev.cap || '', 'aria-label': 'Guest limit', style: 'text-align:right', oninput: e => { ev.cap = Math.max(0, parseInt(e.target.value) || 0); change(); } })),
        dtRow('Reply by', 'deadline', true)),
      el('p', { class: 'note' }, 'Replies go to the phone or email above. Leave it empty and guests pick an app from the share sheet. Guests past the limit show as a waitlist on your list.'),
      el('div', { class: 'h' }, 'Bring list'), listGroup(ev.bring, s => s, (i, v) => { ev.bring[i] = v; }, () => ev.bring.push(''), 'Item to bring', 'Add an item'),
      el('p', { class: 'note' }, 'Guests tick what they’ll bring. You see their picks with each reply.'),
      el('div', { class: 'h' }, 'Questions for guests'), listGroup(ev.qs, q => q.q, (i, v) => { ev.qs[i].q = v; }, () => ev.qs.push({ id: Date.now() % 1e6, q: '' }), 'Question', 'Add a question'),
      el('div', { class: 'h' }, 'Extras'), el('div', { class: 'group' }, inputRow('Spotify or Apple Music link', 'music', 'url', { autocapitalize: 'off', autocomplete: 'off' }), inputRow('Shared photo album link', 'album', 'url', { autocapitalize: 'off', autocomplete: 'off' })),
      el('p', { class: 'note' }, 'A playlist plays right on the invite. The album link is a button guests can use during and after the party.')),
    look: () => {
      const wrap = el('div', {}), photoMode = t.k === 'photo', hasPhoto = !!(t.photo || t.hq);
      wrap.append(el('div', { class: 'h' }, 'Background'), seg([['mesh', 'Mesh'], ['linear', 'Gradient'], ['photo', 'Photo']], t.k, v => { t.k = v; change(); renderTab(); }, 'big'));
      if (photoMode) {
        const file = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => {
          const f = e.target.files[0]; if (!f) return;
          try { toast('Shrinking photo…'); const r = await compressImage(f); t.photo = r.url; t.avg = r.avg; t.k = 'photo'; t.pz = [1, 50, 50]; if (!t.b) t.b = 10; t.pinfo = { from: r.from, to: r.bytes, tooBig: r.tooBig }; t.hq = settings.keepHQ ? await makeHQ(f) : undefined; change(); renderTab(); }
          catch (err) { console.error(err); toast('Couldn’t read that photo'); }
        } });
        const info = hasPhoto && t.pinfo ? `The link carries a ${(t.pinfo.to / 1024).toFixed(1)} KB copy (from ${(t.pinfo.from / 1024).toFixed(0)} KB).${t.hq ? ' Your sharp original stays on this device.' : ''}${t.pinfo.tooBig ? ' It’s still large; add a sharp image link below.' : ''}` : (hasPhoto ? 'Photo is saved with the invite.' : 'Pick a photo. A tiny copy goes in the link; your original stays on this device.');
        wrap.append(el('div', { class: 'h' }, 'Photo'), el('div', { class: 'group' },
          el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => file.click() }, hasPhoto ? 'Choose a different photo' : 'Choose photo'), file, hasPhoto ? el('button', { class: 'linkbtn', style: 'margin-left:auto;color:var(--red)', onclick: () => { t.photo = ''; t.hq = undefined; t.pinfo = null; t.avg = 0; t.pz = [1, 50, 50]; change(); renderTab(); } }, 'Remove') : null),
          el('div', { class: 'row' }, el('input', { type: 'url', placeholder: 'Sharp image link (optional)', value: t.url, 'aria-label': 'Sharp image link', autocapitalize: 'off', oninput: e => { t.url = e.target.value.trim(); change(); } })),
          hasPhoto ? slider('Zoom', 1, 3, .01, t.pz[0], v => v.toFixed(2) + '×', v => { t.pz = [v, t.pz[1], t.pz[2]]; change(); }) : null,
          hasPhoto ? slider('Move left or right', 0, 100, 1, t.pz[1], v => v, v => { t.pz = [t.pz[0], v, t.pz[2]]; change(); }) : null,
          hasPhoto ? slider('Move up or down', 0, 100, 1, t.pz[2], v => v, v => { t.pz = [t.pz[0], t.pz[1], v]; change(); }) : null),
          el('p', { class: 'note' }, info + (hasPhoto ? ' You can also drag the invite to reposition the photo.' : '')));
      }
      wrap.append(el('div', { class: 'h' }, photoMode ? 'Fallback colors' : 'Colors'),
        el('div', { class: 'group' }, el('div', { class: 'swatches' }, PRESETS.map(p => el('button', { class: 'sw-p sq' + (p.c.every((c, i) => c === t.c[i]) ? ' on' : ''), style: `background:${meshCss(p.c)}`, 'aria-label': p.n, onclick: () => { t.c = [...p.c]; change(); renderTab(); } }))),
          el('div', { class: 'row' }, el('div', { class: 'colors', style: 'padding:6px 0' }, t.c.map((c, i) => el('input', { type: 'color', value: c, 'aria-label': 'Color ' + (i + 1), oninput: e => { t.c[i] = e.target.value; change(); } })))),
          t.k === 'linear' ? slider('Angle', 0, 360, 1, t.a, v => v + '°', v => { t.a = v; change(); }) : null));
      wrap.append(el('div', { class: 'h' }, 'Finish'), el('div', { class: 'group' },
        slider('Blur', 0, 40, 1, t.b, v => v, v => { t.b = v; change(); }), slider('Tint', -40, 60, 1, t.n, v => (v > 0 ? '+' : '') + v, v => { t.n = v; change(); }), slider('Corner roundness', 0, 56, 1, t.o, v => v, v => { t.o = v; change(); })));
      wrap.append(el('div', { class: 'h' }, 'Font'), el('div', { class: 'group' }, el('div', { class: 'chips' }, Object.entries(FONTS).map(([k, f]) => el('button', { class: 'chip' + (t.f === k ? ' on' : ''), style: `font-family:${f.ff};font-weight:${Math.min(f.fw, 800)};text-transform:${f.tt}`, onclick: () => { t.f = k; change(); renderTab(); } }, f.n)))));
      wrap.append(el('div', { class: 'h' }, 'Layout'), seg([['center', 'Center'], ['left', 'Top left'], ['bottom', 'Bottom']], t.lo, v => { t.lo = v; change(); }, 'big'),
        el('div', { class: 'h' }, 'Text color'), seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], t.tx, v => { t.tx = v; change(); }, 'big'),
        el('div', { class: 'h' }, 'Effect'), seg([['none', 'None'], ['confetti', 'Confetti'], ['snow', 'Snow'], ['shimmer', 'Shimmer']], t.fx, v => { t.fx = v; change(); }, 'big'));
      const saved = settings.presets;
      wrap.append(el('div', { class: 'h' }, 'My looks'), el('div', { class: 'group' }, el('div', { class: 'chips' },
        saved.map((p, i) => el('span', { class: 'chip', style: `background:${meshCss(p.theme.c)};color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.35);padding-right:8px` },
          el('button', { onclick: () => { Object.assign(t, structuredClone(p.theme)); change(); renderTab(); } }, p.name), el('button', { 'aria-label': 'Delete ' + p.name, onclick: () => { saved.splice(i, 1); saveSettings(); renderTab(); } }, ico('x', 14)))),
        el('button', { class: 'chip', onclick: () => { const { k, c, a, b, n, f, tx, fx, o, lo } = t; saved.push({ name: 'Look ' + (saved.length + 1), theme: { k: k === 'photo' ? 'mesh' : k, c: [...c], a, b, n, f, tx, fx, o, lo } }); saveSettings(); toast('Look saved'); renderTab(); } }, ico('plus', 16), 'Save this look'))));
      return wrap;
    },
    stickers: () => {
      const wrap = el('div', {}), st = ev.stickers[sel];
      wrap.append(el('div', { class: 'h' }, 'Add a sticker'), el('div', { class: 'group' }, el('div', { class: 'emoji-grid' }, EMOJI.map(e => el('button', { 'aria-label': 'Add ' + e, onclick: () => { const spots = [[80, 14], [18, 84], [82, 84], [16, 16]], sp = spots[ev.stickers.length % spots.length]; ev.stickers.push({ e, x: sp[0], y: sp[1], s: 20, r: 0 }); sel = ev.stickers.length - 1; change(); renderTab(); } }, e)))));
      if (st) wrap.append(el('div', { class: 'h' }, 'Selected sticker'), el('div', { class: 'group' },
        slider('Size', 6, 60, 1, st.s, v => v, v => { st.s = v; change(); }), slider('Rotation', -180, 180, 1, st.r, v => v + '°', v => { st.r = v; change(); }),
        el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0;color:var(--red)', onclick: () => { ev.stickers.splice(sel, 1); sel = -1; change(); renderTab(); } }, 'Remove sticker'))));
      else wrap.append(el('p', { class: 'note' }, ev.stickers.length ? 'Tap a sticker on the invite to resize or rotate it. Drag to move.' : 'Stickers go on top of your invite. Drag them anywhere.'));
      return wrap;
    },
    assist: () => assistantPanel({ ev, change, reload: () => { renderTab(); } }),
    share: () => {
      const wrap = el('div', {}), lab = el('span', { class: 'val' }, 'Measuring…'), bar_ = el('i'), tip = el('p', { class: 'note' });
      meter = { lab, bar: bar_, tip };
      const needTitle = () => { if (!ev.title.trim()) { toast('Add a title first'); return true; } return false; };
      wrap.append(el('div', { class: 'h' }, 'Link'), el('div', { class: 'group' }, el('div', { class: 'row col' }, el('div', { class: 'top' }, el('span', {}, 'Link size'), lab), el('div', { class: 'meter' }, bar_))), tip,
        el('div', { class: 'stack', style: 'margin-top:20px' },
          el('button', { class: 'btn block', onclick: async () => { if (needTitle()) return; await shareLink(ev); ev.shared = Date.now(); dirty = true; } }, ico('share', 20), 'Share invite'),
          el('div', { class: 'two' }, act('copy', 'Copy link', async () => { await copyText(await buildLink(ev)); toast('Link copied'); }), act('qr', 'QR code', () => openQR(ev))),
          el('div', { class: 'two' }, act('calendar', 'Calendar', () => addToCalendar(ev)), act('image', 'Save image', () => savePosterImage(ev))),
          el('div', { class: 'two' }, act('file', 'AirDrop file', () => exportInviteFile(ev)), act('nearby', 'Nearby', () => openNearby({ ev })))),
        el('p', { class: 'note' }, 'The whole invite lives inside the link, so there’s nothing to upload. A file keeps your full-quality photo. Tap Done to save the invite on this device.'));
      updateMeter(); return wrap;
    }
  };
  async function updateMeter() {
    if (tab !== 'share' || !meter) return;
    try {
      const len = (await buildLink(ev)).length, pct = clamp(len / LINK_OK * 100, 4, 100);
      meter.lab.textContent = (len / 1024).toFixed(1) + ' KB'; meter.bar.style.width = pct + '%';
      meter.bar.style.background = len <= LINK_GOOD ? 'var(--green)' : len <= LINK_OK ? 'var(--orange)' : 'var(--red)';
      meter.tip.textContent = len <= LINK_GOOD ? 'Short enough to paste anywhere.' : len <= LINK_OK ? 'Works in Messages and most apps. Fewer stickers or a smaller photo makes it shorter.' : 'Very long. Some apps may cut it off. Remove the photo or use a sharp image link. A file or Nearby keeps full quality.';
    } catch (e) { meter.lab.textContent = ''; }
  }
  function renderTab() { const st = body.scrollTop; body.replaceChildren(panels[tab]()); body.scrollTop = st; P.poster.style.touchAction = (tab === 'look' && t.k === 'photo' && (t.photo || t.hq)) ? 'none' : ''; }
  renderTab(); paintNow();

  const cancel = async () => { if (dirty && !confirm('Discard your changes?')) return; finished = true; await DB.del('drafts', ev.id); go(orig ? '#/e/' + orig.id : '#/'); };
  const done = async () => {
    if (!ev.title.trim()) { toast('Add a title first'); tab = 'details'; tabs.querySelectorAll('.seg-b')[0].click(); return; }
    finished = true; toast('Saving…');
    if (ev.loc && !ev.geo) await Promise.race([ensureGeo(ev), sleep(3500)]);
    ev.updated = Date.now(); await DB.put('events', ev); await DB.del('drafts', ev.id); navigator.storage?.persist?.();
    go('#/e/' + ev.id);
  };
  view.append(bar({ title: orig ? 'Edit invite' : 'New invite', left: el('button', { class: 'tbtn', onclick: cancel }, 'Cancel'), right: [undoB, redoB, el('button', { class: 'btn sm', onclick: done }, 'Done')] }), stage, sheet_);
  view._mount = () => {
    const ro = new ResizeObserver(() => { view.classList.toggle('split', view.clientWidth >= 860); setSheet(vis || detents()[1], false); });
    ro.observe(view); onLeave(() => ro.disconnect());
    view.classList.toggle('split', view.clientWidth >= 860); setSheet(detents()[1], false); requestAnimationFrame(fit);
  };
  return view;
}
