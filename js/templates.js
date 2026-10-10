'use strict';
/* Premade templates: a look, sample wording, stickers, bring-list and guest questions. */
const DIET = 'Any dietary needs?';
const TEMPLATES = [
  { id: 'birthday', name: 'Birthday', cat: 'Party', title: 'Birthday Bash', desc: 'Cake, music and good company. Come celebrate with us!', c: ['#ff9a5a', '#ff5e7e', '#7b5cff'], f: 'rounded', lo: 'center', fx: 'confetti', h: 19, st: [['🎈', 80, 14, 22, 12], ['🎂', 18, 84, 20, -8], ['🎉', 82, 84, 18, 10]] },
  { id: 'dinner', name: 'Dinner party', cat: 'Dinner', title: 'Dinner Party', desc: 'An evening of good food and better conversation.', c: ['#0f172a', '#4338ca', '#be185d'], f: 'serif', lo: 'bottom', fx: 'none', h: 19.5, st: [['🥂', 82, 14, 16, 12]], qs: [DIET] },
  { id: 'game', name: 'Game night', cat: 'Party', title: 'Game Night', desc: 'Bring your competitive side. Snacks and rematches guaranteed.', c: ['#22d3ee', '#a3e635', '#c084fc'], f: 'poster', lo: 'left', fx: 'none', h: 19, st: [['🎲', 82, 14, 20, 14], ['🃏', 16, 86, 16, -12]], bring: ['Snacks', 'Drinks', 'A favorite game'] },
  { id: 'baby', name: 'Baby shower', cat: 'Family', title: 'Baby Shower', desc: 'Join us to celebrate the little one on the way.', c: ['#fbcfe8', '#bae6fd', '#e9d5ff'], f: 'rounded', lo: 'center', fx: 'none', h: 14, st: [['🍼', 80, 14, 18, 10], ['🧸', 18, 84, 20, -8]], qs: [DIET] },
  { id: 'wedding', name: 'Wedding', cat: 'Family', title: 'Our Wedding', desc: 'We would be honored to celebrate with you.', c: ['#fed7aa', '#fda4af', '#fcd34d'], f: 'serif', lo: 'center', fx: 'shimmer', h: 16, tx: 'dark', st: [['💍', 50, 12, 14, 0]], qs: [DIET, 'A song that gets you dancing?'] },
  { id: 'house', name: 'Housewarming', cat: 'Family', title: 'Housewarming', desc: 'Come see the new place. Bring nothing but yourself (and maybe a plant).', c: ['#bef264', '#34d399', '#0f766e'], f: 'rounded', lo: 'left', fx: 'none', h: 18, st: [['🏡', 82, 14, 22, 8], ['🌿', 16, 86, 18, -14]], bring: ['A plant or a bottle'] },
  { id: 'movie', name: 'Movie night', cat: 'Party', title: 'Movie Night', desc: 'Blankets, popcorn and a film everyone argues about afterwards.', c: ['#0f172a', '#312e81', '#1e1b4b'], f: 'mono', lo: 'bottom', fx: 'none', h: 20, st: [['🍿', 80, 14, 20, 10], ['🎬', 18, 84, 16, -8]], bring: ['Snacks'] },
  { id: 'pool', name: 'Pool party', cat: 'Party', title: 'Pool Party', desc: 'Sun, splash and something cold to drink.', c: ['#2dd4bf', '#3b82f6', '#1e1b4b'], f: 'poster', lo: 'center', fx: 'none', h: 14, st: [['🏊', 80, 14, 20, 8], ['☀️', 16, 12, 16, 0], ['🍹', 82, 86, 18, 10]], bring: ['Towel', 'Sunscreen', 'Drinks'] },
  { id: 'halloween', name: 'Halloween', cat: 'Seasonal', title: 'Halloween Party', desc: 'Costumes encouraged. Mild scares, big snacks.', c: ['#f97316', '#7c3aed', '#0f172a'], f: 'poster', lo: 'center', fx: 'shimmer', h: 19, md: [10, 31], st: [['🎃', 80, 14, 22, 10], ['👻', 16, 84, 20, -10], ['🦇', 84, 86, 14, 8]], qs: ['What are you dressing up as?'] },
  { id: 'holiday', name: 'Holiday party', cat: 'Seasonal', title: 'Holiday Party', desc: 'Cozy lights, warm drinks and your favorite people.', c: ['#fb7185', '#be123c', '#4c0519'], f: 'serif', lo: 'center', fx: 'snow', h: 18, md: [12, 20], st: [['🎄', 80, 14, 22, 8], ['🎁', 16, 86, 18, -10]], bring: ['A treat to share'] },
  { id: 'grad', name: 'Graduation', cat: 'Family', title: 'Graduation Party', desc: 'Help us celebrate the big milestone!', c: ['#fde047', '#fb923c', '#f43f5e'], f: 'system', lo: 'center', fx: 'confetti', h: 15, st: [['🎓', 80, 14, 22, 10], ['🎉', 16, 86, 18, -10]] },
  { id: 'brunch', name: 'Brunch', cat: 'Dinner', title: 'Sunday Brunch', desc: 'Slow morning, good coffee, great company.', c: ['#fed7aa', '#fda4af', '#fcd34d'], f: 'rounded', lo: 'left', fx: 'none', h: 11, tx: 'dark', st: [['🥐', 82, 14, 20, 10], ['☕', 16, 86, 18, -8]], qs: [DIET] },
  { id: 'bbq', name: 'Backyard BBQ', cat: 'Dinner', title: 'Backyard BBQ', desc: 'Grill is hot. Bring a side and an appetite.', c: ['#fb923c', '#dc2626', '#7c2d12'], f: 'poster', lo: 'left', fx: 'none', h: 17, st: [['🍔', 82, 14, 20, 10], ['🔥', 16, 86, 18, -8]], bring: ['A side dish', 'Drinks', 'Dessert'] },
  { id: 'potluck', name: 'Potluck', cat: 'Dinner', title: 'Potluck Dinner', desc: 'Everyone brings a dish. Claim yours so we don’t end up with five desserts.', c: ['#bef264', '#fde047', '#fb923c'], f: 'rounded', lo: 'center', fx: 'none', h: 18.5, tx: 'dark', st: [['🥗', 80, 14, 20, 10]], bring: ['Main dish', 'Side dish', 'Dessert', 'Drinks'], qs: [DIET] },
  { id: 'coffee', name: 'Coffee catch-up', cat: 'Dinner', title: 'Coffee Catch-up', desc: 'No agenda. Just coffee and good conversation.', c: ['#e2e8f0', '#94a3b8', '#334155'], f: 'system', lo: 'bottom', fx: 'none', h: 10, st: [['☕', 80, 14, 20, 8]] },
  { id: 'dance', name: 'Dance night', cat: 'Party', title: 'Dance Night', desc: 'Good music, comfortable shoes, zero judgment.', c: ['#f0abfc', '#a78bfa', '#312e81'], f: 'poster', lo: 'center', fx: 'shimmer', h: 21, st: [['🪩', 80, 14, 24, 8], ['🕺', 16, 86, 18, -8], ['💃', 84, 86, 18, 8]] }
];
const TEMPLATE_CATS = ['All', 'Party', 'Dinner', 'Family', 'Seasonal'];
let pendingTemplate;   // undefined = nothing chosen, null = blank, string = template id
const findTemplate = id => TEMPLATES.find(t => t.id === id) || null;

