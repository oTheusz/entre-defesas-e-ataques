import { createStore, uid } from './store.js';
import { PERICIAS, ZONAS, FORMACOES, ESTILOS, CONDICOES, ATIVIDADES, LOCAIS, posicaoFormacao, estadoInicial, recursosIniciais } from './data.js';

// ================= util =================
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat(Infinity)) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const put = (box, ...k) => box.replaceChildren(...k.flat(Infinity).filter(x => x != null && x !== false));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const sign = n => (n > 0 ? `+${n}` : `${n}`);
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function throttle(fn, ms) {
  let last = 0, timer = null, args = null;
  return (...a) => {
    args = a; const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
    else if (!timer) timer = setTimeout(() => { timer = null; last = Date.now(); fn(...args); }, ms - (now - last));
  };
}

// ================= estado =================
const S = {
  store: null, room: null, code: null, role: null, gmPass: null,
  me: { id: null, name: '' }, player: null,
  matches: [], match: null, tokens: new Map(), players: [], rolls: [],
  secrets: {}, selected: null, lastRoll: null,
  opts: { zonas: true, cds: false, nomes: true, inverter: false, impedimento: false, ...lsGet('eda-opts', {}) },
  arrowMode: false, arrowTipo: 'passe', drawingArrow: null,
  mode: 'campo', periods: [], selLocal: null,
  tab: 'partida', live: null, drag: null, liveTok: new Map(), liveBall: null,
};
const isGM = () => S.role === 'gm';
const clientId = (() => { let id = lsGet('eda-client', null); if (!id) { id = uid(); lsSet('eda-client', id); } return id; })();

// ================= campo =================
const FX = 20, FY = 20, FW = 640, FH = 1010;
const toPx = (x, y) => {
  if (S.opts.inverter) { x = 1 - x; y = 1 - y; }
  return [FX + x * FW, FY + y * FH];
};
const fromPx = (px, py) => {
  let x = clamp((px - FX) / FW, 0, 1), y = clamp((py - FY) / FH, 0, 1);
  if (S.opts.inverter) { x = 1 - x; y = 1 - y; }
  return [x, y];
};

