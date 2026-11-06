// Camada de dados. Usa o Supabase; com ?local=1 na URL usa um banco local (só para testes, entre abas do mesmo navegador).
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const LOCAL = new URLSearchParams(location.search).has('local');

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
}

function parseFilter(f) {
  const [col, rest] = f.split('=');
  return [col, rest.replace(/^eq\./, '')];
}

// ---------------- Supabase ----------------
async function supabaseStore() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  return {
    local: false,
    async select(table, where = {}, { order, asc = true, limit } = {}) {
      let q = sb.from(table).select('*');
      for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
      if (order) q = q.order(order, { ascending: asc });
      if (limit) q = q.limit(limit);
      return chk(await q);
    },
    async insert(table, rows) { return chk(await sb.from(table).insert(rows).select()); },
    async upsert(table, rows) { return chk(await sb.from(table).upsert(rows).select()); },
    async update(table, id, patch, key = 'id') { return chk(await sb.from(table).update(patch).eq(key, id)); },
    async remove(table, id, key = 'id') { return chk(await sb.from(table).delete().eq(key, id)); },
    async removeWhere(table, where) {
      let q = sb.from(table).delete();
      for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
      return chk(await q);
    },
    async rpc(name, args) { return chk(await sb.rpc(name, args)); },
    async upload(file) {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${uid()}.${ext}`;
      chk(await sb.storage.from('fotos').upload(path, file, { contentType: file.type, upsert: false }));
      return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
    },
    // specs: [{table, filter}] ; onChange(table, type, newRow, oldRow); onDrag(payload)
    listen(name, specs, onChange, onBroadcast, onStatus) {
      const ch = sb.channel(name, { config: { broadcast: { self: false } } });
      for (const s of specs) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: s.table, filter: s.filter },
          p => onChange(s.table, p.eventType, p.new, p.old));
      }
      ch.on('broadcast', { event: 'live' }, p => onBroadcast && onBroadcast(p.payload));
      let status = 'connecting';
      ch.subscribe(st => { status = st; onStatus && onStatus(st); });
      return {
        send(payload) { if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'live', payload }); },
        close() { sb.removeChannel(ch); },
      };
    },
  };
}

// ---------------- Local (testes) ----------------
function localStore() {
  const KEY = 'eda-local-db';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  const bc = new BroadcastChannel('eda-local');
  const listeners = new Set();
  const pk = t => (t === 'rooms' ? 'code' : 'id');
  const emit = (table, type, n, o) => {
    const msg = { kind: 'change', table, type, n, o };
    bc.postMessage(msg); listeners.forEach(l => l(msg));
  };
  bc.onmessage = e => listeners.forEach(l => l(e.data));
  const match = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  const now = () => new Date().toISOString();
  const defaults = {
    matches: { state: {} }, tokens: { res: {}, photo: '', owner: '', important: false, name: '', bench: false },
    players: { skills: {}, local: 'dormitorio' }, rolls: { data: {}, kind: 'roll' },
    periods: { local: '', atividade: '', nota: '', resultado: '' },
  };

  return {
    local: true,
    async select(table, where = {}, { order, asc = true, limit } = {}) {
      let rows = (load()[table] || []).filter(r => match(r, where));
      if (order) rows.sort((a, b) => (a[order] > b[order] ? 1 : -1) * (asc ? 1 : -1));
      if (limit) rows = rows.slice(0, limit);
      return structuredClone(rows);
    },
    async insert(table, rows) {
      const db = load(); db[table] = db[table] || [];
      const out = [].concat(rows).map(r => ({ ...(defaults[table] || {}), id: uid(), created_at: now(), ...r }));
      db[table].push(...out); save(db);
      out.forEach(r => emit(table, 'INSERT', r, null));
      return structuredClone(out);
    },
    async upsert(table, rows) {
      const db = load(); db[table] = db[table] || [];
      const out = [];
      for (const r of [].concat(rows)) {
        const i = db[table].findIndex(x => x[pk(table)] === r[pk(table)]);
        if (i >= 0) { const o = db[table][i]; db[table][i] = { ...o, ...r }; out.push(db[table][i]); emit(table, 'UPDATE', db[table][i], o); }
        else { const n = { ...(defaults[table] || {}), created_at: now(), ...r }; db[table].push(n); out.push(n); emit(table, 'INSERT', n, null); }
      }
      save(db); return structuredClone(out);
    },
    async update(table, id, patch, key = 'id') {
      const db = load();
      for (const [i, r] of (db[table] || []).entries()) {
        if (r[key] === id) { const n = { ...r, ...patch }; db[table][i] = n; emit(table, 'UPDATE', n, r); }
      }
      save(db);
    },
    async remove(table, id, key = 'id') {
      const db = load();
      const gone = (db[table] || []).filter(r => r[key] === id);
      db[table] = (db[table] || []).filter(r => r[key] !== id); save(db);
      gone.forEach(r => emit(table, 'DELETE', {}, r));
    },
    async removeWhere(table, where) {
      const db = load();
      const gone = (db[table] || []).filter(r => match(r, where));
      db[table] = (db[table] || []).filter(r => !match(r, where)); save(db);
      gone.forEach(r => emit(table, 'DELETE', {}, r));
    },
    async rpc(name, a) {
      const db = load(); db.secrets = db.secrets || {};
      if (name === 'create_room') {
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        db.rooms = db.rooms || []; db.rooms.push({ code, name: a.p_name || 'Mesa', active_match: null, created_at: now() });
        db.secrets[code] = { pass: a.p_pass, data: {} }; save(db); return code;
      }
      const s = db.secrets[a.p_room];
      const ok = !!s && s.pass === a.p_pass;
      if (name === 'check_gm') return ok;
      if (!ok) throw new Error('senha errada');
      if (name === 'get_secrets') return s.data;
      if (name === 'set_secrets') { s.data = a.p_data; save(db); return null; }
    },
    async upload(file) {
      return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    },
    listen(name, specs, onChange, onBroadcast, onStatus) {
      setTimeout(() => onStatus && onStatus('SUBSCRIBED'), 0);
      const l = msg => {
        if (msg.kind === 'live') { if (msg.name === name) onBroadcast && onBroadcast(msg.payload); return; }
        for (const s of specs) {
          if (s.table !== msg.table) continue;
          const [col, val] = parseFilter(s.filter);
          const row = msg.type === 'DELETE' ? msg.o : msg.n;
          if (String(row[col]) === val) onChange(msg.table, msg.type, msg.n, msg.o);
        }
      };
      listeners.add(l);
      return {
        send(payload) { bc.postMessage({ kind: 'live', name, payload }); },
        close() { listeners.delete(l); },
      };
    },
  };
}

export async function createStore() {
  return LOCAL ? localStore() : await supabaseStore();
}

export { uid };
