/* 공통 코드: 데이터 계층(Firebase / 데모), 대기 계산, 소리·알림 유틸 */
(function (g) {
'use strict';
const CFG = Object.assign({firebase:null, masterPin:'0000', maxActivePerVisitor:3, siteTitle:'축제 부스 줄서기'}, g.QUEUE_CONFIG || {});

/* ---------- 유틸 ---------- */
const $ = (s, el) => (el || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
function toast(msg){
  let el = $('#toast');
  if (!el){ el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2800);
}
function cyrb53(str, seed){
  let h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
  for (let i = 0; i < str.length; i++){ const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hashPin = pin => String(cyrb53('queue-pin:' + String(pin).trim()));
function clientId(){
  try {
    let id = localStorage.getItem('queue.cid');
    if (!id){ id = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('queue.cid', id); }
    return id;
  } catch(e){ return 'c' + Math.random().toString(36).slice(2, 10); }
}

/* ---------- 대기 계산 ---------- */
const LV = {
  ok:{t:'여유', c:'ok'}, busy:{t:'보통', c:'busy'}, full:{t:'혼잡', c:'full'},
  paused:{t:'접수 중지', c:'off'}, closed:{t:'운영 종료', c:'off'}
};
const est = (m, idx) => Math.ceil(idx / m.cap) * m.avg;
function derive(booths, tickets){
  const d = {};
  booths.forEach(b => { d[b.id] = {b, all:[], waiting:[], called:[], done:0, cap:1, avg:5, waitMin:0, level:'ok'}; });
  tickets.slice().sort((a, b) => ((a.no || 0) - (b.no || 0)) || ((a.createdAt || 0) - (b.createdAt || 0))).forEach(t => {
    const m = d[t.boothId]; if (!m) return;
    m.all.push(t);
    if (t.status === 'waiting') m.waiting.push(t);
    else if (t.status === 'called') m.called.push(t);
    else if (t.status === 'done') m.done++;
  });
  Object.keys(d).forEach(id => {
    const m = d[id], b = m.b;
    m.cap = Math.max(1, +b.capacity || 1);
    m.avg = Math.max(1, +b.avgMin || 5);
    m.waitMin = est(m, m.waiting.length);
    m.level = b.status === 'closed' ? 'closed' : b.status === 'paused' ? 'paused' : m.waitMin <= 10 ? 'ok' : m.waitMin <= 25 ? 'busy' : 'full';
  });
  return d;
}
function orderedBooths(d, sort){
  const arr = Object.keys(d).map(k => d[k]);
  const base = (a, b) => ((a.b.createdAt || 0) - (b.b.createdAt || 0)) || String(a.b.name).localeCompare(String(b.b.name), 'ko');
  if (sort === 'wait'){
    const rank = m => (m.level === 'closed' ? 2 : m.level === 'paused' ? 1 : 0);
    return arr.sort((a, b) => rank(a) - rank(b) || a.waitMin - b.waitMin || a.waiting.length - b.waiting.length || base(a, b));
  }
  return arr.sort(base);
}
function etaBig(m){
  if (m.level === 'closed') return '<span class="big word">종료</span>';
  if (m.level === 'paused') return '<span class="big word">접수 중지</span>';
  if (m.waitMin === 0) return '<span class="big word">바로 입장</span>';
  return '<span class="big">' + m.waitMin + '<small>분</small></span>';
}
function rowHtml(m, mine){
  const b = m.b, lv = LV[m.level], open = m.level !== 'closed' && m.level !== 'paused';
  const eta = !open ? lv.t : (m.waitMin === 0 ? '바로 입장' : '약 ' + m.waitMin + '<small>분</small>');
  const cta = mine ? '<span class="cta mine">내 번호 #' + mine.no + '</span>' : open ? '<span class="cta">줄서기</span>' : '<span class="cta off">' + lv.t + '</span>';
  return '<button class="row ' + lv.c + '" data-act="booth" data-id="' + esc(b.id) + '">' +
    '<span class="r-top"><span class="r-name">' + esc(b.name) + '</span><span class="chip ' + lv.c + '">' + lv.t + '</span></span>' +
    ((b.desc || b.loc) ? '<span class="r-meta">' + esc(b.desc || '') + (b.loc ? '<span class="loc">위치 ' + esc(b.loc) + '</span>' : '') + '</span>' : '') +
    '<span class="r-bottom"><span class="r-stat"><i>대기</i><b>' + m.waiting.length + '<small>팀</small></b></span>' +
    '<span class="r-stat"><i>예상 대기</i><b class="lv">' + eta + '</b></span>' + cta + '</span></button>';
}
function pinHtml(m){
  const b = m.b, lv = LV[m.level];
  return '<button class="pin ' + lv.c + '" style="left:' + b.x + '%;top:' + b.y + '%" data-act="booth" data-id="' + esc(b.id) + '" aria-label="' + esc(b.name) + ' 대기 ' + m.waiting.length + '팀">' +
    '<span class="dot">' + (m.level === 'closed' ? '–' : m.waiting.length) + '</span><span class="lbl">' + esc(b.name) + '</span></button>';
}
function liveInfoHtml(m){
  const lv = LV[m.level];
  return '<div class="livebox"><div><b>' + m.waiting.length + '팀</b><span>지금 대기</span></div><div><b>' +
    (m.level === 'closed' ? '종료' : m.level === 'paused' ? '중지' : m.waitMin === 0 ? '바로' : '약 ' + m.waitMin + '분') + '</b><span>새로 줄 서면</span></div></div>' +
    '<span class="chip ' + lv.c + '">' + lv.t + '</span>';
}

/* ---------- 소리·알림 ---------- */
let actx = null, flashTimer = null, origTitle = null;
function unlockAudio(){
  try { actx = actx || new (g.AudioContext || g.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch(e){}
}
function beep(freqs){
  try {
    unlockAudio(); if (!actx) return;
    const t0 = actx.currentTime;
    (freqs || [880, 1175]).forEach((f, i) => {
      const o = actx.createOscillator(), gn = actx.createGain(), t = t0 + i * 0.22;
      o.type = 'sine'; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.28, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(gn); gn.connect(actx.destination); o.start(t); o.stop(t + 0.22);
    });
  } catch(e){}
}
function flashTitle(msg){
  if (document.visibilityState === 'visible' && document.hasFocus && document.hasFocus()) return;
  if (flashTimer) return;
  origTitle = document.title; let on = false;
  flashTimer = setInterval(() => { on = !on; document.title = on ? msg : origTitle; }, 900);
  const stop = () => { if (!flashTimer) return; clearInterval(flashTimer); flashTimer = null; document.title = origTitle; };
  document.addEventListener('visibilitychange', stop, {once:true}); g.addEventListener('focus', stop, {once:true});
}
document.addEventListener('pointerdown', unlockAudio, {once:true});

/* ---------- 데이터 계층 ---------- */
const SAMPLES = [
  {name:'컴퓨터 동아리 Ctrl+C', desc:'반도체 공정 시뮬레이터 체험', loc:'컴퓨터실', avgMin:6, capacity:2, x:24, y:26, q:3},
  {name:'과학 실험 부스', desc:'슬라임과 정전기 실험', loc:'과학실', avgMin:5, capacity:3, x:72, y:22, q:7},
  {name:'보드게임 카페', desc:'친구랑 한 판', loc:'본관 2층', avgMin:15, capacity:2, x:50, y:50, q:2},
  {name:'방탈출', desc:'10분 안에 탈출하기', loc:'체육관 옆', avgMin:12, capacity:1, x:80, y:68, q:5},
  {name:'떡볶이 가게', desc:'매콤달콤 분식', loc:'운동장', avgMin:4, capacity:4, x:26, y:72, q:0}
];
const DEMO_PIN = '1111';
const toList = v => Object.keys(v || {}).map(id => Object.assign({id}, v[id]));
function loadScript(src){
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s);
  });
}

function firebaseData(){
  let db = null;
  const onErrGlobal = [];
  return {
    mode:'firebase',
    async init(){
      if (!g.firebase){
        const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
        await loadScript(base + 'firebase-app-compat.js');
        await loadScript(base + 'firebase-database-compat.js');
      }
      if (!g.firebase.apps || !g.firebase.apps.length) g.firebase.initializeApp(CFG.firebase);
      db = g.firebase.database();
    },
    onBooths(cb, err){ const r = db.ref('booths'); const f = s => cb(toList(s.val())); r.on('value', f, err); return () => r.off('value', f); },
    onTickets(cb, err){ const r = db.ref('tickets'); const f = s => cb(toList(s.val())); r.on('value', f, err); return () => r.off('value', f); },
    onConnection(cb){ const r = db.ref('.info/connected'); const f = s => cb(!!s.val()); r.on('value', f); return () => r.off('value', f); },
    async saveBooth(id, data){
      if (id){ await db.ref('booths/' + id).update(data); return id; }
      const ref = db.ref('booths').push(); await ref.set(data); return ref.key;
    },
    async deleteBooth(id, ticketIds){
      const up = {}; up['booths/' + id] = null; up['counters/' + id] = null; up['pins/' + id] = null;
      (ticketIds || []).forEach(t => { up['tickets/' + t] = null; });
      await db.ref().update(up);
    },
    async getPinHash(id){ const s = await db.ref('pins/' + id).once('value'); return s.val(); },
    async setPinHash(id, h){ await db.ref('pins/' + id).set(h); },
    async addTicket(boothId, data){
      const r = await db.ref('counters/' + boothId).transaction(n => (n || 0) + 1);
      if (!r.committed) throw new Error('counter');
      const no = r.snapshot.val();
      const ref = db.ref('tickets').push();
      await ref.set(Object.assign({}, data, {boothId, no, status:'waiting', createdAt:g.firebase.database.ServerValue.TIMESTAMP}));
      return {id:ref.key, no};
    },
    async updateTicket(id, patch){ await db.ref('tickets/' + id).update(patch); }
  };
}

function demoData(){
  const KEY = 'queue.demo.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch(e){ return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} };
  function seed(){
    const s = {booths:{}, tickets:{}, counters:{}, pins:{}}, now = Date.now();
    SAMPLES.forEach((x, i) => {
      const id = 'b' + (i + 1);
      s.booths[id] = {name:x.name, desc:x.desc, loc:x.loc, avgMin:x.avgMin, capacity:x.capacity, x:x.x, y:x.y, status:'open', createdAt:now - 100000 + i};
      s.pins[id] = hashPin(DEMO_PIN); s.counters[id] = x.q;
      for (let k = 0; k < x.q; k++) s.tickets['t' + id + k] = {boothId:id, no:k + 1, name:'손님' + (k + 1), size:1 + (k % 3), status:'waiting', createdAt:now - (x.q - k) * 90000, walkin:true};
    });
    return s;
  }
  let st = load() || seed(); save();
  const subs = {booths:new Set(), tickets:new Set()};
  const emit = () => { subs.booths.forEach(f => f(toList(st.booths))); subs.tickets.forEach(f => f(toList(st.tickets))); };
  const sync = () => { st = load() || st; };
  g.addEventListener('storage', e => { if (e.key === KEY){ st = load() || st; emit(); } });
  const sub = (set, getter) => (cb) => { set.add(cb); setTimeout(() => cb(getter()), 0); return () => set.delete(cb); };
  return {
    mode:'demo',
    async init(){},
    onBooths:sub(subs.booths, () => toList(st.booths)),
    onTickets:sub(subs.tickets, () => toList(st.tickets)),
    onConnection(cb){ setTimeout(() => cb(true), 0); return () => {}; },
    async saveBooth(id, data){
      sync();
      if (id){ st.booths[id] = Object.assign({}, st.booths[id], data); }
      else { id = 'b' + Math.random().toString(36).slice(2, 8); st.booths[id] = data; }
      save(); emit(); return id;
    },
    async deleteBooth(id){
      sync(); delete st.booths[id]; delete st.counters[id]; delete st.pins[id];
      Object.keys(st.tickets).forEach(k => { if (st.tickets[k].boothId === id) delete st.tickets[k]; });
      save(); emit();
    },
    async getPinHash(id){ sync(); return st.pins[id] || null; },
    async setPinHash(id, h){ sync(); st.pins[id] = h; save(); },
    async addTicket(boothId, data){
      sync(); const no = (st.counters[boothId] || 0) + 1; st.counters[boothId] = no;
      const id = 't' + Math.random().toString(36).slice(2, 9);
      st.tickets[id] = Object.assign({}, data, {boothId, no, status:'waiting', createdAt:Date.now()});
      save(); emit(); return {id, no};
    },
    async updateTicket(id, patch){ sync(); if (st.tickets[id]) st.tickets[id] = Object.assign({}, st.tickets[id], patch); save(); emit(); }
  };
}

async function qrSvg(text, cell){
  if (!g.qrcode) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
  const qr = g.qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({cellSize:cell || 4, margin:0, scalable:true});
}
const pageUrl = (file, qs) => { try { return new URL(file + (qs || ''), location.href).href; } catch(e){ return file; } };

const useFb = !!(CFG.firebase && CFG.firebase.databaseURL && CFG.firebase.apiKey);
const Data = useFb ? firebaseData() : demoData();

g.Q = {CFG, SAMPLES, DEMO_PIN, $, esc, toast, hashPin, clientId, LV, est, derive, orderedBooths, etaBig, rowHtml, pinHtml, liveInfoHtml, qrSvg, pageUrl, beep, unlockAudio, flashTitle, loadScript, Data};
})(window);