function drawPitch() {
  const svg = $('#field'); svg.innerHTML = '';
  const g = s('g', { id: 'pitch' });
  const stripes = 12;
  for (let i = 0; i < stripes; i++) {
    g.append(s('rect', { x: 0, y: (1050 / stripes) * i, width: 680, height: 1050 / stripes + 1, fill: i % 2 ? '#2a7036' : '#2e7a3c' }));
  }
  const L = { fill: 'none', stroke: '#fff', 'stroke-width': 3, opacity: .92 };
  g.append(s('rect', { x: FX, y: FY, width: FW, height: FH, ...L }));
  g.append(s('line', { x1: FX, y1: FY + FH / 2, x2: FX + FW, y2: FY + FH / 2, ...L }));
  g.append(s('circle', { cx: 340, cy: FY + FH / 2, r: 91.5, ...L }));
  g.append(s('circle', { cx: 340, cy: FY + FH / 2, r: 4, fill: '#fff' }));
  for (const top of [true, false]) {
    const y0 = top ? FY : FY + FH, d = top ? 1 : -1;
    const bw = 403, bh = 165, sw = 183, sh = 55;
    g.append(s('rect', { x: 340 - bw / 2, y: top ? y0 : y0 - bh, width: bw, height: bh, ...L }));
    g.append(s('rect', { x: 340 - sw / 2, y: top ? y0 : y0 - sh, width: sw, height: sh, ...L }));
    g.append(s('circle', { cx: 340, cy: y0 + d * 110, r: 4, fill: '#fff' }));
    const a = 91.5, cy = y0 + d * 110, yy = y0 + d * bh, dx = Math.sqrt(a * a - (bh - 110) ** 2);
    g.append(s('path', { d: `M ${340 - dx} ${yy} A ${a} ${a} 0 0 ${top ? 0 : 1} ${340 + dx} ${yy}`, ...L }));
    g.append(s('rect', { x: 340 - 37, y: top ? y0 - 14 : y0, width: 74, height: 14, fill: 'rgba(255,255,255,.35)', stroke: '#fff', 'stroke-width': 2 }));
  }
  const defs = s('defs', {},
    s('marker', { id: 'ah-passe', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#fff' })),
    s('marker', { id: 'ah-corrida', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#ffd600' })));
  svg.append(defs, g, s('g', { id: 'zones' }), s('g', { id: 'offside' }), s('g', { id: 'arrows' }), s('g', { id: 'tokens' }), s('g', { id: 'ballg' }));
  svg.addEventListener('pointerdown', e => {
    if (e.target.closest('.tok') || e.target.closest('#ball')) return;
    if (S.arrowMode && S.match) { startArrow(e); return; }
    if (S.selected) { S.selected = null; renderTokens(); renderTab(); }
  });
}

function renderZones() {
  const g = $('#zones'); g.innerHTML = '';
  if (!S.opts.zonas) return;
  const zw = FW / 3, zh = FH / 3;
  ZONAS.forEach((z, r) => {
    for (let c = 0; c < 3; c++) {
      const x = FX + c * zw, y = FY + r * zh;
      g.append(s('rect', { x: x + 6, y: y + 6, width: zw - 12, height: zh - 12, rx: 6, fill: 'rgba(0,0,0,.14)', stroke: 'rgba(255,255,255,.7)', 'stroke-width': 2, 'stroke-dasharray': '10 8' }));
      if (S.opts.cds) {
        g.append(s('text', { x: x + zw / 2, y: y + zh / 2 + 6, 'text-anchor': 'middle', class: 'zone-cd' }, `CD ${z.cds[c]}`));
        g.append(s('text', { x: x + zw / 2, y: y + zh / 2 + 32, 'text-anchor': 'middle', class: 'zone-nm' }, z.nomes[c]));
      }
    }
  });
  const st = S.match?.state;
  const up = S.opts.inverter ? st?.away?.name : st?.home?.name;
  g.append(s('text', { x: FX + 6, y: 14, 'text-anchor': 'start', class: 'zone-nm', style: 'font-size:12px' }, `▲ ataque de ${up || '—'}`));
  renderArrows();
}

function tokenPos(t) {
  const lv = S.liveTok.get(t.id);
  return lv ? [lv.x, lv.y] : [t.x, t.y];
}
const hiddenForMe = t => !isGM() && t.team === 'away' && S.match?.state?.fog;
const onField = t => !t.bench;
const canMoveToken = t => isGM() || (t.owner && t.owner === S.me.id);
const canEditToken = t => isGM() || (t.owner && t.owner === S.me.id);
const tokR = t => (t.important ? 30 : 21);

function renderTokens() {
  const g = $('#tokens'); if (!g) return;
  const seen = new Set();
  const list = [...S.tokens.values()].filter(t => onField(t) && !hiddenForMe(t)).sort((a, b) => (a.important - b.important));
  for (const t of list) {
    seen.add(t.id);
    let el = g.querySelector(`[data-id="${t.id}"]`);
    const key = JSON.stringify([t.team, t.number, t.name, t.photo, t.owner, t.important, t.res, S.selected === t.id, S.opts.nomes, S.me.id, !!S.match?.state?.fog]);
    if (!el || el.dataset.key !== key) {
      const n = buildToken(t); n.dataset.key = key;
      if (el) el.replaceWith(n); else g.append(n);
      el = n;
    }
    const [x, y] = tokenPos(t), [px, py] = toPx(x, y);
    el.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
    el.style.opacity = isGM() && t.team === 'away' && S.match?.state?.fog ? .45 : '';
  }
  g.querySelectorAll('.tok').forEach(el => { if (!seen.has(el.dataset.id)) el.remove(); });
  // importantes por cima
  list.filter(t => t.important).forEach(t => { const el = g.querySelector(`[data-id="${t.id}"]`); if (el) g.append(el); });
  renderBall(); renderOffside(); renderBench();
}

function buildToken(t) {
  const r = tokR(t), home = t.team === 'home';
  const mine = t.owner && t.owner === S.me.id;
  const g = s('g', { class: 'tok' + (canMoveToken(t) ? '' : ' locked'), 'data-id': t.id });
  if (S.selected === t.id) g.append(s('circle', { r: r + 9, fill: 'none', stroke: '#4fc3f7', 'stroke-width': 4, 'stroke-dasharray': '7 5' }));
  if (mine) g.append(s('circle', { r: r + 4, fill: 'none', stroke: '#e8b100', 'stroke-width': 3 }));
  g.append(s('circle', { r, fill: home ? '#111' : '#fff', stroke: home ? '#fff' : '#111', 'stroke-width': 3 }));
  if (t.important && t.photo) {
    const cid = 'c' + t.id.replace(/[^a-z0-9]/gi, '');
    g.append(s('clipPath', { id: cid }, s('circle', { r: r - 2 })));
    g.append(s('image', { href: t.photo, x: -r, y: -r, width: r * 2, height: r * 2, 'clip-path': `url(#${cid})`, preserveAspectRatio: 'xMidYMid slice' }));
    g.append(s('circle', { cx: r * .72, cy: r * .72, r: 12, fill: home ? '#111' : '#fff', stroke: home ? '#fff' : '#111', 'stroke-width': 2 }));
    g.append(s('text', { x: r * .72, y: r * .72 + 6, 'text-anchor': 'middle', class: 'tok-num', style: 'font-size:15px', fill: home ? '#fff' : '#111' }, t.number));
  } else {
    g.append(s('text', { y: 8, 'text-anchor': 'middle', class: 'tok-num', fill: home ? '#fff' : '#111', style: t.important ? 'font-size:26px' : '' }, t.number));
  }
  const res = t.res || {};
  if (res.vermelho) g.append(s('rect', { x: r * .45, y: -r - 6, width: 11, height: 15, fill: '#c62828', stroke: '#fff', 'stroke-width': 1.5 }));
  else if (res.amarelo > 0) g.append(s('rect', { x: r * .45, y: -r - 6, width: 11, height: 15, fill: '#ffd600', stroke: '#111', 'stroke-width': 1.5 }));
  if (res.condicao && res.condicao !== '—') {
    g.append(s('text', { x: -r - 2, y: -r + 2, 'text-anchor': 'end', class: 'tok-label', style: 'font-size:13px;fill:#ffd600' }, res.condicao));
  }
  let ly = r + 20;
  if (t.important && res.folegoMax > 0) {
    const w = 52, p = clamp(res.folego / res.folegoMax, 0, 1);
    g.append(s('rect', { x: -w / 2, y: r + 5, width: w, height: 6, fill: 'rgba(0,0,0,.55)', stroke: '#fff', 'stroke-width': 1 }));
    g.append(s('rect', { x: -w / 2, y: r + 5, width: w * p, height: 6, fill: p > .35 ? '#fff' : '#ff7043' }));
    ly += 9;
  }
  if (S.opts.nomes && t.name) g.append(s('text', { y: ly, 'text-anchor': 'middle', class: 'tok-label' }, t.name));
  g.addEventListener('pointerdown', e => startDrag(e, 'tok', t.id));
  g.addEventListener('touchstart', e => { if (canMoveToken(t)) e.preventDefault(); }, { passive: false });
  return g;
}

function ballPos() {
  const b = S.liveBall || S.match?.state?.ball || { x: .5, y: .5, holder: null };
  if (b.holder && S.tokens.has(b.holder) && !(S.drag && S.drag.kind === 'ball')) {
    const t = S.tokens.get(b.holder); const [x, y] = tokenPos(t); const r = tokR(t);
    const [px, py] = toPx(x, y);
    return { px: px + r * .85, py: py - r * .85, holder: b.holder };
  }
  const [px, py] = toPx(b.x, b.y);
  return { px, py, holder: b.holder };
}
const canMoveBall = () => {
  if (isGM()) return true;
  const h0 = S.match?.state?.ball?.holder; const t = h0 && S.tokens.get(h0);
  return !!(t && t.owner === S.me.id);
};
function renderBall() {
  const g = $('#ballg'); if (!g || !S.match) return;
  let el = $('#ball');
  if (!el) {
    el = s('g', { id: 'ball', class: 'tok' });
    el.append(s('circle', { r: 11, fill: '#fff', stroke: '#111', 'stroke-width': 2.5 }));
    el.append(s('path', { d: 'M0 -5 L4.8 -1.5 L3 4 L-3 4 L-4.8 -1.5 Z', fill: '#111' }));
    el.addEventListener('pointerdown', e => startDrag(e, 'ball'));
    el.addEventListener('touchstart', e => { if (canMoveBall()) e.preventDefault(); }, { passive: false });
    g.append(el);
  }
  el.classList.toggle('locked', !canMoveBall());
  const { px, py } = S.drag && S.drag.kind === 'ball' ? S.drag.cur : ballPos();
  el.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
}

function svgPoint(e) {
  const svg = $('#field'); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

const sendLive = throttle(p => S.live && S.live.send(p), 50);

function startDrag(e, kind, id) {
  e.stopPropagation();
  const allowed = kind === 'ball' ? canMoveBall() : canMoveToken(S.tokens.get(id));
  const p0 = svgPoint(e);
  S.drag = { kind, id, start: p0, moved: false, allowed, cur: kind === 'ball' ? ballPos() : null };
  const el = e.currentTarget; el.setPointerCapture(e.pointerId);
  if (allowed) el.classList.add('drag');
  const move = ev => {
    if (!S.drag) return;
    const p = svgPoint(ev);
    if (Math.hypot(p.x - p0.x, p.y - p0.y) > 4) S.drag.moved = true;
    if (!S.drag.allowed || !S.drag.moved) return;
    const px = clamp(p.x, FX, FX + FW), py = clamp(p.y, FY, FY + FH);
    if (kind === 'tok') {
      const [x, y] = fromPx(px, py);
      S.liveTok.set(id, { x, y }); renderTokens();
      sendLive({ t: 'tok', id, x, y });
    } else {
      S.drag.cur = { px, py };
      const [x, y] = fromPx(px, py);
      renderBall(); sendLive({ t: 'ball', x, y, holder: null });
    }
  };
  const up = async ev => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    el.classList.remove('drag');
    const d = S.drag; S.drag = null;
    if (!d) return;
    if (!d.moved) {
      if (kind === 'tok') { S.selected = id; renderTokens(); setTab('token'); }
      else renderBall();
      return;
    }
    if (!d.allowed) return;
    if (kind === 'tok') {
      const lv = S.liveTok.get(id); const t = S.tokens.get(id);
      if (lv && t) { t.x = lv.x; t.y = lv.y; }
      try { await S.store.update('tokens', id, { x: lv.x, y: lv.y }); } catch (err) { toast('Não salvou: ' + err.message); }
      S.liveTok.delete(id); renderTokens();
    } else {
      const { px, py } = d.cur;
      let best = null, bd = 46;
      for (const t of S.tokens.values()) {
        const [tx, ty] = toPx(...tokenPos(t)); const dd = Math.hypot(tx - px, ty - py);
        if (dd < bd) { bd = dd; best = t; }
      }
      const [x, y] = fromPx(px, py);
      const ball = { x, y, holder: best ? best.id : null };
      sendLive({ t: 'ball', ...ball });
      S.liveBall = null;
      await saveState({ ball });
      renderBall();
    }
  };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

function onLive(p) {
  if (!p) return;
  if (p.t === 'tok') {
    if (S.drag && S.drag.kind === 'tok' && S.drag.id === p.id) return;
    S.liveTok.set(p.id, { x: p.x, y: p.y }); renderTokens();
    clearTimeout(onLive['_' + p.id]);
    onLive['_' + p.id] = setTimeout(() => { S.liveTok.delete(p.id); renderTokens(); }, 4000);
  } else if (p.t === 'ball') {
    S.liveBall = { x: p.x, y: p.y, holder: p.holder || null }; renderBall();
    clearTimeout(onLive._b); onLive._b = setTimeout(() => { S.liveBall = null; renderBall(); }, 4000);
  }
}

// ================= partida =================
async function saveState(patch) {
  if (!S.match) return;
  const st = { ...S.match.state, ...patch };
  S.match.state = st;
  renderScore(); renderZones(); renderBall();
  try { await S.store.update('matches', S.match.id, { state: st }); } catch (e) { toast('Não salvou: ' + e.message); }
}

function renderScore() {
  const st = S.match?.state; const bar = $('#scorebar');
  if (!st) { bar.innerHTML = ''; return; }
  const m = st.momento || 0;
  const momTxt = m === 0 ? 'equilibrado' : `${m > 0 ? st.home.name : st.away.name} ${sign(Math.abs(m))}`;
  bar.replaceChildren(
    h('div', { class: 'sb-team home' }, h('span', { class: 'nm' }, st.home.name)),
    h('div', { class: 'sb-score' }, h('span', {}, st.score.home), '×', h('span', {}, st.score.away)),
    h('div', { class: 'sb-team away' }, h('span', { class: 'nm' }, st.away.name)),
    h('div', { class: 'sb-meta' }, h('span', {}, `Bloco ${st.bloco} · ${(st.bloco - 1) * 15}'–${st.bloco * 15}'`), h('span', {}, `Momento: ${momTxt}`),
      (() => { const o = ordemAtual(st); const v = o && o.lista.find(x => !x.feito && x.total != null); return v ? h('span', { class: 'sb-vez' }, `Lance: ${v.name}`) : null; })()),
  );
}

function stepper(value, min, max, onChange, enabled) {
  const out = h('output', {}, value);
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', disabled: !enabled || value <= min, onclick: () => onChange(value - 1), 'aria-label': 'menos' }, '−'),
    out,
    h('button', { type: 'button', disabled: !enabled || value >= max, onclick: () => onChange(value + 1), 'aria-label': 'mais' }, '+'));
}

function renderPartida() {
  const box = $('#tab-partida');
  const st = S.match?.state;
  if (!st) { put(box, h('div', { class: 'empty' }, isGM() ? 'Crie uma partida na aba Mestre.' : 'O mestre ainda não abriu uma partida.')); return; }
  const gm = isGM();
  const team = side => {
    const T = st[side];
    const name = gm ? h('input', { value: T.name, onchange: e => saveState({ [side]: { ...st[side], name: e.target.value || (side === 'home' ? 'Casa' : 'Fora') } }) }) : h('b', {}, T.name);
    const secret = !gm && side === 'away' && st.fog;
    const form = h('select', { disabled: !gm, onchange: e => saveState({ [side]: { ...st[side], formation: e.target.value } }) },
      secret ? h('option', {}, '???') : Object.keys(FORMACOES).map(f => h('option', { value: f, selected: f === T.formation }, f)));
    const style = h('select', { disabled: !gm, onchange: e => saveState({ [side]: { ...st[side], style: e.target.value } }) },
      secret ? h('option', {}, '???') : ESTILOS.map(f => h('option', { value: f, selected: f === T.style }, f === '—' ? 'Sem estilo' : f)));
    return h('div', { class: 'sec' },
      h('div', { class: 'sec-t' }, side === 'home' ? 'Time da casa' : 'Visitante', h('span', { class: 'muted' }, secret ? '' : (FORMACOES[T.formation]?.nota || ''))),
      name,
      h('div', { class: 'grid2' }, h('label', {}, 'Formação', form), h('label', {}, 'Estilo', style)),
      gm && side === 'away' ? h('label', { class: 'tg' }, h('input', { type: 'checkbox', checked: !!st.fog, onchange: e => saveState({ fog: e.target.checked }) }), h('span', {}, 'Esconder dos jogadores (até o Duelo Tático)')) : null,
      !gm && side === 'away' && st.fog ? h('p', { class: 'muted' }, 'Formação escondida pelo mestre.') : null,
      gm ? h('div', { class: 'grid2' },
        h('button', { class: 'btn btn-sm', onclick: () => aplicarFormacao(side, 'saida') }, 'Posicionar: saída'),
        h('button', { class: 'btn btn-sm', onclick: () => aplicarFormacao(side, 'jogo') }, 'Posicionar: em jogo')) : null,
      gm ? h('div', { class: 'grid2' },
        h('button', { class: 'btn btn-sm', onclick: () => empurrarTime(side, 1) }, '▲ Avançar o time'),
        h('button', { class: 'btn btn-sm', onclick: () => empurrarTime(side, -1) }, '▼ Recuar o time')) : null,
    );
  };
  const m = st.momento || 0;
  put(box, 
    ordemSec(st, gm),
    h('div', { class: 'sec' },
      h('div', { class: 'sec-t' }, 'Placar'),
      h('div', { class: 'grid2' },
        h('label', {}, st.home.name, stepper(st.score.home, 0, 99, v => saveState({ score: { ...st.score, home: v } }), gm)),
        h('label', {}, st.away.name, stepper(st.score.away, 0, 99, v => saveState({ score: { ...st.score, away: v } }), gm))),
    ),
    h('div', { class: 'sec' },
      h('div', { class: 'sec-t' }, 'Bloco', h('span', { class: 'muted' }, `${(st.bloco - 1) * 15}' a ${st.bloco * 15}' · ${st.bloco <= 3 ? '1º' : '2º'} tempo`)),
      stepper(st.bloco, 1, 6, v => { saveState({ bloco: v }); if (gm) logEvent(`Começa o bloco ${v} (${(v - 1) * 15}'–${v * 15}')`); }, gm),
      gm ? h('button', { class: 'btn btn-sm', onclick: e => confirmBtn(e.currentTarget, desgasteBloco) }, 'Desgaste do bloco: −1d4 de Fôlego nos principais') : null,
    ),
    h('div', { class: 'sec' },
      h('div', { class: 'sec-t' }, 'Momento', h('span', { class: 'muted' }, '+1 por ponto')),
      h('div', { class: 'momento-lbl' }, h('span', {}, `◀ ${st.away.name}`), h('span', {}, `${st.home.name} ▶`)),
      h('div', { class: 'momento' }, [-3, -2, -1, 0, 1, 2, 3].map(v =>
        h('button', { class: v === m ? 'on' : '', disabled: !gm, onclick: () => saveState({ momento: v }) }, v === 0 ? '0' : sign(v)))),
    ),
    team('home'), team('away'),
    gm ? null : h('p', { class: 'muted' }, 'Só o mestre altera a partida. Você move o seu token e a bola quando ela estiver com você.'),
  );
}

// ---- ordem de protagonista do bloco ----
function ordemAtual(st) { return st.ordem && st.ordem.bloco === st.bloco ? st.ordem : null; }
function ordemSec(st, gm) {
  const o = ordemAtual(st);
  const lista = o ? o.lista : [];
  const vez = lista.find(x => !x.feito && x.total != null);
  return h('div', { class: 'sec ordem' },
    h('div', { class: 'sec-t' }, `Ordem do bloco ${st.bloco}`, h('span', { class: 'muted' }, 'd20 + Percepção de Campo')),
    o ? h('ol', { class: 'ordem-list' }, lista.map((x, i) => h('li', { class: (x.feito ? 'feito' : '') + (x === vez ? ' vez' : '') },
      h('span', { class: 'pos' }, i + 1), h('span', { class: 'nm' }, x.name),
      gm ? h('input', { type: 'number', class: 'ord-in', value: x.total ?? '', placeholder: '—', 'aria-label': `Resultado de ${x.name}`, onchange: e => notaOrdem(i, e.target.value) })
        : h('span', { class: 'tot' }, x.total ?? '—'),
      h('span', {}),
      gm ? h('label', { class: 'tg' }, h('input', { type: 'checkbox', checked: !!x.feito, onchange: e => marcarOrdem(i, e.target.checked) }), h('span', {}, 'feito')) : (x.feito ? h('span', { class: 'muted' }, 'feito') : h('span', {})))))
      : h('p', { class: 'muted' }, gm ? 'No começo do bloco, depois do Duelo, cada jogador rola Percepção de Campo na aba Dados. Clique em "Montar ordem" e digite os resultados.' : 'Role Percepção de Campo na aba Dados quando o mestre pedir.'),
    o && vez ? h('p', { class: 'vez-txt' }, `Lance-chave agora: `, h('b', {}, vez.name)) : null,
    o && lista.length && lista.every(x => x.feito) ? h('p', { class: 'muted' }, 'Todo mundo já teve o seu lance. Hora da resolução rápida.') : null,
    gm ? h('button', { class: 'btn btn-sm btn-dark', onclick: montarOrdem }, o ? 'Montar de novo' : 'Montar ordem') : null,
    h('p', { class: 'muted' }, 'Cada personagem protagoniza um lance-chave nessa ordem e começa com a bola. Dentro do lance, a bola manda.'),
  );
}
async function montarOrdem() {
  const st = S.match.state;
  const donos = new Set([...S.tokens.values()].filter(t => t.owner && !t.res?.vermelho).map(t => t.owner));
  const ps = S.players.filter(p => donos.has(p.id));
  if (!ps.length) { toast('Nenhum jogador com token nesta partida.'); return; }
  const lista = ps.map(p => ({ id: p.id, name: p.name, total: null, feito: false }));
  await saveState({ ordem: { bloco: st.bloco, lista } }); renderTab();
}
async function notaOrdem(i, v) {
  const st = S.match.state; const o = ordemAtual(st); if (!o) return;
  const lista = o.lista.map((x, k) => k === i ? { ...x, total: v === '' ? null : num(v) } : x)
    .sort((a, b) => (b.total ?? -99) - (a.total ?? -99));
  await saveState({ ordem: { ...o, lista } });
  if (document.activeElement?.classList.contains('ord-in')) document.activeElement.blur();
  renderTab();
  if (lista.every(x => x.total != null)) logEvent(`Ordem do bloco ${st.bloco}: ` + lista.map(x => `${x.name} ${x.total}`).join(' · '));
}
async function marcarOrdem(i, v) {
  const st = S.match.state; const o = ordemAtual(st); if (!o) return;
  const lista = o.lista.map((x, k) => k === i ? { ...x, feito: v } : x);
  await saveState({ ordem: { ...o, lista } }); renderTab();
}
async function desgasteBloco() {
  const toks = [...S.tokens.values()].filter(t => t.important && onField(t) && (t.res?.folegoMax || 0) > 0);
  if (!toks.length) { toast('Nenhum token principal com Fôlego máximo preenchido.'); return; }
  const out = [];
  await Promise.all(toks.map(t => { const d = 1 + Math.floor(Math.random() * 4); const r = { ...recursosIniciais(), ...t.res }; r.folego = Math.max(0, (r.folego || 0) - d); out.push(`${t.name || 'nº ' + t.number} −${d}`); t.res = r; return S.store.update('tokens', t.id, { res: r }); }));
  renderTokens(); renderTab();
  logEvent(`Desgaste do bloco ${S.match.state.bloco}: ` + out.join(' · '));
}
async function empurrarTime(team, dir) {
  const dy = (team === 'home' ? -1 : 1) * dir * 0.15;
  const toks = [...S.tokens.values()].filter(t => t.team === team && onField(t));
  toks.forEach(t => { t.y = clamp(t.y + dy, 0.03, 0.97); });
  renderTokens();
  try { await Promise.all(toks.map(t => S.store.update('tokens', t.id, { y: t.y }))); } catch (e) { toast('Erro: ' + e.message); }
}

async function aplicarFormacao(team, modo) {
  const st = S.match.state; const f = st[team].formation;
  const toks = [...S.tokens.values()].filter(t => t.team === team && onField(t)).sort((a, b) => a.slot - b.slot).slice(0, 11);
  const ups = toks.map((t, i) => { const p = posicaoFormacao(f, i, team, modo); t.x = p.x; t.y = p.y; return { id: t.id, ...p }; });
  renderTokens();
  try { await Promise.all(ups.map(u => S.store.update('tokens', u.id, { x: u.x, y: u.y }))); toast(`${st[team].name}: ${f}`); }
  catch (e) { toast('Erro: ' + e.message); }
}

// ================= token =================
function playerName(id) { return S.players.find(p => p.id === id)?.name || ''; }

function renderTokenTab() {
  const box = $('#tab-token');
  const t = S.selected && S.tokens.get(S.selected);
  if (!t) { put(box, h('div', { class: 'empty' }, 'Clique num jogador no campo para ver os detalhes.')); return; }
  const edit = canEditToken(t), gm = isGM();
  const r = { ...recursosIniciais(), ...(t.res || {}) };
  const setRes = patch => updateToken(t, { res: { ...r, ...patch } });
  const avatar = h('div', { class: 'avatar ' + t.team, style: t.photo ? `background-image:url("${t.photo.replace(/"/g, '%22')}")` : '' }, t.photo ? '' : t.number);
  const head = h('div', { class: 'tok-head' }, avatar,
    h('div', { class: 'tok-title' },
      h('b', {}, t.name || `Camisa ${t.number}`),
      h('span', { class: 'muted' }, `${t.team === 'home' ? S.match.state.home.name : S.match.state.away.name} · nº ${t.number}`),
      h('span', { class: 'muted' }, t.owner ? `Controlado por ${playerName(t.owner) || 'jogador'}` : 'Controlado pelo mestre')));

  const pair = (a, b, onA, onB) => h('div', { class: 'pair' },
    h('input', { type: 'number', value: a, disabled: !edit, onchange: e => onA(num(e.target.value)) }), h('span', {}, '/'),
    h('input', { type: 'number', value: b, disabled: !edit, onchange: e => onB(num(e.target.value)) }));
  const bar = (a, b) => h('div', { class: 'bar' }, h('i', { style: `width:${b > 0 ? clamp(a / b, 0, 1) * 100 : 0}%` }));

  const parts = [head];
  if (gm || edit) {
    parts.push(h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Identidade'),
      h('div', { class: 'grid2' },
        h('label', {}, 'Nome', h('input', { value: t.name, disabled: !edit, onchange: e => updateToken(t, { name: e.target.value.slice(0, 40) }) })),
        h('label', {}, 'Camisa', h('input', { type: 'number', value: t.number, disabled: !gm, onchange: e => updateToken(t, { number: num(e.target.value) }) }))),
      gm ? h('div', { class: 'grid2' },
        h('label', {}, 'Time', h('select', { onchange: e => updateToken(t, { team: e.target.value }) },
          h('option', { value: 'home', selected: t.team === 'home' }, S.match.state.home.name),
          h('option', { value: 'away', selected: t.team === 'away' }, S.match.state.away.name))),
        h('label', {}, 'Dono', h('select', { onchange: e => updateToken(t, { owner: e.target.value, important: !!e.target.value }) },
          h('option', { value: '' }, 'Mestre'),
          S.players.map(p => h('option', { value: p.id, selected: p.id === t.owner }, p.name))))) : null,
      gm ? h('label', { class: 'tg' }, h('input', { type: 'checkbox', checked: t.important, onchange: e => updateToken(t, { important: e.target.checked }) }), h('span', {}, 'Token principal (maior, com foto)')) : null,
      h('label', {}, 'Foto', h('div', { class: 'row' },
        h('input', { type: 'file', accept: 'image/*', disabled: !edit, onchange: e => uploadPhoto(t, e.target.files[0]) }),
        t.photo ? h('button', { class: 'btn btn-sm', disabled: !edit, onclick: () => updateToken(t, { photo: '' }) }, 'Tirar') : null)),
      h('label', {}, 'Ou link da imagem', h('input', { placeholder: 'https://…', value: t.photo && !t.photo.startsWith('data:') ? t.photo : '', disabled: !edit, onchange: e => updateToken(t, { photo: e.target.value.trim() }) })),
    ));
  }

  parts.push(h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Recursos', edit ? '' : h('span', { class: 'muted' }, 'só leitura')),
    h('div', { class: 'res' },
      h('span', { class: 'lbl' }, 'Fôlego'), pair(r.folego, r.folegoMax, v => setRes({ folego: v }), v => setRes({ folegoMax: v })), bar(r.folego, r.folegoMax),
      edit ? h('div', { class: 'quick' },
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ folego: Math.max(0, r.folego - 1) }) }, '−1'),
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ folego: r.folegoMax ? Math.min(r.folegoMax, r.folego + 1) : r.folego + 1 }) }, '+1'),
        h('button', { class: 'btn btn-sm', onclick: () => { const d = 1 + Math.floor(Math.random() * 4); setRes({ folego: Math.max(0, r.folego - d) }); toast(`Desgaste: −${d} de Fôlego`); } }, 'Desgaste 1d4'),
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ folego: r.folegoMax }) }, 'Encher')) : null,
      h('span', { class: 'lbl' }, 'Garra'), pair(r.garra, r.garraMax, v => setRes({ garra: v }), v => setRes({ garraMax: v })), bar(r.garra, r.garraMax),
      edit ? h('div', { class: 'quick' },
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ garra: Math.max(0, r.garra - 1) }) }, '−1'),
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ garra: Math.max(0, r.garra - 2) }) }, '−2'),
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ garra: r.garraMax ? Math.min(r.garraMax, r.garra + 1) : r.garra + 1 }) }, '+1'),
        h('button', { class: 'btn btn-sm', onclick: () => setRes({ garra: Math.min(r.garraMax || r.garra, r.garra + Math.floor((r.garraMax || 0) / 2)) }) }, 'Intervalo (½)')) : null,
      h('span', { class: 'lbl' }, 'Confiança'), stepper(r.confianca, 0, 10, v => setRes({ confianca: v }), edit),
      h('span', { class: 'lbl' }, 'Pressão'), stepper(r.pressao, 0, 6, v => setRes({ pressao: v }), edit),
      h('span', { class: 'lbl' }, 'Condição'), h('select', { disabled: !edit, onchange: e => setRes({ condicao: e.target.value }) },
        CONDICOES.map(c => h('option', { value: c, selected: c === r.condicao }, c === '—' ? 'Nenhuma' : c))),
      h('span', { class: 'lbl' }, 'Cartões'), h('div', { class: 'row' },
        stepper(r.amarelo, 0, 2, v => { setRes({ amarelo: v, vermelho: v >= 2 ? true : r.vermelho }); if (gm && v > r.amarelo) logEvent(`Amarelo para ${t.name || 'nº ' + t.number}`); }, gm),
        h('label', { class: 'tg' }, h('input', { type: 'checkbox', checked: r.vermelho, disabled: !gm, onchange: e => { setRes({ vermelho: e.target.checked }); if (e.target.checked) logEvent(`Vermelho para ${t.name || 'nº ' + t.number}`); } }), h('span', {}, 'Vermelho'))),
    ),
    r.pressao >= 6 ? h('p', { class: 'muted', style: 'color:#c62828;font-weight:700' }, 'Pressão 6: crise!') : null,
  ));

  if (gm) {
    parts.push(h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Ações do mestre'),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn btn-sm', onclick: () => saveState({ ball: { ...S.match.state.ball, holder: t.id } }) }, 'Dar a bola'),
        h('button', { class: 'btn btn-sm', onclick: () => { saveState({ score: { ...S.match.state.score, [t.team]: S.match.state.score[t.team] + 1 } }); logEvent(`⚽ GOL! ${t.name || 'nº ' + t.number} (${S.match.state[t.team].name})`); } }, 'Marcou gol'),
        h('button', { class: 'btn btn-sm btn-red', onclick: e => confirmBtn(e.currentTarget, () => removeToken(t)) }, 'Remover token'))));
    const subs = (S.match.state.subs || {})[t.team] || 0;
    const reservas = [...S.tokens.values()].filter(x => x.team === t.team && x.bench).sort((a, b) => a.number - b.number);
    if (t.bench) {
      parts.push(h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'No banco', h('span', { class: 'muted' }, `substituições: ${subs}/5`)),
        h('button', { class: 'btn btn-sm', onclick: () => colocarEmCampo(t) }, 'Colocar em campo (sem contar substituição)')));
    } else {
      const sel = h('select', {}, reservas.length ? reservas.map(x => h('option', { value: x.id }, `${x.number} · ${x.name || 'Reserva'}`)) : h('option', { value: '' }, 'Banco vazio'));
      parts.push(h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Substituição', h('span', { class: 'muted' }, `${subs}/5 usadas`)),
        h('div', { class: 'row' }, sel, h('button', { class: 'btn btn-sm btn-dark', disabled: !reservas.length, onclick: () => substituir(t, S.tokens.get(sel.value)) }, 'Substituir')),
        h('button', { class: 'btn btn-sm', onclick: () => updateToken(t, { bench: true }) }, 'Mandar para o banco'),
        subs >= 5 ? h('p', { class: 'muted', style: 'color:#c62828' }, 'Limite de 5 substituições atingido.') : null));
    }
  }
  put(box, ...parts);
}

