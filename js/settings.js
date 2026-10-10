'use strict';
/* Bottom sheets / dialogs, action menus, Settings (with profile, assistant, storage, developer). */
function sheet(title, { height, onClose } = {}) {
  const scrim = el('div', { class: 'scrim' }), card = el('div', { class: 'modal-card' + (height === 'auto' ? ' auto' : ''), role: 'dialog', 'aria-label': title }), body = el('div', { class: 'modal-body' });
  if (height && height !== 'auto') card.style.height = height;
  let closed = false;
  const close = () => { if (closed) return; closed = true; scrim.classList.remove('in'); card.classList.remove('in'); card.style.transform = ''; onClose && onClose(); setTimeout(() => { scrim.remove(); card.remove(); }, 650); };
  card._close = close; scrim.onclick = close;
  const head = el('div', { class: 'modal-head' }, el('span', { class: 'mh-l' }), el('h2', {}, title), el('button', { class: 'tbtn b mh-r', onclick: close }, 'Done'));
  let y0 = null;
  head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; try { head.setPointerCapture(e.pointerId); } catch (x) {} card.style.transition = 'none'; });
  head.addEventListener('pointermove', e => { if (y0 != null) card.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  head.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; card.style.transition = ''; if (dy > 110) close(); else card.style.transform = ''; });
  card.append(el('div', { class: 'grab', style: 'margin:8px auto 0' }), head, body); document.body.append(scrim, card);
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('in'); card.classList.add('in'); }));
  return { body, close, card, head, setTitle: t => { head.querySelector('h2').textContent = t; } };
}
function openMenu(title, items) {
  const s = sheet(title, { height: 'auto' });
  s.body.append(el('div', { class: 'group', style: 'margin-top:6px' }, items.map(it => el('button', { class: 'row menu-row' + (it.danger ? ' danger' : ''), onclick: () => { s.close(); setTimeout(it.fn, 160); } }, ico(it.icon, 20), el('span', {}, it.label)))));
  return s;
}

