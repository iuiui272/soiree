'use strict';
/* Assistant.
   Tier 1 (always on, offline, instant): rule-based parsing and writing.
   Tier 2 (optional): Chrome's built-in model, or a small model downloaded to the device with WebGPU.
   Nothing is sent to a server; smart-model downloads come from a public CDN once, then run offline. */
const Assist = (() => {
  const WD = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, weds: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  const MO = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const MON_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  /* ---------- natural dates and times ---------- */
  function parseDate(text, now = new Date()) {
    let s = text, tm = null, date = null, found = false;
    const take = (re, fn) => { const m = re.exec(s); if (!m) return false; if (fn(m) === false) return false; s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length); return true; };
    const base = new Date(now); base.setHours(0, 0, 0, 0);
    const morning = /(morning|brunch|breakfast|coffee)/i.test(text);
    take(/\b(?:at\s+|@\s*)?(noon|midnight)\b/i, m => { tm = m[1].toLowerCase() === 'noon' ? [12, 0] : [0, 0]; });
    if (!tm) take(/\b(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?!\w)/i, m => { if (+m[1] > 12 || +m[1] < 1) return false; tm = [(+m[1] % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0), +(m[2] || 0)]; });
    if (!tm) take(/\b(?:at\s+|@\s*)(\d{1,2}):(\d{2})\b/, m => { if (+m[1] > 23 || +m[2] > 59) return false; tm = [+m[1], +m[2]]; });
    if (!tm) take(/\bat\s+(\d{1,2})(?=\s*(?:ish\b)?\s*(?:[.,;!]|$|\s+(?:on|and|for|in|with|bring)\b))/i, m => { const h = +m[1]; if (h < 1 || h > 12) return false; tm = [h === 12 ? 12 : (morning ? h : h + 12), 0]; });
    take(/\b(?:in the\s+|this\s+)?(morning|afternoon|evening|tonight|night)\b/i, m => {
      const w = m[1].toLowerCase(); if (w === 'tonight') { date = base; found = true; }
      if (!tm) tm = { morning: [10, 0], afternoon: [14, 0], evening: [18, 30], tonight: [20, 0], night: [20, 0] }[w];
    });
    if (take(/\b(day after tomorrow)\b/i, () => { date = addDays(base, 2); })) found = true;
    else if (take(/\b(tomorrow|tmrw)\b/i, () => { date = addDays(base, 1); })) found = true;
    else if (take(/\btoday\b/i, () => { date = base; })) found = true;
    else if (take(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month)s?\b/i, m => {
      const n = isNaN(+m[1]) ? NUMW[m[1].toLowerCase()] : +m[1], u = m[2].toLowerCase(); date = u === 'day' ? addDays(base, n) : u === 'week' ? addDays(base, n * 7) : new Date(base.getFullYear(), base.getMonth() + n, base.getDate());
    })) found = true;
    else if (take(new RegExp(`\\b(${MON_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i'), m => {
      const d = +m[2]; if (d < 1 || d > 31) return false; let y = m[3] ? +m[3] : base.getFullYear(); let x = new Date(y, MO[m[1].slice(0, 3).toLowerCase()], d); if (!m[3] && x < base) x = new Date(y + 1, x.getMonth(), d); date = x;
    })) found = true;
    else if (take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON_RE})\\b`, 'i'), m => {
      const d = +m[1]; if (d < 1 || d > 31) return false; let y = base.getFullYear(), x = new Date(y, MO[m[2].slice(0, 3).toLowerCase()], d); if (x < base) x = new Date(y + 1, x.getMonth(), d); date = x;
    })) found = true;
    else if (take(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/, m => {
      let a = +m[1], b = +m[2]; if (a > 12) [a, b] = [b, a]; if (a < 1 || a > 12 || b < 1 || b > 31) return false;
      let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : base.getFullYear(), x = new Date(y, a - 1, b); if (!m[3] && x < base) x = new Date(y + 1, a - 1, b); date = x;
    })) found = true;
    else if (take(/\b(?:(next|this|on|coming)\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\b/i, m => {
      const dow = WD[m[2].slice(0, 4).toLowerCase()] ?? WD[m[2].slice(0, 3).toLowerCase()];
      let diff = (dow - base.getDay() + 7) % 7; if (diff === 0) diff = 7; date = addDays(base, diff);
    })) found = true;
    if (!date && !tm) return null;
    if (!date) { date = new Date(base); const t0 = new Date(date); t0.setHours(tm[0], tm[1]); if (t0 < now) date = addDays(base, 1); }
    if (!tm) { const k = /breakfast/i.test(text) ? [9, 0] : /brunch/i.test(text) ? [11, 0] : /coffee/i.test(text) ? [10, 0] : /lunch/i.test(text) ? [12, 30] : [19, 0]; tm = k; }
    const d = new Date(date); d.setHours(tm[0], tm[1], 0, 0);
    return { start: toLocal(d), rest: s.replace(/\s+/g, ' ').trim(), foundDate: found, foundTime: true };
  }

  const KEYS = [['birthday', /\b(birthday|bday|turning|\d+(?:st|nd|rd|th))\b/i], ['dinner', /\b(dinner|supper)\b/i], ['game', /\b(game night|board game|trivia|poker)\b/i], ['baby', /\b(baby|shower)\b/i],
    ['wedding', /\b(wedding|engagement|bridal|rehearsal)\b/i], ['house', /\bhousewarming\b/i], ['movie', /\b(movie|film|screening)\b/i], ['pool', /\b(pool|swim|beach)\b/i], ['halloween', /\b(halloween|costume)\b/i],
    ['holiday', /\b(christmas|xmas|holiday|hanukkah|new year)\b/i], ['grad', /\b(graduation|grad)\b/i], ['brunch', /\b(brunch|breakfast)\b/i], ['bbq', /\b(bbq|barbecue|cookout|grill)\b/i],
    ['potluck', /\bpotluck\b/i], ['coffee', /\b(coffee|catch.?up)\b/i], ['dance', /\b(dance|disco|club|rave)\b/i]];
  const guessTemplate = text => { for (const [id, re] of KEYS) if (re.test(text || '')) return id; return null; };
  const titleCase = s => s.replace(/\w\S*/g, (w, i) => (i > 0 && /^(a|an|the|of|and|at|in|on|for|to)$/i.test(w)) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1));

  function interpret(text) {
    const pd = parseDate(text); let rest = pd ? pd.rest : text, loc = '', notes = [];
    rest = rest.replace(/\b(?:please\s+)?(bring\b.*|byob\b.*)$/i, m => { notes.push(m.trim()); return ' '; });
    rest = rest.replace(/\b(?:at|@)\s+([^,.;]+?)(?=\s+(?:on|from|for|with|and|bring|starting)\b|[,.;]|$)/i, (m, p) => { loc = p.trim(); return ' '; });
    if (!loc) rest = rest.replace(/\bin\s+((?:[A-Z][\w'’-]*\s*){1,4})/, (m, p) => { loc = p.trim(); return ' '; });
    let title = rest.replace(/\b(party|event|get-?together)\s*$/i, m => m).replace(/[\s,.;:-]+$/g, '').replace(/^[\s,.;:-]+/, '').replace(/\s+/g, ' ');
    const tid = guessTemplate(text), tpl = tid && findTemplate(tid);
    if (!title || title.length < 2) title = tpl ? tpl.title : '';
    if (title && title === title.toLowerCase()) title = titleCase(title);
    return { title, start: pd && pd.start, loc, notes, templateId: tid, foundDate: !!pd };
  }

  /* ---------- writing ---------- */
  const pick = (a, r) => a[Math.floor(r() * a.length)];
  function context(ev) {
    const [date, time] = whenParts(ev);
    return { t: ev.title || 'our event', host: ev.host, when: date ? date + (time ? ' at ' + time.split(' – ')[0] : '') : '', where: ev.loc, hasBring: (ev.bring || []).length > 0 };
  }
  function describe(ev, tone = 'casual', r = Math.random) {
    const c = context(ev), host = c.host, T = c.t;
    const bank = {
      casual: { o: [`Come hang out for ${T}.`, `${T} is happening and you’re invited.`, `We’re doing ${T} and would love to see you there.`, `Save the date for ${T}.`], c: ['Bring a friend if you like.', 'Let us know if you can make it.', 'Just come as you are.', 'RSVP when you get a chance.'] },
      playful: { o: [`Drop everything. ${T} is on.`, `Warning: ${T} may cause fun.`, `You, us, ${T}. No excuses.`, `${T} is calling and it doesn’t take voicemail.`], c: ['RSVP before we change our minds about the snacks.', 'Gifts are optional. Dance moves are mandatory.', 'Leave the drama at home.', 'Come hungry, leave happy.'] },
      classy: { o: [`You are warmly invited to ${T}.`, `${host ? host + ' requests' : 'We request'} the pleasure of your company at ${T}.`, `Please join us for ${T}.`], c: ['Kindly reply at your earliest convenience.', 'We look forward to celebrating with you.', 'Your presence would mean a great deal.'] }
    }[tone] || {};
    const mid = c.when && c.where ? pick([`It’s ${c.when} at ${c.where}.`, `Find us at ${c.where} on ${c.when}.`], r) : c.when ? `It’s ${c.when}.` : c.where ? `We’ll be at ${c.where}.` : '';
    const extra = c.hasBring ? ' Check the bring list so we don’t double up.' : '';
    return [pick(bank.o, r), mid, pick(bank.c, r) + extra].filter(Boolean).join(' ');
  }
  const TITLE_IDEAS = { birthday: ['{h}’s Birthday Bash', 'Another Trip Around the Sun', 'The Big Birthday', 'Cake, Friends, Chaos'], dinner: ['An Evening at {h}’s', 'Dinner & Conversation', 'Supper Club'], game: ['Game Night', 'Winner Takes All', 'Board Game Showdown'], baby: ['Baby Shower', 'Welcome, Little One', 'Oh Baby!'], wedding: ['The Wedding', 'Two Become One', 'Celebrate With Us'],
    house: ['Housewarming', 'New Place, Same Us', 'Come See the New Place'], movie: ['Movie Night', 'Popcorn & Plot Twists', 'Cinema Night'], pool: ['Pool Party', 'Make a Splash', 'Sun & Splash'], halloween: ['Halloween Party', 'A Night of Tricks and Treats', 'Monster Mash'], holiday: ['Holiday Party', 'Cozy Season Gathering', 'Merry & Bright'],
    grad: ['Graduation Party', 'Cap, Gown, Cake', 'Celebrate the Grad'], brunch: ['Sunday Brunch', 'Brunch & Bubbles', 'Slow Morning'], bbq: ['Backyard BBQ', 'Grill & Chill', 'Smoke & Friends'], potluck: ['Potluck Dinner', 'Bring a Dish', 'Shared Table'], coffee: ['Coffee Catch-up', 'Coffee & Conversation'], dance: ['Dance Night', 'Dance Floor Takeover'] };
  function titles(ev, text = '') {
    const id = ev.template || guessTemplate(ev.title + ' ' + text) || null, h = ev.host || 'Our';
    return (id && TITLE_IDEAS[id] ? TITLE_IDEAS[id] : ['Get-Together', 'A Night In', 'Come Hang Out', 'Open House']).map(s => s.replace('{h}', h));
  }
  const STICKER_KEYS = { birthday: '🎈🎂🎉🥳🎁', dinner: '🍷🍽️🕯️🥂', game: '🎲🃏🧩🏆', baby: '🍼🧸⭐🍼', wedding: '💍🥂💐🕊️', house: '🏡🌿🔑', movie: '🍿🎬🎞️', pool: '🏊☀️🍹🩴', halloween: '🎃👻🦇🕷️', holiday: '🎄🎁❄️⭐', grad: '🎓🎉📜', brunch: '🥐☕🍳🥂', bbq: '🍔🔥🌽🍻', potluck: '🥗🍝🍰', coffee: '☕🥐', dance: '🪩🕺💃🎶' };
  function stickerIdeas(ev) {
    const id = ev.template || guessTemplate(ev.title + ' ' + ev.desc);
    const seg = str => 'Segmenter' in Intl ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].map(x => x.segment) : [...str];
    return [...new Set([...(STICKER_KEYS[id] ? seg(STICKER_KEYS[id]) : []), '✨', '🎉', '💖', '🌈'])].slice(0, 8);
  }
  function lookIdeas(ev) {
    const id = ev.template || guessTemplate(ev.title + ' ' + ev.desc), tpl = id && findTemplate(id), out = [];
    if (tpl) out.push({ name: tpl.name, c: tpl.c, f: tpl.f, lo: tpl.lo, fx: tpl.fx });
    const fonts = ['rounded', 'serif', 'system', 'poster'];
    [...PRESETS].sort(() => Math.random() - .5).slice(0, 4).forEach((p, i) => out.push({ name: p.n, c: p.c, f: fonts[i % fonts.length], lo: ['center', 'left', 'bottom', 'center'][i], fx: 'none' }));
    return out;
  }
  function reminder(ev, kind) {
    const c = context(ev), where = ev.loc ? ` at ${ev.loc}` : '';
    if (kind === 'day') return `${c.t} is tomorrow${where}${c.when ? ' (' + c.when.split(' at ')[1] + ')' : ''}. Can’t wait to see you!`;
    if (kind === 'thanks') return `Thank you for coming to ${c.t}! It meant a lot to have you there.${ev.album ? ' Photos are here: ' + ev.album : ''}`;
    return `Hi! Just a reminder to RSVP for ${c.t}${c.when ? ' on ' + c.when : ''}${where}. Let me know if you can make it!`;
  }
  return { parseDate, interpret, guessTemplate, describe, titles, stickerIdeas, lookIdeas, reminder, titleCase };
})();

/* =====================================================================
   Smart engines + adaptive setup
   ===================================================================== */
const AI = (() => {
  const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm', MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', MODEL_MB = 350;
  const st = { engine: 'rules', offer: null, mbps: null, busy: false, progress: 0, text: '', error: '', ready: false };
  let webllm = null, listeners = new Set();
  const emit = () => listeners.forEach(f => f(st));
  const LM = () => self.LanguageModel;
  const chromeOpts = () => ({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
  async function chromeAvail() { if (!LM()) return 'unavailable'; try { return await LM().availability(chromeOpts()); } catch (e) { try { return await LM().availability(); } catch (e2) { return 'unavailable'; } } }
  async function chromeSession(onProgress) {
    const o = { ...chromeOpts(), initialPrompts: [{ role: 'system', content: 'You write short, warm, natural party invitation text. Reply with only the text asked for.' }], monitor(m) { m.addEventListener('downloadprogress', e => onProgress && onProgress(e.loaded)); } };
    try { return await LM().create(o); } catch (e) { delete o.expectedInputs; delete o.expectedOutputs; return await LM().create(o); }
  }
  const cachedModel = async () => { try { return (await caches.keys()).some(k => k.startsWith('webllm')); } catch (e) { return false; } };
  async function speedTest() {
    try {
      const nc = navigator.connection; if (nc && nc.saveData) return 1;
      const t0 = performance.now(), r = await fetch('icon-512.png?speed=' + Date.now(), { cache: 'no-store' }), b = await r.arrayBuffer(), s = Math.max(.02, (performance.now() - t0) / 1000);
      const measured = b.byteLength * 8 / s / 1e6; return nc && nc.downlink ? Math.max(measured, nc.downlink) : measured;
    } catch (e) { return null; }
  }
  const isCellular = () => { const c = navigator.connection; return !!c && (c.type === 'cellular' || /^(slow-)?2g|3g$/.test(c.effectiveType || '')); };

  async function refresh() {
    if (!st.busy) {
      const ca = await chromeAvail();
      if (ca === 'available') Object.assign(st, { engine: 'chrome', offer: null, ready: true });
      else if (await cachedModel() && navigator.gpu) Object.assign(st, { engine: 'webllm', offer: null, ready: true });
      else if (ca === 'downloadable' || ca === 'downloading') Object.assign(st, { engine: 'rules', offer: { type: 'chrome' }, ready: false });
      else if (navigator.gpu) Object.assign(st, { engine: 'rules', offer: { type: 'webllm' }, ready: false });
      else Object.assign(st, { engine: 'rules', offer: null, ready: false });
    }
    emit(); return st;
  }
  async function download(type) {
    if (st.busy) return; st.busy = true; st.error = ''; st.progress = 0; st.text = 'Starting…'; emit();
    try {
      if (type === 'chrome') { const s = await chromeSession(p => { st.progress = p; st.text = 'Chrome is downloading its on-device model'; emit(); }); s.destroy && s.destroy(); }
      else {
        const mod = await import(WEBLLM);
        webllm = await mod.CreateMLCEngine(MODEL, { initProgressCallback: p => { st.progress = p.progress || 0; st.text = (p.text || '').slice(0, 90); emit(); } });
      }
      st.busy = false; await refresh();
    } catch (e) { console.warn(e); st.busy = false; st.error = 'Couldn’t download the smart assistant. The quick helper still works.'; emit(); }
  }
  /* adaptive: fast connection downloads quietly, slow connection asks first */
  async function autoSetup() {
    await refresh(); if (!st.offer || st.busy) return;
    if (st.offer.type === 'chrome') { if (settings.ai.autoDownload) download('chrome'); return; }
    st.mbps = await speedTest(); st.offer.mb = MODEL_MB; st.offer.mins = st.mbps ? Math.max(1, Math.round(MODEL_MB * 8 / st.mbps / 60)) : null;
    st.offer.fast = !!st.mbps && st.mbps >= 15 && !(settings.ai.wifiOnly && isCellular());
    emit(); if (st.offer.fast && settings.ai.autoDownload) download('webllm');
  }
  async function removeModel() {
    try { for (const k of await caches.keys()) if (k.startsWith('webllm')) await caches.delete(k); } catch (e) {}
    try { webllm && webllm.unload && await webllm.unload(); } catch (e) {} webllm = null; await refresh();
  }
  async function generate(user, max = 200) {
    const sys = 'You write short, warm, natural party invitation text. Reply with only the text asked for.';
    if (st.engine === 'chrome' && LM()) { const s = await chromeSession(); try { return (await s.prompt(user)).trim(); } finally { s.destroy && s.destroy(); } }
    if (st.engine === 'webllm') {
      if (!webllm) { const mod = await import(WEBLLM); webllm = await mod.CreateMLCEngine(MODEL); }
      const r = await webllm.chat.completions.create({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: .8, max_tokens: max });
      return r.choices[0].message.content.trim();
    }
    return null;
  }
  return { st, refresh, download, autoSetup, removeModel, generate, speedTest, cachedModel, MODEL_MB, on: f => { listeners.add(f); return () => listeners.delete(f); } };
})();

/* ---------- editor panel ---------- */
function assistantPanel(ctx) {
  const { ev } = ctx, root = el('div'), results = el('div', { class: 'stack' });
  let tone = 'casual', booted = false;
  const status = el('div'), draftBox = el('textarea', { placeholder: 'Describe your event, like “Maya’s 30th at Rooftop 412 next Saturday 8pm”', 'aria-label': 'Describe your event', rows: 3 });
  const label = () => AI.st.engine === 'chrome' ? 'Smart assistant · Chrome built-in AI' : AI.st.engine === 'webllm' ? 'Smart assistant · on-device model' : 'Quick helper · instant, works offline';
  function drawStatus() {
    const s = AI.st, o = s.offer, kids = [el('div', { class: 'row col' }, el('div', { class: 'top' }, el('b', {}, label()), el('span', { class: 'val' }, s.ready ? 'Ready' : 'Local')),
      el('span', { class: 'sub2' }, s.ready ? 'Everything runs on this device.' : 'Smart writing is optional. The quick helper handles dates, titles and wording.'))];
    if (s.busy) kids.push(el('div', { class: 'row col' }, el('div', { class: 'top' }, el('span', {}, 'Downloading smart assistant'), el('span', { class: 'val' }, Math.round((s.progress || 0) * 100) + '%')), el('div', { class: 'meter' }, el('i', { style: `width:${Math.max(3, (s.progress || 0) * 100)}%` })), el('span', { class: 'sub2' }, s.text || '')));
    else if (o && !s.ready && o.type === 'webllm' && o.fast === false) kids.push(el('div', { class: 'row col' }, el('span', {}, `Your connection looks slow${o.mins ? ` (about ${o.mins} min to download)` : ''}. Use the quick helper, or download the smarter one (about ${o.mb} MB, once).`),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px' }, el('button', { class: 'btn sec sm', onclick: () => { settings.ai.autoDownload = false; saveSettings(); AI.st.offer = null; drawStatus(); } }, 'Keep quick helper'), el('button', { class: 'btn sm', onclick: () => AI.download('webllm') }, 'Download'))));
    else if (o && !s.ready && (o.type === 'chrome' || (o.type === 'webllm' && o.fast === undefined))) kids.push(el('div', { class: 'row' }, el('button', { class: 'linkbtn', style: 'padding:12px 0', onclick: () => AI.download(o.type) }, o.type === 'chrome' ? 'Turn on Chrome’s built-in AI' : 'Download smart assistant')));
    if (s.error) kids.push(el('div', { class: 'row' }, el('span', { style: 'color:var(--red);padding:10px 0;font-size:15px' }, s.error)));
    status.replaceChildren(el('div', { class: 'group' }, kids));
  }
  const off = AI.on(drawStatus); onLeave(off); drawStatus();
  if (!AI.st.booted) { AI.st.booted = true; AI.autoSetup(); }

  const card = (title, body, actions) => el('div', { class: 'group' }, el('div', { class: 'row col' }, title ? el('b', {}, title) : null, body, actions ? el('div', { class: 'chips', style: 'padding:6px 0 0' }, actions) : null));
  const show = nodes => results.replaceChildren(...nodes);
  const useBtn = (label2, fn) => el('button', { class: 'chip on', onclick: fn }, label2);

  async function fill() {
    const text = draftBox.value.trim(); if (!text) return toast('Describe your event first');
    const r = Assist.interpret(text), tpl = r.templateId && findTemplate(r.templateId), fmt = r.start ? new Date(r.start).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date found';
    const rows = [['Title', r.title || '(none)'], ['When', fmt], ['Where', r.loc || 'Not found']].concat(tpl ? [['Design', tpl.name]] : []);
    const apply = withDesign => {
      if (r.title) ev.title = r.title; if (r.start) ev.start = r.start; if (r.loc) ev.loc = r.loc;
      if (r.notes.length && !ev.desc) ev.desc = r.notes.join(' ');
      if (withDesign && tpl) { Object.assign(ev.theme, { k: 'mesh', c: [...tpl.c], f: tpl.f, lo: tpl.lo, fx: tpl.fx }); if (!ev.stickers.length) ev.stickers = (tpl.st || []).map(([e, x, y, s, rr]) => ({ e, x, y, s, r: rr })); if (!ev.bring.length) ev.bring = [...(tpl.bring || [])]; ev.template = tpl.id; }
      ctx.change(); ctx.reload(); toast('Applied');
    };
    show([card('Here’s what I found', el('div', {}, rows.map(([k, v]) => el('div', { class: 'kv' }, el('span', {}, k), el('b', {}, v)))), [useBtn('Apply details', () => apply(false)), tpl ? useBtn('Apply with design', () => apply(true)) : null])]);
  }
  async function write(kind) {
    let text = null, by = 'Quick helper';
    if (AI.st.ready && AI.st.engine !== 'rules') {
      try {
        const c = [ev.title && `Event: ${ev.title}`, ev.host && `Host: ${ev.host}`, ev.loc && `Place: ${ev.loc}`, ev.start && `When: ${whenParts(ev).join(' ')}`].filter(Boolean).join('. ');
        if (kind === 'desc') text = await AI.generate(`Write a ${tone} invitation description of 2 to 3 sentences. ${c}. No hashtags.`);
        if (kind === 'titles') { const t = await AI.generate(`Give 5 short, ${tone} title ideas for this event. One per line, no numbering. ${c}`); text = t && t.split('\n').map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 5); }
        if (text) by = 'Smart assistant';
      } catch (e) { console.warn(e); text = null; }
    }
    if (kind === 'desc') { const v = text || Assist.describe(ev, tone); show([card('Description · ' + by, el('p', { style: 'margin:0;line-height:1.4' }, v), [useBtn('Use', () => { ev.desc = v; ctx.change(); ctx.reload(); toast('Description added'); }), el('button', { class: 'chip', onclick: () => write('desc') }, 'Another')])]); }
    if (kind === 'titles') { const list = text || Assist.titles(ev, draftBox.value); show([card('Title ideas · ' + by, null, list.map(t => el('button', { class: 'chip', onclick: () => { ev.title = t; ctx.change(); ctx.reload(); } }, t)))]); }
    if (kind === 'stickers') show([card('Sticker ideas', null, Assist.stickerIdeas(ev).map(e => el('button', { class: 'chip', style: 'font-size:22px', onclick: () => { const spots = [[80, 14], [18, 84], [82, 84], [16, 16]], sp = spots[ev.stickers.length % 4]; ev.stickers.push({ e, x: sp[0], y: sp[1], s: 20, r: 0 }); ctx.change(); toast('Sticker added'); } }, e)))]);
    if (kind === 'looks') show([card('Look ideas', null, Assist.lookIdeas(ev).map(l => el('button', { class: 'chip', style: `background:${meshCss(l.c)};color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.4)`, onclick: () => { Object.assign(ev.theme, { k: 'mesh', c: [...l.c], f: l.f, lo: l.lo, fx: l.fx }); ctx.change(); } }, l.name)))]);
    if (kind === 'remind') show(['nudge', 'day', 'thanks'].map(k => { const v = Assist.reminder(ev, k), name = { nudge: 'Reply reminder', day: 'Day-before note', thanks: 'Thank-you' }[k]; return card(name, el('p', { style: 'margin:0;line-height:1.4' }, v), [useBtn('Share', async () => { const link = k === 'thanks' ? '' : await buildLink(ev); const t = v + (link ? ' ' + link : ''); if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) {} } else { await copyText(t); toast('Copied'); } }), el('button', { class: 'chip', onclick: async () => { await copyText(v); toast('Copied'); } }, 'Copy')]); }));
  }
  root.append(el('div', { class: 'h' }, 'Assistant'), status,
    el('div', { class: 'h' }, 'Describe it'), el('div', { class: 'group' }, el('div', { class: 'row' }, draftBox)),
    el('div', { class: 'stack', style: 'margin-top:10px' }, el('button', { class: 'btn block', onclick: fill }, ico('wand', 20), 'Fill in my invite')),
    el('div', { class: 'h' }, 'Write for me'), seg([['casual', 'Casual'], ['playful', 'Playful'], ['classy', 'Classy']], tone, v => { tone = v; }, 'big'),
    el('div', { class: 'chips', style: 'padding:12px 0' }, [['desc', 'Description'], ['titles', 'Title ideas'], ['stickers', 'Stickers'], ['looks', 'Looks'], ['remind', 'Reminders']].map(([k, l]) => el('button', { class: 'chip', onclick: () => write(k) }, l))),
    results, el('p', { class: 'note' }, 'You approve everything before it changes your invite. Nothing leaves your device.'));
  return root;
}