function confirmBtn(btn, fn) {
  if (btn.dataset.armed) { fn(); return; }
  const old = btn.textContent; btn.dataset.armed = '1'; btn.textContent = 'Confirmar?';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 3000);
}

async function updateToken(t, patch) {
  Object.assign(t, patch); renderTokens(); renderTab();
  try { await S.store.update('tokens', t.id, patch); } catch (e) { toast('Não salvou: ' + e.message); }
}
async function uploadPhoto(t, file) {
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Imagem muito grande (máx. 3 MB).'); return; }
  toast('Enviando foto…');
  try { const url = await S.store.upload(file); await updateToken(t, { photo: url, important: true }); toast('Foto salva.'); }
  catch (e) { toast('Falhou: ' + e.message); }
}
async function removeToken(t) {
  S.tokens.delete(t.id); S.selected = null; renderTokens(); renderTab();
  try { await S.store.remove('tokens', t.id); } catch (e) { toast('Erro: ' + e.message); }
}

// ================= dados =================
const d20 = () => 1 + Math.floor(Math.random() * 20);

function renderDados() {
  const box = $('#tab-dados');
  const skills = isGM() ? {} : (S.player?.skills || {});
  const opts = Object.entries(skills).filter(([, v]) => v !== '' && v != null);
  const f = h('form', { class: 'sec', onsubmit: e => { e.preventDefault(); rolar(new FormData(e.currentTarget)); } },
    h('div', { class: 'sec-t' }, 'Rolar d20'),
    isGM() ? h('label', {}, 'Quem rola', h('input', { name: 'who', value: S.selected && S.tokens.get(S.selected)?.name || 'Mestre' })) : null,
    h('label', {}, 'Perícia', h('select', { name: 'skill' },
      h('option', { value: '' }, isGM() ? 'Bônus livre' : (opts.length ? 'Sem perícia (só o bônus)' : 'Cadastre suas perícias em "Meu jogador"')),
      opts.map(([k, v]) => h('option', { value: k }, `${k} (${sign(num(v))})`)))),
    h('div', { class: 'grid3' },
      h('label', {}, 'Bônus extra', h('input', { name: 'extra', type: 'number', value: 0 })),
      h('label', {}, 'CD', h('input', { name: 'cd', type: 'number', placeholder: '—' })),
      h('label', {}, 'Modo', h('select', { name: 'mode' }, h('option', { value: 'n' }, 'Normal'), h('option', { value: 'v' }, 'Vantagem'), h('option', { value: 'd' }, 'Desvantagem')))),
    h('label', {}, 'Descrição (opcional)', h('input', { name: 'label', maxlength: 60, placeholder: 'ex: drible no lateral' })),
    isGM() ? h('label', { class: 'tg' }, h('input', { type: 'checkbox', name: 'secret' }), h('span', {}, 'Rolagem secreta (só você vê)')) : null,
    h('button', { class: 'btn btn-dark', type: 'submit', disabled: !S.match }, 'Rolar'),
  );
  const last = S.lastRoll ? rollCard(S.lastRoll) : null;
  const log = h('div', { class: 'log' }, S.rolls.length ? S.rolls.map(logItem) : h('div', { class: 'empty' }, 'Nenhuma rolagem ainda.'));
  put(box, f, last, h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Registro da partida'), log));
}

function resolve(d) {
  if (d.cd == null) return '';
  if (d.nat === 1) return 'Erro grave (1 natural)';
  if (d.nat === 20) return 'Sucesso excelente (20 natural)';
  const m = d.total - d.cd;
  if (m >= 5) return `Sucesso excelente (+${m})`;
  if (m >= 0) return `Sucesso (+${m})`;
  if (m <= -5) return `Falha por ${-m}: perde a bola`;
  return `Falha por ${-m}`;
}
function rollCard(r) {
  const d = r.data;
  return h('div', { class: 'dice-out' + (d.nat === 20 ? ' nat20' : d.nat === 1 ? ' nat1' : '') },
    h('div', { class: 'muted' }, `${r.who}${r.label ? ' · ' + r.label : ''}${d.secret ? ' · secreta' : ''}`),
    h('div', { class: 'tot' }, d.total),
    h('div', {}, `d20 ${d.dice.length > 1 ? '[' + d.dice.join(', ') + '] → ' : ''}${d.nat} ${sign(d.bonus)}${d.skill ? ' (' + d.skill + ')' : ''}`),
    d.cd != null ? h('div', {}, h('b', {}, resolve(d)), ` contra CD ${d.cd}`) : null,
    d.nat === 20 ? h('div', {}, h('b', {}, '20 natural! Se for Jogada, é Toque Perfeito.')) : null,
  );
}
function logItem(r) {
  const tm = new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (r.kind === 'event') return h('div', { class: 'log-item ev' }, h('span', { class: 'big' }, r.label), h('time', {}, tm));
  const d = r.data || {};
  return h('div', { class: 'log-item' + (d.nat === 20 ? ' n20' : d.nat === 1 ? ' n1' : '') },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'who' }, r.who), h('span', { class: 'big' }, d.total)),
    h('span', { class: 'det' }, [r.label, d.skill, `d20 ${d.dice?.length > 1 ? '[' + d.dice.join(', ') + '] ' : ''}${d.nat} ${sign(d.bonus ?? 0)}`].filter(Boolean).join(' · ')),
    d.cd != null ? h('span', { class: 'det' }, `CD ${d.cd}: ${resolve(d)}`) : null,
    h('time', {}, tm));
}

