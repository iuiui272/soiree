'use strict';
/* Nearby share (Snapdrop-style, no server of ours).
   Two phones meet through a 4-digit code on a free public MQTT-over-WebSocket relay, only to swap
   connection details. The invite itself then travels directly phone-to-phone over WebRTC.
   The sender must approve each device that asks to connect, and the receiver approves what arrives. */
const NEARBY_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

class MiniMqtt {
  constructor(url) { this.url = url; this.handlers = []; this.buf = new Uint8Array(0); this.enc = new TextEncoder(); this.dec = new TextDecoder(); }
  str(s) { const b = this.enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
  rem(n) { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; }
  pkt(first, body) { const h = [first, ...this.rem(body.length)], out = new Uint8Array(h.length + body.length); out.set(h); out.set(body, h.length); return out; }
  connect() {
    return new Promise((res, rej) => {
      let done = false; const ws = this.ws = new WebSocket(this.url, 'mqtt'); ws.binaryType = 'arraybuffer';
      const fail = e => { if (!done) { done = true; clearTimeout(to); try { ws.close(); } catch (x) {} rej(e); } };
      const to = setTimeout(() => fail(new Error('timeout')), 7000);
      ws.onopen = () => ws.send(this.pkt(0x10, new Uint8Array([...this.str('MQTT'), 4, 2, 0, 30, ...this.str('soiree-' + Math.random().toString(36).slice(2, 10))])));
      ws.onmessage = e => this.feed(new Uint8Array(e.data), () => { if (!done) { done = true; clearTimeout(to); this.ping = setInterval(() => { try { ws.send(new Uint8Array([0xC0, 0])); } catch (x) {} }, 20000); res(); } });
      ws.onerror = () => fail(new Error('ws error')); ws.onclose = () => { this.closed = true; fail(new Error('closed')); };
    });
  }
  feed(chunk, onConnack) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    for (;;) {
      if (this.buf.length < 2) return;
      let len = 0, mul = 1, i = 1, c;
      do { if (i >= this.buf.length) return; c = this.buf[i++]; len += (c & 127) * mul; mul *= 128; } while (c & 128);
      if (this.buf.length < i + len) return;
      const first = this.buf[0], body = this.buf.slice(i, i + len); this.buf = this.buf.slice(i + len);
      const type = first >> 4;
      if (type === 2) { if (body[1] === 0) onConnack(); }
      else if (type === 3) {
        const tl = (body[0] << 8) | body[1], topic = this.dec.decode(body.subarray(2, 2 + tl)), qos = (first >> 1) & 3, off = 2 + tl + (qos ? 2 : 0);
        const text = this.dec.decode(body.subarray(off)); this.handlers.forEach(h => h(topic, text));
      }
    }
  }
  subscribe(topic) { this.ws.send(this.pkt(0x82, new Uint8Array([0, 1, ...this.str(topic), 0]))); }
  publish(topic, text) { const t = this.str(topic), p = this.enc.encode(text), body = new Uint8Array(t.length + p.length); body.set(t); body.set(p, t.length); this.ws.send(this.pkt(0x30, body)); }
  on(h) { this.handlers.push(h); }
  close() { clearInterval(this.ping); try { this.ws.close(); } catch (e) {} }
}
async function nearbyBroker() {
  const urls = QS.get('broker') ? [QS.get('broker')] : NEARBY_BROKERS;
  for (const u of urls) { try { const m = new MiniMqtt(u); await m.connect(); return m; } catch (e) { console.warn('broker failed', u); } }
  throw new Error('Couldn’t reach the nearby service. Use AirDrop or the share sheet instead.');
}
const CHUNK = 12000;
async function sendChunks(dc, text) {
  const n = Math.ceil(text.length / CHUNK); dc.send(JSON.stringify({ k: 'meta', n }));
  for (let i = 0; i < n; i++) { while (dc.bufferedAmount > 1e6) await sleep(30); dc.send('c:' + text.slice(i * CHUNK, (i + 1) * CHUNK)); }
}