function templateStart(t) {
  const d = new Date(); d.setSeconds(0, 0);
  if (t.md) { d.setMonth(t.md[0] - 1, t.md[1]); if (d < new Date()) d.setFullYear(d.getFullYear() + 1); }
  else d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
  d.setHours(Math.floor(t.h), Math.round((t.h % 1) * 60), 0, 0);
  return toLocal(d);
}
function templateEvent(t) {
  const ev = newEvent(), th = ev.theme;
  ev.title = t.title; ev.desc = t.desc; ev.start = templateStart(t); ev.template = t.id;
  Object.assign(th, { k: 'mesh', c: [...t.c], f: t.f, lo: t.lo, fx: t.fx, tx: t.tx || 'auto' });
  ev.stickers = (t.st || []).map(([e, x, y, s, r]) => ({ e, x, y, s, r }));
  ev.bring = [...(t.bring || [])]; ev.qs = (t.qs || []).map((q, i) => ({ id: i, q }));
  return ev;
}
/* template -> editor */
function startFromTemplate(id, from) { pendingTemplate = id; go('#/new', from); }
function takePendingEvent() { const t = pendingTemplate && findTemplate(pendingTemplate); pendingTemplate = undefined; return t ? templateEvent(t) : newEvent(); }

async function TemplateGallery() {
  let cat = 'All';
  const grid = el('div', { class: 'grid tgrid' });
  const draw = () => {
    const blank = el('button', { class: 'card', onclick: e => startFromTemplate(null, e.currentTarget.querySelector('.pw')) },
      el('div', { class: 'pw blankcard' }, el('div', { class: 'poster blank sq' }, ico('plus', 34))), el('div', { class: 'cap' }, el('b', {}, 'Blank invite'), 'Start from scratch'));
    const list = TEMPLATES.filter(t => cat === 'All' || t.cat === cat);
    grid.replaceChildren(blank, ...list.map(t => {
      const ev = templateEvent(t); ev.host = ''; ev.start = '';
      const P = mkPoster(ev, { mini: true });
      return el('button', { class: 'card', onclick: () => startFromTemplate(t.id, P.wrap) }, P.wrap, el('div', { class: 'cap' }, el('b', {}, t.name), t.cat));
    }));
  };
  const chips = el('div', { class: 'chips hscroll', style: 'padding:0 0 4px' }, TEMPLATE_CATS.map(c => el('button', { class: 'chip' + (c === cat ? ' on' : ''), onclick: e => { cat = c; chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === e.currentTarget)); draw(); } }, c)));
  draw();
  const sentinel = el('h1', { class: 'large' }, 'Choose a design');
  const b = bar({ title: 'Choose a design', left: compactBack(), right: [] });
  const view = el('div', { class: 'view' }, b, el('div', { class: 'wrap' }, sentinel, el('p', { class: 'sub' }, 'Pick a starting point. You can change everything.'), chips, grid));
  view._mount = () => collapseOnScroll(b, sentinel);
  return view;
}