async function rolar(fd) {
  if (!S.match) return;
  const mode = fd.get('mode');
  const dice = mode === 'n' ? [d20()] : [d20(), d20()];
  const nat = mode === 'v' ? Math.max(...dice) : mode === 'd' ? Math.min(...dice) : dice[0];
  const skill = fd.get('skill') || '';
  const skBonus = skill && !isGM() ? num(S.player?.skills?.[skill]) : 0;
  const bonus = skBonus + num(fd.get('extra'));
  const cdRaw = fd.get('cd');
  const data = { dice, nat, mode, bonus, total: nat + bonus, skill, cd: cdRaw === '' || cdRaw == null ? null : num(cdRaw) };
  const who = isGM() ? (fd.get('who') || 'Mestre') : S.me.name;
  const row = { match_id: S.match.id, kind: 'roll', who, label: (fd.get('label') || '').slice(0, 60), data };
  if (fd.get('secret')) { data.secret = true; S.lastRoll = { ...row, created_at: new Date().toISOString() }; renderDados(); return; }
  S.lastRoll = { ...row, created_at: new Date().toISOString() };
  try { await S.store.insert('rolls', row); } catch (e) { toast('Não registrou: ' + e.message); }
  renderDados();
}
async function logEvent(label) {
  if (!S.match) return;
  try { await S.store.insert('rolls', { match_id: S.match.id, kind: 'event', who: 'Mestre', label, data: {} }); } catch (e) { toast(e.message); }
}