/* ---------- Settings ---------- */
function openSettings() {
  let unsub = () => {}, page = 'main', taps = 0, tapT = 0;
  const s = sheet('Settings', { height: 'min(92dvh,860px)', onClose: () => unsub() }), body = s.body;
  unsub = AI.on(() => { if (page === 'main') drawAssistRow(); });
  const row = (label, ctrl) => el('div', { class: 'row' }, el('span', {}, label), el('span', { style: 'margin-left:auto' }, ctrl));
  const lrow = (label, val, id) => el('div', { class: 'row' }, el('span', {}, label), el('span', { class: 'val', id }, val));
  const dot = c => el('i', { class: 'dot', style: `background:${c}` });
  let assistRow = null;
  function drawAssistRow() {
    if (!assistRow) return; const st = AI.st;
    assistRow.replaceChildren(el('span', {}, 'Engine'), el('span', { class: 'val' }, st.busy ? `Downloading ${Math.round(st.progress * 100)}%` : st.engine === 'chrome' ? 'Chrome built-in AI' : st.engine === 'webllm' ? 'On-device model' : 'Quick helper'));
  }
  function back() { page = 'main'; draw(); }
  function drawProfile() {
    const a = settings.avatar, prev = el('div', { class: 'pv' }); s.setTitle('Profile');
    s.head.querySelector('.mh-l').replaceChildren(el('button', { class: 'tbtn', onclick: back }, '‹ Settings'));
    const refresh = () => { prev.replaceChildren(avatarEl(96)); saveSettings(); drawSidebar(); };
    const colors = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30b158', '#00b5a5', '#8e8e93'];
    const kind = seg([['initials', 'Initials'], ['emoji', 'Emoji'], ['photo', 'Photo']], a.kind, v => { a.kind = v; saveSettings(); drawProfile(); });
    const kids = [el('div', { class: 'pvwrap' }, prev), el('div', { class: 'h' }, 'Name'),
      el('div', { class: 'group' }, el('div', { class: 'row' }, el('input', { placeholder: 'Your name', value: settings.name, 'aria-label': 'Your name', autocomplete: 'name', oninput: e => { settings.name = e.target.value; refresh(); } }))),
      el('p', { class: 'note' }, 'Used for “Hosted by” on new invites and for your replies.'), el('div', { class: 'h' }, 'Picture'), kind];
    kids.push(el('div', { class: 'group', style: 'margin-top:12px' }, el('div', { class: 'accents' }, colors.map(c => el('button', { class: a.color === c ? 'on' : '', style: `background:${c};color:${c}`, 'aria-label': c, onclick: () => { a.color = c; refresh(); drawProfile(); } })))));
    if (a.kind === 'emoji') kids.push(el('div', { class: 'group', style: 'margin-top:12px' }, el('div', { class: 'emoji-grid' }, ['🙂', '😎', '🥳', '🦄', '🐶', '🐱', '🦊', '🐼', '🌸', '🌈', '🎧', '🏄', '🎨', '🍕', '🚀', '⭐', '🎸', '🧁'].map(e => el('button', { 'aria-label': e, onclick: () => { a.emoji = e; refresh(); } }, e)))));
    if (a.kind === 'photo') {
      const file = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; try { const r = await compressImage(f, 9000); a.photo = r.url; refresh(); } catch (x) { toast('Couldn’t read that photo'); } } });
      kids.push(el('div', { class: 'group', style: 'margin-top:12px' }, el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => file.click() }, a.photo ? 'Choose a different photo' : 'Choose a photo'), file, a.photo ? el('button', { class: 'linkbtn', style: 'margin-left:auto;color:var(--red)', onclick: () => { a.photo = ''; refresh(); drawProfile(); } }, 'Remove') : null)));
    }
    body.replaceChildren(...kids); refresh();
  }
  function drawMain() {
    s.setTitle('Settings'); s.head.querySelector('.mh-l').replaceChildren();
    const r = settings.ring, m = islandModel(), kids = [];
    /* profile */
    kids.push(el('button', { class: 'group profilecard', onclick: () => { page = 'profile'; draw(); } }, el('div', { class: 'row', style: 'min-height:72px' }, avatarEl(52), el('span', { style: 'display:grid;gap:2px' }, el('b', { style: 'font-weight:600' }, settings.name || 'Add your name'), el('small', { style: 'color:var(--label2)' }, 'Profile picture and name')), el('span', { class: 'chev', style: 'margin-left:auto' }, '›'))));
    /* appearance */
    kids.push(el('div', { class: 'h' }, 'Appearance'), seg([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], settings.theme, v => { settings.theme = v; saveSettings(); applyTheme(); }, 'big'));
    kids.push(el('div', { class: 'h' }, 'Accent color'), el('div', { class: 'group' }, el('div', { class: 'accents' },
      ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30b158', '#00b5a5', '#8e8e93'].map(c => el('button', { class: settings.accent === c ? 'on' : '', style: `background:${c};color:${c}`, 'aria-label': c, onclick: () => { settings.accent = c; saveSettings(); applyTheme(); applyRing(); draw(); } })),
      el('input', { type: 'color', value: settings.accent, 'aria-label': 'Custom accent', oninput: e => { settings.accent = e.target.value; saveSettings(); applyTheme(); applyRing(); } }))));
    kids.push(el('div', { class: 'h' }, 'Accessibility'), el('div', { class: 'group' },
      row('Reduce transparency', toggle(settings.solid, v => { settings.solid = v; saveSettings(); applyTheme(); })),
      row('Reduce motion', toggle(settings.motion, v => { settings.motion = v; saveSettings(); applyTheme(); })),
      row('Tilt effects with motion sensors', toggle(settings.tilt, async v => {
        if (v && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') { try { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') { v = false; toast('Motion access was declined'); } } catch (e) { v = false; } }
        settings.tilt = v; saveSettings(); if (!v) draw();
      }))));
    /* assistant */
    assistRow = el('div', { class: 'row' }); drawAssistRow();
    const ai = settings.ai, st = AI.st;
    kids.push(el('div', { class: 'h' }, 'Assistant'), el('div', { class: 'group' }, assistRow,
      row('Download smart assistant automatically', toggle(ai.autoDownload, v => { ai.autoDownload = v; saveSettings(); })),
      row('Only on Wi-Fi when I can tell', toggle(ai.wifiOnly, v => { ai.wifiOnly = v; saveSettings(); })),
      st.ready && st.engine === 'webllm' ? el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0;color:var(--red)', onclick: async () => { await AI.removeModel(); toast('Model removed'); draw(); } }, 'Remove downloaded model')) :
        st.offer && !st.busy ? el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => AI.download(st.offer.type) }, 'Download smart assistant now')) : null),
      el('p', { class: 'note' }, 'The quick helper always works offline. The smart assistant runs fully on this device after a one-time download. On Chrome it uses the built-in model.'));
    AI.refresh();
    /* island */
    kids.push(el('div', { class: 'h' }, 'Dynamic Island outline'));
    const mock = el('div', { class: 'mock' }, el('div', { class: pillCls() })), redrawMock = () => { mock.querySelector('.island')?.remove(); if (r.on) { const n = ringNode(r, 126, 37, r.w); n.style.top = (18 - r.w + 1) + 'px'; mock.append(n); } }; redrawMock();
    kids.push(el('div', { class: 'group' }, mock,
      row('Show outline', toggle(r.on, v => { r.on = v; saveSettings(); applyRing(); redrawMock(); })),
      el('div', { class: 'row' }, el('span', { class: 'lab' }, 'Style'), el('div', { style: 'margin-left:auto;width:230px' }, seg([['color', 'Color'], ['rainbow', 'Rainbow'], ['aurora', 'Aurora']], r.style, v => { r.style = v; saveSettings(); applyRing(); redrawMock(); draw(); }))),
      r.style === 'color' ? row('Color', el('input', { type: 'color', value: r.color || settings.accent, 'aria-label': 'Outline color', oninput: e => { r.color = e.target.value; saveSettings(); applyRing(); redrawMock(); } })) : null,
      row('Animate', toggle(r.anim, v => { r.anim = v; saveSettings(); applyRing(); redrawMock(); })),
      slider('Thickness', 1.5, 6, .5, r.w, v => v + ' pt', v => { r.w = v; saveSettings(); applyRing(); redrawMock(); }),
      m ? slider('Nudge up or down', -6, 6, .5, r.dy, v => v, v => { r.dy = v; saveSettings(); applyRing(); }) : null,
      m ? slider('Size', .9, 1.2, .01, r.sc, v => Math.round(v * 100) + '%', v => { r.sc = v; saveSettings(); applyRing(); }) : null));
    kids.push(el('p', { class: 'note' }, m ? `Found a Dynamic Island screen (${screenKey().replace('x', ' × ')}: ${m.name}).${STANDALONE || SIM ? '' : ' The outline appears when Soirée is opened from the Home Screen.'} Positions are approximate; use the sliders to line it up.`
      : `No Dynamic Island found on this device (screen ${screenKey().replace('x', ' × ')}). The preview shows your style; it appears on supported iPhones when opened from the Home Screen.`));
    /* storage */
    kids.push(el('div', { class: 'h' }, 'Storage'), el('div', { class: 'group' },
      lrow('Used on this device', '…', 'st-use'), lrow('Available to Soirée', '…', 'st-quota'), lrow('Protected from clearing', '…', 'st-per'),
      row('Keep full-quality photos', toggle(settings.keepHQ, v => { settings.keepHQ = v; saveSettings(); })),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: async () => { const ok = navigator.storage && navigator.storage.persist && await navigator.storage.persist(); toast(ok ? 'Storage is protected' : 'The browser didn’t grant that yet'); draw(); } }, 'Ask to keep my data')),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: async () => { let n = 0; for (const e of await DB.all('events')) if (e.archived && e.theme.hq) { n += e.theme.hq.size; delete e.theme.hq; await DB.put('events', e); } toast(n ? `Freed ${Math.round(n / 1024)} KB` : 'Nothing to free up'); draw(); } }, 'Free up space from archived invites'))),
      el('p', { class: 'note' }, 'Soirée keeps your original photos on this device and puts only a tiny copy in the link. Installed from the Home Screen, the browser allows a large share of free disk.'));
    (async () => {
      const set = (id, t) => { const n = $('#' + id); if (n) n.textContent = t; }, fmt = b => b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(1) + ' GB';
      try { const e = await navigator.storage.estimate(); set('st-use', fmt(e.usage || 0)); set('st-quota', e.quota ? fmt(e.quota) : 'Unknown'); } catch (x) { set('st-use', 'Unknown'); set('st-quota', 'Unknown'); }
      try { set('st-per', (await navigator.storage.persisted()) ? 'Yes' : 'Not yet'); } catch (x) { set('st-per', 'Unknown'); }
    })();
    /* backup */
    kids.push(el('div', { class: 'h' }, 'Backup and moving phones'), el('div', { class: 'group' },
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => exportAllFile() }, 'Export everything')),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: pickAndImport }, 'Import a .soiree file')),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => { s.close(); setTimeout(() => openNearby({ all: true }), 200); } }, 'Send everything to a new phone')),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0;color:var(--red)', onclick: async () => { if (!confirm('Erase every invite and reply on this device?')) return; for (const x of ['events', 'received', 'replies', 'drafts']) await DB.clear(x); toast('Erased'); s.close(); render(); } }, 'Erase everything'))));
    /* device + developer */
    const devRow = el('div', { class: 'row', role: 'button', tabindex: 0, onclick: () => {
      const now = Date.now(); taps = now - tapT > 1800 ? 1 : taps + 1; tapT = now;
      if (settings.dev) return toast('Developer menu is already on');
      if (taps >= 5) { settings.dev = true; saveSettings(); toast('Developer menu unlocked'); draw(); } else if (taps >= 3) toast(`${5 - taps} more tap${5 - taps > 1 ? 's' : ''} to unlock developer menu`);
    } }, el('span', {}, 'Device'), el('span', { class: 'val' }, DEVICE + (IPAD || IPHONE ? '' : '')));
    kids.push(el('div', { class: 'h' }, 'This device'), el('div', { class: 'group' }, devRow,
      lrow('Installed as app', STANDALONE ? 'Yes' : 'No'), lrow('Screen', `${document.documentElement.clientWidth} × ${innerHeight} pt · ${L.mode}`), DB.mem ? el('div', { class: 'row' }, el('span', { style: 'color:var(--red)' }, 'Private mode: invites won’t be kept')) : null));
    if (settings.dev) kids.push(el('div', { class: 'h' }, 'Developer'), el('div', { class: 'group' },
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0', onclick: () => { s.close(); setTimeout(openEmulator, 250); } }, 'Emulate a device…')),
      row('Show layout size on screen', toggle(settings.devOverlay, v => { settings.devOverlay = v; saveSettings(); devBadge(); })),
      el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:14px 0;color:var(--red)', onclick: () => { settings.dev = false; settings.devOverlay = false; saveSettings(); devBadge(); draw(); } }, 'Hide developer menu'))));
    body.replaceChildren(...kids);
  }
  function pillCls() { return 'pill'; }
  function draw() { const st = body.scrollTop; page === 'profile' ? drawProfile() : drawMain(); body.scrollTop = st; }
  draw();
  return s;
}