/* sender: wait for a device that knows the code, ask permission, send */
async function nearbySend(code, payloadText, ui) {
  const mq = await nearbyBroker(), me = uid(), topic = 'soiree/v1/' + code; let pc = null, peer = null, stopped = false; const pend = [];
  const say = (k, to, d) => mq.publish(topic, JSON.stringify({ f: me, t: to, k, d }));
  const stop = () => { stopped = true; try { pc && pc.close(); } catch (e) {} mq.close(); };
  mq.on(async (tp, text) => {
    if (tp !== topic || stopped) return; let m; try { m = JSON.parse(text); } catch (e) { return; } if (m.f === me) return;
    if (m.k === 'hello' && !peer) {
      peer = m.f; ui.status('A device wants to connect…');
      if (!(await ui.confirm(m.d && m.d.n || 'A nearby device'))) { peer = null; ui.status('Declined. Waiting for another device…'); return; }
      ui.status('Connecting…'); pc = new RTCPeerConnection(ICE); const dc = pc.createDataChannel('soiree');
      pc.onicecandidate = e => { if (e.candidate) say('ice', peer, e.candidate); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') ui.error('Couldn’t connect directly. Try the same Wi-Fi, or use AirDrop.'); };
      dc.onopen = async () => { ui.status('Sending…'); try { await sendChunks(dc, payloadText); } catch (e) { ui.error('Sending failed.'); } };
      dc.onmessage = e => { try { const r = JSON.parse(e.data); if (r.k === 'ok') { ui.done(true); setTimeout(stop, 500); } if (r.k === 'no') { ui.done(false); setTimeout(stop, 500); } } catch (x) {} };
      await pc.setLocalDescription(await pc.createOffer()); say('offer', peer, pc.localDescription);
    } else if (m.t === me && pc) {
      if (m.k === 'answer') { await pc.setRemoteDescription(m.d); pend.splice(0).forEach(c => pc.addIceCandidate(c).catch(() => {})); }
      if (m.k === 'ice') { if (pc.remoteDescription) pc.addIceCandidate(m.d).catch(() => {}); else pend.push(m.d); }
    }
  });
  mq.subscribe(topic); ui.status('Waiting for the other device…');
  return stop;
}
/* receiver: announce, then answer the sender's offer and collect the payload */
async function nearbyReceive(code, ui) {
  const mq = await nearbyBroker(), me = uid(), topic = 'soiree/v1/' + code; let pc = null, peer = null, stopped = false, parts = [], need = 0, hello = 0; const pend = [];
  const say = (k, to, d) => mq.publish(topic, JSON.stringify({ f: me, t: to, k, d }));
  const stop = () => { stopped = true; clearInterval(hello); try { pc && pc.close(); } catch (e) {} mq.close(); };
  mq.on(async (tp, text) => {
    if (tp !== topic || stopped) return; let m; try { m = JSON.parse(text); } catch (e) { return; } if (m.f === me || m.t !== me) return;
    if (m.k === 'offer') {
      clearInterval(hello); peer = m.f; ui.status('Connecting…'); pc = new RTCPeerConnection(ICE);
      pc.onicecandidate = e => { if (e.candidate) say('ice', peer, e.candidate); };
      pc.ondatachannel = ev => {
        const dc = ev.channel;
        dc.onmessage = async e => {
          if (typeof e.data !== 'string') return;
          if (e.data.startsWith('c:')) { parts.push(e.data.slice(2)); ui.status(`Receiving… ${Math.round(parts.length / need * 100)}%`); }
          else { try { const h = JSON.parse(e.data); if (h.k === 'meta') { need = h.n; parts = []; } } catch (x) {} }
          if (need && parts.length === need) {
            const full = parts.join(''); need = 0; parts = [];
            let ok = false; try { ok = await ui.onPayload(JSON.parse(full)); } catch (x) { ui.error('That didn’t look like a Soirée invite.'); }
            dc.send(JSON.stringify({ k: ok ? 'ok' : 'no' })); setTimeout(stop, 800);
          }
        };
      };
      await pc.setRemoteDescription(m.d); pend.splice(0).forEach(c => pc.addIceCandidate(c).catch(() => {}));
      await pc.setLocalDescription(await pc.createAnswer()); say('answer', peer, pc.localDescription);
    } else if (m.k === 'ice' && pc) { if (pc.remoteDescription) pc.addIceCandidate(m.d).catch(() => {}); else pend.push(m.d); }
    else if (m.k === 'ice') pend.push(m.d);
  });
  mq.subscribe(topic); let tries = 0;
  const hi = () => { say('hello', null, { n: settings.name || DEVICE }); if (++tries > 15 && !peer) { clearInterval(hello); ui.error('No device answered. Check the code and try again.'); } };
  hello = setInterval(hi, 2000); await sleep(150); hi(); ui.status('Looking for the sender…');
  return stop;
}
async function backupJSON() {
  const events = await Promise.all((await DB.all('events')).map(serEvent));
  const received = await Promise.all((await DB.all('received')).map(async r => ({ ...r, ev: await serEvent(r.ev) })));
  return JSON.stringify({ soiree: 2, type: 'backup', events, received, replies: await DB.all('replies') });
}

/* ---------- UI ---------- */
function openNearby(opts = {}) {
  const { ev, all } = opts; let stopFn = null, mode = (ev || all) ? 'send' : 'receive';
  const s = sheet('Nearby', { height: 'min(86dvh,640px)', onClose: () => { stopFn && stopFn(); } });
  const body = s.body;
  function draw() {
    stopFn && stopFn(); stopFn = null;
    const status = el('p', { class: 'nb-status', 'aria-live': 'polite' }, ''), area = el('div');
    const tabs = (ev || all) ? seg([['send', 'Send'], ['receive', 'Receive']], mode, v => { mode = v; draw(); }, 'big') : null;
    body.replaceChildren(tabs, area, status, el('p', { class: 'note' }, 'Nearby uses a free public relay only to introduce the two phones. The invite itself goes straight between them.'));
    const ui = { status: t => { status.textContent = t; status.classList.remove('err'); }, error: t => { status.textContent = t; status.classList.add('err'); } };
    if (mode === 'send') {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      area.append(el('div', { class: 'nb-code', 'aria-label': 'Share code ' + code.split('').join(' ') }, code), el('p', { class: 'nb-help' }, 'On the other device open Soirée, tap Nearby, choose Receive, and enter this code.'));
      (async () => {
        try {
          const text = all ? await backupJSON() : JSON.stringify({ soiree: 2, type: 'invite', ev: await serEvent(ev) });
          stopFn = await nearbySend(code, text, { ...ui,
            confirm: name => new Promise(res => { const b = el('div', { class: 'nb-ask' }, el('p', {}, `“${name}” wants to receive ${all ? 'everything' : 'this invite'}.`), el('div', { class: 'two' }, el('button', { class: 'btn sec', onclick: () => { b.remove(); res(false); } }, 'Decline'), el('button', { class: 'btn', onclick: () => { b.remove(); res(true); } }, 'Send'))); area.append(b); }),
            done: ok => { ui.status(ok ? 'Sent. They saved it.' : 'They declined it.'); if (ok) toast('Sent'); } });
        } catch (e) { ui.error(e.message); }
      })();
    } else {
      const inp = el('input', { class: 'nb-input', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, placeholder: '0000', 'aria-label': '4-digit code', autocomplete: 'off' });
      const go2 = el('button', { class: 'btn block', disabled: true }, 'Connect');
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); go2.disabled = inp.value.length !== 4; });
      area.append(el('p', { class: 'nb-help' }, 'Ask the sender for their 4-digit code.'), inp, el('div', { class: 'stack', style: 'margin-top:12px' }, go2));
      go2.onclick = async () => {
        go2.disabled = true; inp.disabled = true;
        try {
          stopFn = await nearbyReceive(inp.value, { ...ui,
            onPayload: payload => new Promise(res => {
              const what = payload.type === 'invite' ? `“${payload.ev.title || 'An invite'}”` : 'a full backup';
              const b = el('div', { class: 'nb-ask' }, el('p', {}, `Save ${what}?`), el('div', { class: 'two' }, el('button', { class: 'btn sec', onclick: () => { b.remove(); res(false); ui.status('Declined.'); } }, 'Decline'),
                el('button', { class: 'btn', onclick: async () => { b.remove(); try { const r = await importPayload(payload, { settings: false }); res(true); toast(r.kind === 'invite' ? 'Saved to Received' : 'Backup restored'); s.close(); if (r.kind === 'invite') go('#/v/' + r.ev.id); else render(); } catch (e) { res(false); ui.error('Couldn’t save that.'); } } }, 'Save')));
              area.append(b);
            }) });
        } catch (e) { ui.error(e.message); go2.disabled = false; inp.disabled = false; }
      };
      setTimeout(() => inp.focus(), 400);
    }
  }
  draw();
}