// ================= meu jogador =================
function renderEu() {
  const box = $('#tab-eu');
  if (isGM()) { put(box, ); return; }
  const mine = [...S.tokens.values()].filter(t => t.owner === S.me.id);
  const skills = S.player?.skills || {};
  put(box, 
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Você'),
      h('label', {}, 'Nome', h('input', { value: S.me.name, maxlength: 40, onchange: e => renameMe(e.target.value) })),
      mine.length ? h('div', { class: 'row', style: 'flex-wrap:wrap' }, mine.map(t => h('button', { class: 'btn btn-sm', onclick: () => { S.selected = t.id; renderTokens(); setTab('token'); } }, `Meu token: ${t.name || 'nº ' + t.number}`)))
        : h('p', { class: 'muted' }, 'O mestre ainda não te deu um token nesta partida.')),
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Perícias', h('span', { class: 'muted' }, 'o Total da sua ficha')),
      h('div', { class: 'skills' }, PERICIAS.map(([n, a]) => [
        h('span', { class: 'sk' }, n, h('em', {}, a)),
        h('input', { type: 'number', value: skills[n] ?? '', placeholder: '—', 'aria-label': n, onchange: e => saveSkill(n, e.target.value) }),
      ]))),
  );
}
async function saveSkill(n, v) {
  const skills = { ...(S.player.skills || {}) };
  if (v === '') delete skills[n]; else skills[n] = num(v);
  S.player.skills = skills;
  try { await S.store.update('players', S.player.id, { skills }); } catch (e) { toast('Não salvou: ' + e.message); }
}
async function renameMe(name) {
  name = (name || '').trim().slice(0, 40) || 'Jogador';
  S.me.name = name; S.player.name = name; saveSession();
  $('#me-chip').textContent = name;
  try { await S.store.update('players', S.player.id, { name }); } catch (e) { toast(e.message); }
}

// ================= mestre =================
let secretTimer = null;
function saveSecrets() {
  clearTimeout(secretTimer);
  secretTimer = setTimeout(async () => {
    try { await S.store.rpc('set_secrets', { p_room: S.code, p_pass: S.gmPass, p_data: S.secrets }); }
    catch (e) { toast('Notas não salvas: ' + e.message); }
  }, 500);
}
function renderMestre() {
  const box = $('#tab-mestre');
  if (!isGM()) { put(box, ); return; }
  const sec = S.secrets; sec.levels = sec.levels || { home: 3, away: 3 };
  const st = S.match?.state;
  const link = shareLink();
  const nm = h('input', { placeholder: 'Nome da nova partida', maxlength: 60 });
  put(box, 
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Sala'),
      h('p', { class: 'muted' }, 'Mande este link para os jogadores:'),
      h('div', { class: 'row' }, h('input', { value: link, readonly: true, onfocus: e => e.target.select() }), h('button', { class: 'btn btn-sm', onclick: copyLink }, 'Copiar')),
      h('label', {}, 'Nome da mesa', h('input', { value: S.room.name, onchange: async e => { S.room.name = e.target.value || 'Mesa'; $('#room-name').textContent = S.room.name; await S.store.update('rooms', S.code, { name: S.room.name }, 'code'); } }))),
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Partidas'),
      h('div', { class: 'row' }, nm, h('button', { class: 'btn btn-sm btn-dark', onclick: () => novaPartida(nm.value) }, 'Criar')),
      S.match ? h('div', { class: 'grid2' },
        h('button', { class: 'btn btn-sm', onclick: async () => { const n = prompt('Novo nome da partida:', S.match.name); if (n) { S.match.name = n; await S.store.update('matches', S.match.id, { name: n }); renderMatchSelect(); } } }, 'Renomear'),
        h('button', { class: 'btn btn-sm btn-red', onclick: e => confirmBtn(e.currentTarget, apagarPartida) }, 'Apagar partida')) : null,
      h('p', { class: 'muted' }, 'A partida escolhida no topo aparece para todos. Tudo fica salvo automaticamente.')),
    st ? h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Tokens'),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn btn-sm', onclick: () => addToken('home') }, `+ ${st.home.name}`),
        h('button', { class: 'btn btn-sm', onclick: () => addToken('away') }, `+ ${st.away.name}`)),
      h('p', { class: 'muted' }, 'Clique num token para dar a um jogador, mudar nome, foto e recursos.')) : null,
    st ? h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Nível dos times', h('span', { class: 'muted' }, 'secreto')),
      h('div', { class: 'grid2' },
        h('label', {}, st.home.name, stepper(sec.levels.home, 1, 10, v => { sec.levels.home = v; saveSecrets(); renderMestre(); }, true)),
        h('label', {}, st.away.name, stepper(sec.levels.away, 1, 10, v => { sec.levels.away = v; saveSecrets(); renderMestre(); }, true))),
      h('p', { class: 'muted' }, `Duelo Tático contra ${st.away.name}: CD ${10 + sec.levels.away}. Jogadores NPC rolam d20 + ${sec.levels.away + 2} (aprox.).`)) : null,
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Notas secretas'),
      h('textarea', { placeholder: 'Só você vê. Ganchos, formação real do adversário, viradas…', oninput: e => { sec.notes = e.target.value; saveSecrets(); } }, sec.notes || '')),
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Jogadores na sala'),
      S.players.length ? h('div', { class: 'log' }, S.players.map(p => h('div', { class: 'log-item' }, h('span', { class: 'who' }, p.name),
        h('span', { class: 'det' }, `${Object.keys(p.skills || {}).length} perícias cadastradas · ${[...S.tokens.values()].filter(t => t.owner === p.id).map(t => t.name || 'nº ' + t.number).join(', ') || 'sem token'}`))))
        : h('div', { class: 'empty' }, 'Ninguém entrou ainda.')),
  );
}

function tokensPadrao(matchId, st) {
  const out = [];
  for (const team of ['home', 'away']) {
    for (let i = 0; i < 11; i++) {
      const p = posicaoFormacao(st[team].formation, i, team, 'saida');
      out.push({ match_id: matchId, team, slot: i, number: i + 1, name: '', photo: '', owner: '', important: false, x: p.x, y: p.y, res: recursosIniciais() });
    }
  }
  return out;
}
async function novaPartida(name) {
  name = (name || '').trim() || `Partida ${S.matches.length + 1}`;
  try {
    const st = estadoInicial();
    const [m] = await S.store.insert('matches', { room_code: S.code, name, state: st });
    // copia os tokens principais da partida atual (personagens dos jogadores)
    const base = tokensPadrao(m.id, st);
    const princ = [...S.tokens.values()].filter(t => t.important || t.owner);
    for (const t of princ) {
      const b = base.find(x => x.team === t.team && x.number === t.number) || base.find(x => x.team === t.team && !x.name);
      if (b) Object.assign(b, { name: t.name, photo: t.photo, owner: t.owner, important: t.important, number: t.number, res: { ...recursosIniciais(), folegoMax: t.res?.folegoMax || 0, folego: t.res?.folegoMax || 0, garraMax: t.res?.garraMax || 0, garra: t.res?.garraMax || 0, confianca: t.res?.confianca ?? 5, pressao: t.res?.pressao ?? 0 } });
    }
    await S.store.insert('tokens', base);
    if (!S.matches.some(x => x.id === m.id)) S.matches.push(m);
    await S.store.update('rooms', S.code, { active_match: m.id }, 'code');
    await loadMatch(m.id);
    toast('Partida criada.');
  } catch (e) { toast('Erro: ' + e.message); }
}
async function apagarPartida() {
  const id = S.match.id;
  try {
    await S.store.remove('matches', id);
    S.matches = S.matches.filter(m => m.id !== id);
    const next = S.matches[S.matches.length - 1];
    await S.store.update('rooms', S.code, { active_match: next ? next.id : null }, 'code');
    if (next) await loadMatch(next.id); else { S.match = null; S.tokens.clear(); S.rolls = []; renderAll(); }
  } catch (e) { toast('Erro: ' + e.message); }
}
async function addToken(team) {
  const used = [...S.tokens.values()].filter(t => t.team === team).map(t => t.number);
  let n = 12; while (used.includes(n)) n++;
  const row = { match_id: S.match.id, team, slot: 99, number: n, name: '', photo: '', owner: '', important: false, bench: true, x: team === 'home' ? .04 : .96, y: .5, res: recursosIniciais() };
  try { const [t] = await S.store.insert('tokens', row); S.tokens.set(t.id, t); S.selected = t.id; renderTokens(); setTab('token'); } catch (e) { toast(e.message); }
}

// ================= fase 3: banco, setas, impedimento =================
function renderBench() {
  const box = $('#bench'); if (!box) return;
  if (!S.match || S.mode === 'cidade') { box.replaceChildren(); return; }
  const st = S.match.state, subs = st.subs || {};
  const row = side => {
    const list = [...S.tokens.values()].filter(t => t.team === side && t.bench).sort((a, b) => a.number - b.number);
    if (side === 'away' && st.fog && !isGM()) return null;
    return h('div', { class: 'bench-row' },
      h('span', { class: 'bench-t' }, `Banco · ${st[side].name}`, h('em', {}, ` ${subs[side] || 0}/5`)),
      list.length ? list.map(t => h('button', { class: 'bench-chip' + (t.team === 'home' ? ' home' : '') + (S.selected === t.id ? ' sel' : '') + (t.owner && t.owner === S.me.id ? ' mine' : ''),
        title: t.name || `Camisa ${t.number}`, onclick: () => { S.selected = t.id; renderTokens(); setTab('token'); } },
        h('b', {}, t.number), t.name ? h('span', {}, t.name) : null))
        : h('span', { class: 'muted' }, 'vazio'));
  };
  put(box, row('home'), row('away'));
}

async function substituir(sai, entra) {
  if (!sai || !entra) return;
  const st = S.match.state, subs = { ...(st.subs || {}) };
  subs[sai.team] = (subs[sai.team] || 0) + 1;
  const r = { ...recursosIniciais(), ...(entra.res || {}) };
  const entraPatch = { bench: false, x: sai.x, y: sai.y, slot: sai.slot, res: { ...r, folego: r.folegoMax || r.folego } };
  const saiPatch = { bench: true, slot: 99 };
  Object.assign(entra, entraPatch); Object.assign(sai, saiPatch);
  if (st.ball?.holder === sai.id) await saveState({ subs, ball: { ...st.ball, holder: entra.id } }); else await saveState({ subs });
  S.selected = entra.id; renderTokens(); renderTab();
  logEvent(`🔁 Sai ${sai.name || 'nº ' + sai.number}, entra ${entra.name || 'nº ' + entra.number} (${st[sai.team].name})`);
  try { await Promise.all([S.store.update('tokens', entra.id, entraPatch), S.store.update('tokens', sai.id, saiPatch)]); }
  catch (e) { toast('Não salvou: ' + e.message); }
  if (subs[sai.team] > 5) toast('Passou do limite de 5 substituições.');
  else toast(`Gás novo: ${entra.name || 'nº ' + entra.number} tem +1 no primeiro lance.`);
}
async function colocarEmCampo(t) {
  await updateToken(t, { bench: false, x: .5, y: t.team === 'home' ? .75 : .25 });
}

// setas de jogada
const ARROW_TIPOS = { passe: { cor: '#fff', dash: null }, corrida: { cor: '#ffd600', dash: '14 10' } };
function renderArrows() {
  const g = $('#arrows'); if (!g) return;
  g.innerHTML = '';
  const arr = (S.match?.state?.arrows || []).concat(S.drawingArrow ? [S.drawingArrow] : []);
  for (const a of arr) {
    const [x1, y1] = toPx(a.x1, a.y1), [x2, y2] = toPx(a.x2, a.y2);
    const tp = ARROW_TIPOS[a.tipo] || ARROW_TIPOS.passe;
    g.append(s('line', { x1, y1, x2, y2, stroke: 'rgba(0,0,0,.45)', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': tp.dash }));
    g.append(s('line', { x1, y1, x2, y2, stroke: tp.cor, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': tp.dash, 'marker-end': `url(#ah-${a.tipo || 'passe'})` }));
  }
}
function startArrow(e) {
  e.preventDefault();
  const svg = $('#field'); svg.setPointerCapture(e.pointerId);
  const p0 = svgPoint(e); const [x1, y1] = fromPx(p0.x, p0.y);
  S.drawingArrow = { x1, y1, x2: x1, y2: y1, tipo: S.arrowTipo || 'passe' };
  const move = ev => { const p = svgPoint(ev); const [x, y] = fromPx(p.x, p.y); S.drawingArrow.x2 = x; S.drawingArrow.y2 = y; renderArrows(); };
  const up = async () => {
    svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up);
    const a = S.drawingArrow; S.drawingArrow = null;
    if (!a) return;
    const [ax, ay] = toPx(a.x1, a.y1), [bx, by] = toPx(a.x2, a.y2);
    if (Math.hypot(bx - ax, by - ay) < 25) { renderArrows(); return; }
    const arrows = (S.match.state.arrows || []).concat([{ ...a, by: S.me.id }]).slice(-20);
    await saveState({ arrows });
  };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
}
function setArrowMode(on) {
  S.arrowMode = on;
  $('#btn-seta').classList.toggle('on', on);
  $('#field').classList.toggle('drawing', on);
}

// linha de impedimento: penúltimo defensor, nunca além do meio-campo
function renderOffside() {
  const g = $('#offside'); if (!g) return;
  g.innerHTML = '';
  if (!S.opts.impedimento || !S.match) return;
  const linha = (defende) => {
    const ys = [...S.tokens.values()].filter(t => t.team === defende && onField(t) && !hiddenForMe(t)).map(t => tokenPos(t)[1]);
    if (ys.length < 2) return null;
    if (defende === 'away') { ys.sort((a, b) => a - b); return Math.min(ys[1], .5); }
    ys.sort((a, b) => b - a); return Math.max(ys[1], .5);
  };
  const holder = S.match.state.ball?.holder && S.tokens.get(S.match.state.ball.holder);
  const quem = holder ? [holder.team === 'home' ? 'away' : 'home'] : ['away', 'home'];
  for (const def of quem) {
    const y = linha(def); if (y == null) continue;
    const [, py] = toPx(.5, y);
    const cor = def === 'away' ? '#4fc3f7' : '#ff8a65';
    g.append(s('line', { x1: FX, y1: py, x2: FX + FW, y2: py, stroke: cor, 'stroke-width': 3, 'stroke-dasharray': '16 8' }));
    g.append(s('text', { x: FX + FW - 6, y: py - 6, 'text-anchor': 'end', class: 'zone-nm', style: `font-size:12px;fill:${cor}` }, `impedimento · defesa ${S.match.state[def].name}`));
  }
}

// ================= cidade (slice of life) =================
const semanaAtual = () => S.room?.semana || 1;
const localById = id => LOCAIS.find(l => l.id === id);
const ativById = id => ATIVIDADES.find(a => a.id === id);
const playerLocal = p => p.local || 'dormitorio';
function playerPhoto(pid) {
  for (const t of S.tokens.values()) if (t.owner === pid && t.photo) return t.photo;
  return '';
}
const iniciais = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

function setMode(mode, broadcast) {
  S.mode = mode;
  const cidade = mode === 'cidade';
  $('#field').toggleAttribute('hidden', cidade); $('#city').toggleAttribute('hidden', !cidade);
  $('#mode-campo').classList.toggle('on', !cidade); $('#mode-cidade').classList.toggle('on', cidade);
  document.querySelector('.tools-campo').hidden = cidade;
  document.querySelector('.tools-cidade').hidden = !cidade;
  $('#week-label').textContent = `Semana ${semanaAtual()}`;
  $('#scorebar').hidden = cidade; $('#bench').hidden = cidade; if (cidade) setArrowMode(false);
  document.querySelectorAll('#tabs button[data-mode]').forEach(b => { b.hidden = b.dataset.mode !== mode; });
  const cur = document.querySelector(`#tabs button[data-tab="${S.tab}"]`);
  if (!cur || cur.hidden) setTab(cidade ? 'local' : 'partida'); else renderTab();
  renderCity();
  if (broadcast && isGM() && S.room && (S.room.view || 'campo') !== mode) {
    S.room.view = mode;
    S.store.update('rooms', S.code, { view: mode }, 'code').catch(e => toast('Não salvou: ' + e.message));
  }
}

function drawCity() {
  const svg = $('#city'); svg.innerHTML = '';
  const INK = '#111';
  const g = s('g', { id: 'terrain' });
  g.append(s('rect', { x: 0, y: 0, width: 1000, height: 558, fill: '#cfe1c8' }));
  g.append(s('image', { href: 'img/mapa-ushio.jpg', x: 0, y: 0, width: 1000, height: 558, preserveAspectRatio: 'xMidYMid slice' }));
  // cartela
  g.append(s('rect', { x: 20, y: 20, width: 230, height: 54, fill: '#111' }));
  g.append(s('text', { x: 36, y: 54, fill: '#fff', style: 'font: 700 24px var(--display); letter-spacing: .08em' }, 'USHIO MINATO'));
  svg.append(g, s('g', { id: 'locais' }), s('g', { id: 'pessoas' }));
  svg.addEventListener('pointerdown', e => {
    if (e.target.closest('.loc') || e.target.closest('.pessoa')) return;
    if (S.selLocal) { S.selLocal = null; renderCity(); if (S.tab === 'local') renderTab(); }
  });
}

function renderCity() {
  const gl = $('#locais'), gp = $('#pessoas');
  if (!gl) return;
  gl.innerHTML = ''; gp.innerHTML = '';
  LOCAIS.forEach((l, i) => {
    const sel = S.selLocal === l.id;
    const m = s('g', { class: 'loc', transform: `translate(${l.x} ${l.y})`, tabindex: 0, role: 'button', 'aria-label': l.nome });
    if (sel) m.append(s('circle', { r: 24, fill: 'none', stroke: '#e8b100', 'stroke-width': 4 }));
    m.append(s('circle', { r: 16, fill: '#111', stroke: '#fff', 'stroke-width': 3 }));
    m.append(s('text', { y: 6, 'text-anchor': 'middle', fill: '#fff', style: 'font: 700 16px var(--display)' }, i + 1));
    const lw = Math.round(l.nome.length * 7.4 + 16);
    m.append(s('rect', { x: -lw / 2, y: 21, width: lw, height: 22, rx: 11, class: 'loc-pill' }));
    m.append(s('text', { y: 36.5, 'text-anchor': 'middle', class: 'loc-label' }, l.nome));
    const pick = () => { S.selLocal = l.id; renderCity(); setTab('local'); };
    m.addEventListener('click', pick);
    m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    gl.append(m);
  });
  const porLocal = {};
  for (const p of S.players) (porLocal[playerLocal(p)] ||= []).push(p);
  for (const [lid, ps] of Object.entries(porLocal)) {
    const l = localById(lid); if (!l) continue;
    ps.forEach((p, k) => {
      const n = ps.length, ang = (-90 + (k - (n - 1) / 2) * 34) * Math.PI / 180;
      const x = l.x + Math.cos(ang) * 40, y = l.y + Math.sin(ang) * 40;
      const mine = p.id === S.me.id;
      const g = s('g', { class: 'pessoa', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
      g.append(s('title', {}, p.name));
      if (mine) g.append(s('circle', { r: 17, fill: 'none', stroke: '#e8b100', 'stroke-width': 3 }));
      g.append(s('circle', { r: 14, fill: '#fff', stroke: '#111', 'stroke-width': 2.5 }));
      const ph = playerPhoto(p.id);
      if (ph) {
        const cid = 'pc' + p.id.replace(/[^a-z0-9]/gi, '');
        g.append(s('clipPath', { id: cid }, s('circle', { r: 12 })));
        g.append(s('image', { href: ph, x: -12, y: -12, width: 24, height: 24, 'clip-path': `url(#${cid})`, preserveAspectRatio: 'xMidYMid slice' }));
      } else {
        g.append(s('text', { y: 5, 'text-anchor': 'middle', style: 'font: 700 12px var(--display)' }, iniciais(p.name)));
      }
      gp.append(g);
    });
  }
}

async function irPara(pid, lid) {
  const p = S.players.find(x => x.id === pid); if (!p) return;
  p.local = lid; if (S.player && S.player.id === pid) S.player.local = lid;
  renderCity(); renderTab();
  try { await S.store.update('players', pid, { local: lid }); } catch (e) { toast('Não salvou: ' + e.message); }
}

function renderLocal() {
  const box = $('#tab-local');
  const l = S.selLocal && localById(S.selLocal);
  if (!l) {
    put(box, h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Ushio Minato'),
      h('p', { class: 'muted' }, 'Clique num lugar do mapa para ver o que dá para fazer lá.'),
      h('div', { class: 'log' }, LOCAIS.map((x, i) => h('button', { class: 'loc-item', onclick: () => { S.selLocal = x.id; renderCity(); renderLocal(); } },
        h('b', {}, `${i + 1}. ${x.nome}`), h('span', { class: 'muted' }, `${S.players.filter(p => playerLocal(p) === x.id).map(p => p.name).join(', ') || 'ninguém'}`))))));
    return;
  }
  const aqui = S.players.filter(p => playerLocal(p) === l.id);
  const sec = S.secrets || {}; sec.locais = sec.locais || {};
  put(box,
    h('div', { class: 'sec' },
      h('div', { class: 'sec-t' }, l.nome, h('button', { class: 'btn btn-sm', onclick: () => { S.selLocal = null; renderCity(); renderLocal(); } }, 'Voltar')),
      h('p', {}, l.desc),
      h('div', { class: 'muted' }, aqui.length ? `Aqui agora: ${aqui.map(p => p.name).join(', ')}` : 'Ninguém aqui agora.'),
      !isGM() && S.player ? h('button', { class: 'btn btn-dark', disabled: playerLocal(S.player) === l.id, onclick: () => irPara(S.player.id, l.id) }, playerLocal(S.player) === l.id ? 'Você está aqui' : 'Ir para cá') : null,
      isGM() && S.players.length ? h('label', {}, 'Mover jogador para cá', h('select', { onchange: e => { if (e.target.value) irPara(e.target.value, l.id); } },
        h('option', { value: '' }, 'Escolha…'), S.players.map(p => h('option', { value: p.id }, p.name)))) : null),
    h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'O que dá para fazer aqui'),
      h('div', { class: 'log' }, l.atividades.map(id => { const a = ativById(id); return h('div', { class: 'log-item' }, h('span', { class: 'who' }, a.nome), h('span', { class: 'det' }, `${a.teste} · ${a.efeito}`)); }))),
    isGM() ? h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Ganchos do mestre', h('span', { class: 'muted' }, 'secreto')),
      h('textarea', { placeholder: 'Quem aparece aqui, o que pode acontecer…', oninput: e => { sec.locais[l.id] = e.target.value; S.secrets = sec; saveSecrets(); } }, sec.locais[l.id] || '')) : null,
  );
}

const periodId = (pid, sem, slot) => `${pid}-${sem}-${slot}`;
function periodOf(pid, sem, slot) { return S.periods.find(p => p.id === periodId(pid, sem, slot)); }
async function savePeriod(pid, slot, patch) {
  const sem = semanaAtual(), id = periodId(pid, sem, slot);
  const cur = periodOf(pid, sem, slot) || { id, room_code: S.code, player_id: pid, semana: sem, slot, local: '', atividade: '', nota: '', resultado: '' };
  const row = { ...cur, ...patch };
  const i = S.periods.findIndex(p => p.id === id); if (i >= 0) S.periods[i] = row; else S.periods.push(row);
  try { await S.store.upsert('periods', row); } catch (e) { toast('Não salvou: ' + e.message); }
}

function periodCard(p, slot, editable, gm) {
  const cur = periodOf(p.id, semanaAtual(), slot) || {};
  const a = cur.atividade && ativById(cur.atividade);
  return h('div', { class: 'periodo' },
    h('div', { class: 'periodo-t' }, `Período ${slot}`),
    h('div', { class: 'grid2' },
      h('label', {}, 'Onde', h('select', { disabled: !editable, onchange: e => savePeriod(p.id, slot, { local: e.target.value }) },
        h('option', { value: '' }, '—'), LOCAIS.map(l => h('option', { value: l.id, selected: l.id === cur.local }, l.nome)))),
      h('label', {}, 'Atividade', h('select', { disabled: !editable, onchange: e => { savePeriod(p.id, slot, { atividade: e.target.value }); renderSemana(); } },
        h('option', { value: '' }, '—'), ATIVIDADES.map(x => h('option', { value: x.id, selected: x.id === cur.atividade }, x.nome))))),
    a ? h('div', { class: 'muted' }, `${a.teste} · ${a.efeito}`) : null,
    h('label', {}, 'Detalhe', h('input', { value: cur.nota || '', disabled: !editable, maxlength: 120, placeholder: 'ex: treino de Domínio com o Arakawa', onchange: e => savePeriod(p.id, slot, { nota: e.target.value }) })),
    gm ? h('label', {}, 'Resultado (mestre)', h('input', { value: cur.resultado || '', maxlength: 120, placeholder: 'ex: passou, 1 progresso', onchange: e => savePeriod(p.id, slot, { resultado: e.target.value }) }))
      : cur.resultado ? h('div', { class: 'resultado' }, h('b', {}, 'Resultado: '), cur.resultado) : null,
  );
}

function renderSemana() {
  const box = $('#tab-semana');
  const sem = semanaAtual();
  const head = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, `Semana ${sem}`, isGM() ? h('span', { class: 'muted' }, 'só o mestre muda') : ''),
    isGM() ? stepper(sem, 1, 99, async v => {
      S.room.semana = v; $('#week-label').textContent = `Semana ${v}`; renderSemana();
      try { await S.store.update('rooms', S.code, { semana: v }, 'code'); } catch (e) { toast('Não salvou: ' + e.message); }
    }, true) : null,
    h('p', { class: 'muted' }, 'Treino coletivo e escola são obrigatórios. Cada um escolhe 3 períodos livres. De uma semana para a outra, Fôlego e Garra voltam ao máximo.'));
  if (isGM()) {
    put(box, head, S.players.length ? S.players.map(p => h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, p.name), [1, 2, 3].map(k => periodCard(p, k, true, true))))
      : h('div', { class: 'empty' }, 'Ninguém entrou ainda.'));
  } else if (S.player) {
    put(box, head, h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Seus períodos'), [1, 2, 3].map(k => periodCard(S.player, k, true, false))));
  } else put(box, head);
}

// ================= abas e topo =================
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('.tab-body').forEach(b => { b.hidden = b.id !== 'tab-' + tab; });
  renderTab();
}
function renderTab() {
  if (S.drag) return;
  const a = document.activeElement;
  if (a && a.closest('.tab-body') && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox') return; // não atrapalha quem está digitando
  ({ partida: renderPartida, token: renderTokenTab, local: renderLocal, semana: renderSemana, dados: renderDados, eu: renderEu, mestre: renderMestre })[S.tab]?.();
}
function renderMatchSelect() {
  const sel = $('#match-select');
  sel.replaceChildren(...(S.matches.length ? S.matches.map(m => h('option', { value: m.id, selected: S.match && m.id === S.match.id }, m.name)) : [h('option', {}, 'Sem partida')]));
  sel.disabled = !isGM() || !S.matches.length;
}
function renderAll() { renderMatchSelect(); renderZones(); renderTokens(); renderScore(); renderCity(); renderTab(); }

function shareLink() {
  const u = new URL(location.href); u.search = ''; u.searchParams.set('sala', S.code);
  if (S.store.local) u.searchParams.set('local', '1');
  return u.toString();
}
async function copyLink() {
  try { await navigator.clipboard.writeText(shareLink()); toast('Link copiado.'); } catch { toast(shareLink()); }
}

// ================= sessão e sala =================
function saveSession() { lsSet('eda-session', { code: S.code, role: S.role, name: S.me.name, pass: S.gmPass }); }

async function enterRoom(code, role, name, pass) {
  code = code.trim().toUpperCase();
  const [room] = await S.store.select('rooms', { code });
  if (!room) throw new Error('Sala não encontrada.');
  if (role === 'gm') {
    const ok = await S.store.rpc('check_gm', { p_room: code, p_pass: pass });
    if (!ok) throw new Error('Senha do mestre errada.');
    S.secrets = (await S.store.rpc('get_secrets', { p_room: code, p_pass: pass })) || {};
    S.gmPass = pass; S.me = { id: 'gm', name: 'Mestre' };
  } else {
    name = (name || '').trim().slice(0, 40);
    if (!name) throw new Error('Digite seu nome.');
    const mine = `${clientId}-${code}`;
    let pid = lsGet('eda-pid-' + code, null) || mine;
    if (pid === mine) {
      // mesmo nome em outro aparelho: reaproveita o jogador (e os tokens) que já existe
      const norm = x => (x || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      const all = await S.store.select('players', { room_code: code }, { order: 'created_at' });
      const same = all.find(p => norm(p.name) === norm(name));
      if (same) { pid = same.id; name = same.name; }
    }
    lsSet('eda-pid-' + code, pid);
    const [p] = await S.store.upsert('players', { id: pid, room_code: code, name });
    S.player = p; S.me = { id: pid, name };
  }
  S.room = room; S.code = code; S.role = role;
  saveSession();
  history.replaceState(null, '', shareLink());
  S.players = await S.store.select('players', { room_code: code }, { order: 'created_at' });
  S.matches = await S.store.select('matches', { room_code: code }, { order: 'created_at' });
  try { S.periods = await S.store.select('periods', { room_code: code }); } catch { S.periods = []; }

  $('#lobby').hidden = true; $('#app').hidden = false;
  $('#room-name').textContent = room.name; $('#room-code').textContent = code;
  $('#me-chip').textContent = isGM() ? 'Mestre' : S.me.name;
  document.querySelector('[data-tab="mestre"]').hidden = !isGM();
  document.querySelector('[data-tab="eu"]').hidden = isGM();
  drawPitch(); drawCity();
  setMode(room.view === 'cidade' ? 'cidade' : 'campo', false);

  if (!S.matches.length && isGM()) { await novaPartida('Partida 1'); return; }
  const active = room.active_match && S.matches.find(m => m.id === room.active_match) ? room.active_match : S.matches[S.matches.length - 1]?.id;
  if (active) await loadMatch(active); else { listen(); renderAll(); }
}

async function loadMatch(id) {
  const m = S.matches.find(x => x.id === id) || (await S.store.select('matches', { id }))[0];
  if (!m) return;
  S.match = m; S.match.state = { ...estadoInicial(), ...(m.state || {}) };
  const toks = await S.store.select('tokens', { match_id: id });
  S.tokens = new Map(toks.map(t => [t.id, t]));
  S.rolls = await S.store.select('rolls', { match_id: id }, { order: 'created_at', asc: false, limit: 50 });
  S.selected = null; S.liveTok.clear(); S.liveBall = null; S.lastRoll = null;
  listen(); renderAll();
}

function listen() {
  if (S.live) S.live.close();
  const specs = [
    { table: 'rooms', filter: `code=eq.${S.code}` },
    { table: 'matches', filter: `room_code=eq.${S.code}` },
    { table: 'players', filter: `room_code=eq.${S.code}` },
    { table: 'periods', filter: `room_code=eq.${S.code}` },
  ];
  if (S.match) specs.push({ table: 'tokens', filter: `match_id=eq.${S.match.id}` }, { table: 'rolls', filter: `match_id=eq.${S.match.id}` });
  const conn = $('#conn'); conn.className = 'conn';
  S.live = S.store.listen(`sala-${S.code}-${S.match?.id || 'x'}`, specs, onChange, onLive, st => {
    conn.className = 'conn ' + (st === 'SUBSCRIBED' ? 'on' : (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') ? 'off' : '');
    conn.title = st === 'SUBSCRIBED' ? 'Conectado ao vivo' : 'Sem conexão ao vivo';
  });
}

function onChange(table, type, n, o) {
  if (table === 'tokens') {
    if (type === 'DELETE') { S.tokens.delete(o.id); if (S.selected === o.id) S.selected = null; }
    else {
      const cur = S.tokens.get(n.id);
      if (cur && S.drag && S.drag.kind === 'tok' && S.drag.id === n.id) { const { x, y } = cur; Object.assign(cur, n, { x, y }); }
      else { S.tokens.set(n.id, n); S.liveTok.delete(n.id); }
    }
    renderTokens(); if (S.tab === 'token' || S.tab === 'eu' || S.tab === 'mestre') renderTab();
  } else if (table === 'matches') {
    if (type === 'DELETE') {
      S.matches = S.matches.filter(m => m.id !== o.id);
      renderMatchSelect();
      return;
    }
    const i = S.matches.findIndex(m => m.id === n.id);
    if (i >= 0) S.matches[i] = n; else S.matches.push(n);
    if (S.match && n.id === S.match.id) {
      S.match.name = n.name; S.match.state = { ...estadoInicial(), ...(n.state || {}) };
      S.liveBall = null;
      renderScore(); renderZones(); renderTokens();
      if (S.tab === 'partida' || S.tab === 'mestre' || S.tab === 'token') renderTab();
    }
    renderMatchSelect();
  } else if (table === 'rolls') {
    if (type === 'INSERT') { S.rolls.unshift(n); S.rolls = S.rolls.slice(0, 50); if (S.tab === 'dados') renderDados(); if (n.kind === 'roll' && n.who !== S.me.name) toast(`${n.who}: ${n.data?.total}${n.data?.nat === 20 ? ' (20 natural!)' : ''}`); }
  } else if (table === 'players') {
    if (type === 'DELETE') S.players = S.players.filter(p => p.id !== o.id);
    else {
      const i = S.players.findIndex(p => p.id === n.id); if (i >= 0) S.players[i] = n; else S.players.push(n);
      if (S.player && n.id === S.player.id) S.player = n;
    }
    renderCity();
    if (S.tab !== 'dados') renderTab();
  } else if (table === 'periods') {
    if (type === 'DELETE') S.periods = S.periods.filter(p => p.id !== o.id);
    else { const i = S.periods.findIndex(p => p.id === n.id); if (i >= 0) S.periods[i] = n; else S.periods.push(n); }
    if (S.tab === 'semana' || S.tab === 'local') renderTab();
  } else if (table === 'rooms' && type === 'UPDATE') {
    const viewChanged = (n.view || 'campo') !== (S.room.view || 'campo');
    const weekChanged = (n.semana || 1) !== (S.room.semana || 1);
    S.room = n; $('#room-name').textContent = n.name;
    if (viewChanged && !isGM()) setMode(n.view === 'cidade' ? 'cidade' : 'campo', false);
    if (weekChanged) { $('#week-label').textContent = `Semana ${n.semana || 1}`; if (S.tab === 'semana') renderTab(); }
    if (n.active_match && (!S.match || n.active_match !== S.match.id)) loadMatch(n.active_match);
  }
}

function leave() {
  if (S.live) S.live.close();
  lsSet('eda-session', null);
  location.href = location.pathname + (S.store.local ? '?local=1' : '');
}

// ================= lobby =================
function showLobby(code) {
  $('#app').hidden = true; $('#lobby').hidden = false;
  const fj = $('#form-join');
  if (code) fj.code.value = code;
  const last = lsGet('eda-session', null);
  if (last?.name && last.role !== 'gm') fj.nick.value = last.name;
  const sync = () => {
    const gm = fj.role.value === 'gm';
    fj.querySelector('[data-for="player"]').hidden = gm;
    fj.querySelector('[data-for="gm"]').hidden = !gm;
  };
  fj.querySelectorAll('input[name=role]').forEach(r => r.addEventListener('change', sync)); sync();
}

async function boot() {
  try { S.store = await createStore(); }
  catch (e) { $('#boot').textContent = 'Não consegui conectar ao banco. Recarregue a página.'; console.error(e); return; }

  $('#form-join').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.currentTarget, msg = f.querySelector('.form-msg'); msg.textContent = '';
    const btn = f.querySelector('button'); btn.disabled = true;
    try { await enterRoom(f.code.value, f.role.value, f.nick.value, f.pass.value); }
    catch (err) { msg.textContent = err.message; }
    btn.disabled = false;
  });
  $('#form-create').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.currentTarget, msg = f.querySelector('.form-msg'); msg.textContent = '';
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      const code = await S.store.rpc('create_room', { p_name: f.mesa.value, p_pass: f.pass.value });
      await enterRoom(code, 'gm', '', f.pass.value);
      toast(`Sala ${code} criada. Mande o link para os jogadores.`);
    } catch (err) { msg.textContent = err.message; }
    btn.disabled = false;
  });
  $('#btn-copy').addEventListener('click', copyLink);
  $('#btn-leave').addEventListener('click', leave);
  $('#match-select').addEventListener('change', async e => {
    if (!isGM()) return;
    await S.store.update('rooms', S.code, { active_match: e.target.value }, 'code');
    await loadMatch(e.target.value);
  });
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#mode-campo').addEventListener('click', () => setMode('campo', true));
  $('#mode-cidade').addEventListener('click', () => setMode('cidade', true));
  for (const k of ['zonas', 'cds', 'nomes', 'inverter', 'impedimento']) {
    const el = $('#opt-' + k); el.checked = !!S.opts[k];
    el.addEventListener('change', () => { S.opts[k] = el.checked; lsSet('eda-opts', S.opts); renderZones(); renderTokens(); });
  }
  $('#btn-seta').addEventListener('click', () => setArrowMode(!S.arrowMode));
  $('#arrow-tipo').addEventListener('change', e => { S.arrowTipo = e.target.value; });
  $('#btn-limpar').addEventListener('click', () => { if (S.match) saveState({ arrows: [] }); });
  window.addEventListener('resize', () => renderBall());

  const params = new URLSearchParams(location.search);
  const code = (params.get('sala') || '').toUpperCase();
  const sess = lsGet('eda-session', null);
  $('#boot').hidden = true;
  if (sess && sess.code && (!code || code === sess.code)) {
    try { await enterRoom(sess.code, sess.role, sess.name, sess.pass); return; }
    catch (e) { toast(e.message); }
  }
  showLobby(code);
}

boot();
