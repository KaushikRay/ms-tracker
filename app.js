'use strict';
/* MS Tracker v2 — everything is stored only on this device. */

/* ================= definitions ================= */
const MORNING = { k: 'morning', n: 'Morning pain', q: 'How bad was the pain when you woke up?',
  syn: ['morning pain', 'pain in the morning', 'pain this morning', 'waking pain', 'wake up pain', 'pain on waking', 'pain when i woke up', 'pain when i wake up', 'pain when waking'] };
const BASE = [
  { k: 'fatigue', n: 'Fatigue', q: 'How bad was your fatigue today?', syn: ['fatigue', 'tiredness', 'tired', 'exhaustion', 'exhausted'] },
  { k: 'pain', n: 'Pain during the day', q: 'How bad was your pain during the day?', syn: ['pain', 'aching', 'ache'] },
  { k: 'spasticity', n: 'Stiffness / spasms', q: 'How bad were stiffness or spasms?', syn: ['spasticity', 'stiffness', 'spasms', 'spasm', 'stiff', 'cramps', 'cramp'] },
  { k: 'numbness', n: 'Numbness / tingling', q: 'How bad was numbness or tingling?', syn: ['numbness', 'tingling', 'numb', 'pins and needles'] },
  { k: 'balance', n: 'Balance / walking', q: 'How hard were balance and walking?', syn: ['balance', 'dizziness', 'dizzy', 'walking'] },
  { k: 'vision', n: 'Vision', q: 'How bad were vision problems?', syn: ['vision', 'eyesight', 'blurry', 'blurred'] },
  { k: 'fog', n: 'Brain fog', q: 'How bad was brain fog?', syn: ['brain fog', 'fog', 'concentration', 'memory'] },
  { k: 'mood', n: 'Low mood / anxiety', q: 'How low or anxious did you feel?', syn: ['mood', 'anxiety', 'anxious', 'depressed'] },
  { k: 'bladder', n: 'Bladder / bowel', q: 'How bad were bladder or bowel problems?', syn: ['bladder', 'bowel', 'urgency'] },
];
const DEFAULT_TRACKED = ['fatigue', 'pain', 'spasticity', 'numbness', 'balance', 'vision', 'fog', 'mood'];
const FACTORS = [
  { k: 'heat', n: 'Heat', d: 'Hot weather, bath, shower or sauna', i: '🌡️' },
  { k: 'exercise', n: 'Active', d: 'Walk, gym, physio, yoga', i: '🚶' },
  { k: 'ill', n: 'Cold or infection', d: 'Fever, flu, UTI, Covid', i: '🤒' },
  { k: 'alcohol', n: 'Alcohol', d: 'Any amount', i: '🍷' },
];
const DEFAULT_REASONS = ['Work', 'Deadlines / pressure', 'Relationship', 'Family', 'Friends / social', 'Day-to-day stress', 'Illness / health worries', 'MS uncertainty / future', 'Medical appointments / tests', 'Money / bills', 'Housing / moving', 'Travel / transport', 'Noise / crowds', 'Poor sleep', 'Pain or fatigue itself', 'Loneliness', 'Caregiving', 'Other'];
const REASON_KW = [
  ['Work', /\b(work|job|boss|office|colleagues?|manager|meetings?)\b/],
  ['Deadlines / pressure', /\b(deadlines?|pressure|overwhelmed)\b/],
  ['Relationship', /\b(relationship|partner|girlfriend|boyfriend|wife|husband|argument|argued|fight|fought)\b/],
  ['Family', /\b(family|mother|father|mom|mum|dad|parents|brother|sister|kids|children)\b/],
  ['Friends / social', /\b(friends?|social)\b/],
  ['Day-to-day stress', /\b(day to day|day-to-day|daily life|chores|errands)\b/],
  ['Illness / health worries', /\b(illness|health worries|worried about my health|health anxiety)\b/],
  ['MS uncertainty / future', /\b(future|uncertain|uncertainty|progression|mri results?)\b/],
  ['Medical appointments / tests', /\b(appointment|doctor|neurologist|hospital|test results?)\b/],
  ['Money / bills', /\b(money|bills?|rent|finances?|financial|debt)\b/],
  ['Housing / moving', /\b(moving|landlord|apartment|flat|housing)\b/],
  ['Travel / transport', /\b(travel|trip|flight|train|commute|traffic)\b/],
  ['Noise / crowds', /\b(noise|noisy|crowds?|crowded)\b/],
  ['Poor sleep', /\b(bad sleep|poor sleep|couldn't sleep|could not sleep|insomnia)\b/],
  ['Loneliness', /\b(lonely|loneliness|isolated)\b/],
  ['Caregiving', /\b(caregiving|caring for)\b/],
];
const EVENT_TYPES = { relapse: 'New or worse symptom', appointment: 'Appointment', mri: 'MRI / scan', med: 'Medication change', other: 'Other' };
const NUMW = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const SLEEPQ = { poor: 'Poor', ok: 'OK', good: 'Good' };

/* ================= storage ================= */
const KEY = 'ms-tracker-v1';
let memFallback = false;
function defaults() { return { v: 2, entries: {}, events: [], questions: '', settings: { tracked: DEFAULT_TRACKED.slice(), customSyms: [], customReasons: [], lastBackup: null } }; }
function migrate(o) {
  const s = Object.assign(defaults(), o || {});
  s.settings = Object.assign(defaults().settings, (o && o.settings) || {});
  if (o && Array.isArray(o.customReasons)) { s.settings.customReasons = Array.from(new Set([...s.settings.customReasons, ...o.customReasons])); delete s.customReasons; }
  s.entries = s.entries || {}; s.events = s.events || [];
  s.v = 2; return s;
}
function load() { try { const r = localStorage.getItem(KEY); return migrate(r ? JSON.parse(r) : null); } catch (e) { memFallback = true; return defaults(); } }
let store = load();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { memFallback = true; } }
function save() { persist(); if (Sync.st.on) { clearTimeout(Sync.mt); Sync.mt = setTimeout(markChanges, 300); schedule(); } }

/* ================= helpers ================= */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => ymd(new Date());
const eveningDate = () => new Date().getHours() < 4 ? addDays(todayStr(), -1) : todayStr();
function addDays(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function fmtDate(s, long) { return new Date(s + 'T12:00:00').toLocaleDateString(undefined, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' }); }
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const hrsFmt = h => (h % 1 ? h.toFixed(1) : String(h));
function rangeDates(n, end) { const e = end || todayStr(); const a = []; for (let i = n - 1; i >= 0; i--) a.push(addDays(e, -i)); return a; }
const entry = d => store.entries[d] || null;
const ensure = d => store.entries[d] || (store.entries[d] = { s: {} });
const word = v => v == null ? '' : v === 0 ? 'None' : v <= 3 ? 'Mild' : v <= 6 ? 'Moderate' : v <= 9 ? 'Severe' : 'Worst possible';
const hue = v => 150 - v * 15;

function customSymDefs() { return (store.settings.customSyms || []).map(c => ({ k: c.k, n: c.n, q: `How bad was ${c.n.toLowerCase()} today?`, syn: [c.n.toLowerCase()], custom: true })); }
function allSyms() { return [MORNING, ...BASE, ...customSymDefs()]; }
function eveningSyms() { const t = store.settings.tracked; return [...BASE, ...customSymDefs()].filter(s => t.includes(s.k)); }
function symDef(k) { return allSyms().find(s => s.k === k) || { k, n: k, q: k, syn: [] }; }
function allReasons() { return [...DEFAULT_REASONS, ...(store.settings.customReasons || [])]; }
function hasEvening(e) { return !!(e && (e.eDone || Object.keys(e.s || {}).some(k => k !== 'morning') || e.stress != null)); }
function overall(e) { const v = eveningSyms().map(s => e && e.s && e.s[s.k]).filter(x => x != null); return v.length ? mean(v) : null; }
function metricVal(e, key) { if (!e) return null; if (key === 'overall') return overall(e); if (key === 'stress') return e.stress == null ? null : e.stress; const v = e.s && e.s[key]; return v == null ? null : v; }

/* ================= voice / text parser ================= */
function normalize(t) {
  t = String(t || '').toLowerCase().replace(/’/g, "'");
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, m => NUMW[m]);
  t = t.replace(/\s*(out of|\/)\s*10\b/g, '');
  return t;
}
function parseText(raw, syms) {
  syms = syms || allSyms();
  let t = normalize(raw);
  const out = { s: {}, found: [] };
  const clamp = n => Math.max(0, Math.min(10, n));
  for (const sym of syms) {
    for (const syn0 of sym.syn) {
      const syn = reEsc(syn0);
      const re2 = new RegExp('\\b(\\d{1,2})\\s+(?:for|of|on)\\s+(?:my\\s+)?' + syn + '\\b');
      const re1 = new RegExp('\\b' + syn + '\\b[^0-9.,;]{0,20}?(\\d{1,2})\\b(?!\\s*(?:hours|hrs|hr|h)\\b)');
      const reNo = new RegExp('\\b(?:no|without)\\s+' + syn + '\\b');
      let m;
      if ((m = t.match(re2)) || (m = t.match(re1))) { out.s[sym.k] = clamp(+m[1]); t = t.replace(m[0], ' '); break; }
      if (reNo.test(t)) { out.s[sym.k] = 0; t = t.replace(reNo, ' '); break; }
    }
    if (out.s[sym.k] !== undefined) out.found.push(sym.n + ' ' + out.s[sym.k]);
  }
  let m;
  if ((m = t.match(/(?:slept|sleep)[^0-9]{0,15}(\d+(?:\.\d+)?)\s*(?:hours|hrs|hr|h)\b/)) || (m = t.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|hr|h)\s*(?:of\s)?sleep/))) {
    out.sleep = Math.min(14, +m[1]); out.found.push('Slept ' + hrsFmt(out.sleep) + ' h');
  }
  if (/\b(slept (badly|poorly|terribly|awful)|bad sleep|poor sleep|bad night|terrible night|restless night)\b/.test(t)) { out.sleepQ = 'poor'; out.found.push('Poor sleep'); }
  else if (/\b(slept well|good sleep|good night|slept great)\b/.test(t)) { out.sleepQ = 'good'; out.found.push('Good sleep'); }
  if ((m = t.match(/stress(?:ed)?[^0-9.,;]{0,15}(\d{1,2})\b/))) { out.stress = clamp(+m[1]); out.found.push('Stress ' + out.stress); }
  if (/\b(hot|heat|overheated|sauna|heatwave)\b/.test(t) && !/\b(no|not)\s+(hot|heat)/.test(t)) { out.heat = true; out.found.push('Heat'); }
  if (/\b(exercis\w*|workout|gym|walked|swam|swim|yoga|jogged|cycling|physio\w*)\b/.test(t)) { out.exercise = true; out.found.push('Active'); }
  if (/\b(missed|forgot|skipped)\b[^.]{0,25}\b(meds|medication|injection|tablets?|dose|pills?)\b/.test(t)) { out.meds = false; out.found.push('Missed a dose'); }
  else if (/\b(took|taken|had)\b[^.]{0,12}\b(meds|medication|injection|tablets?|dose|pills?)\b/.test(t)) { out.meds = true; out.found.push('Took medication'); }
  if (/\b(sick|ill|cold|flu|fever|infection|uti|covid)\b/.test(t) && !/\bno\s+(fever|infection)/.test(t)) { out.ill = true; out.found.push('Cold or infection'); }
  if (/\b(alcohol|drank|beer|wine|cocktails?)\b/.test(t)) { out.alcohol = true; out.found.push('Alcohol'); }
  if (/\b(stress|stressed|stressful|worried|worry|pressure|tense|overwhelmed|argument|argued|fight|anxious)\b/.test(t)) {
    const all = allReasons();
    const why = REASON_KW.filter(r => r[1].test(t)).map(r => r[0]);
    (store.settings.customReasons || []).forEach(c => { if (new RegExp('\\b' + reEsc(c.toLowerCase()) + '\\b').test(t)) why.push(c); });
    const w = why.filter(x => all.includes(x));
    if (w.length) { out.why = Array.from(new Set(w)); out.found.push('Stress: ' + out.why.join(', ')); }
  }
  return out;
}
function applyParsed(p, date, text) {
  const e = ensure(date);
  Object.assign(e.s, p.s);
  ['sleep', 'sleepQ', 'stress', 'heat', 'exercise', 'meds', 'ill', 'alcohol'].forEach(k => { if (p[k] !== undefined) e[k] = p[k]; });
  if (p.why) e.stressWhy = Array.from(new Set([...(e.stressWhy || []), ...p.why]));
  const t = (text || '').trim();
  if (t && !(e.note || '').includes(t)) e.note = ((e.note || '') + (e.note ? '\n' : '') + t).trim();
  save();
}

/* ================= analysis ================= */
function patterns(dates) {
  const rows = dates.map(d => [d, entry(d)]).filter(r => r[1]);
  const why = e => Array.isArray(e.stressWhy) ? e.stressWhy : [];
  const ev = (e, v) => hasEvening(e) ? v : null;
  const F = [ // [label, test, sameDayForMorning]
    ['hot days', e => ev(e, !!e.heat)],
    ['nights under 6 h sleep', e => e.sleep == null ? null : e.sleep < 6, true],
    ['poor-sleep nights', e => e.sleepQ == null ? null : e.sleepQ === 'poor', true],
    ['high-stress days (7+)', e => e.stress == null ? null : e.stress >= 7],
    ['days with a cold or infection', e => ev(e, !!e.ill)],
    ['active days', e => ev(e, !!e.exercise)],
    ['days with alcohol', e => ev(e, !!e.alcohol)],
    ['days with a missed dose', e => ev(e, e.meds === false)],
  ];
  const cnt = {};
  rows.forEach(r => why(r[1]).forEach(w => { cnt[w] = (cnt[w] || 0) + 1; }));
  Object.keys(cnt).filter(w => cnt[w] >= 3).forEach(w => F.push(['days stressed by ' + w.toLowerCase(), e => ev(e, why(e).includes(w))]));
  const res = [];
  for (const sym of allSyms()) {
    const isM = sym.k === 'morning';
    for (const [label, fn, same] of F) {
      const prevDay = isM && !same;
      const a = [], b = [];
      for (const [d, e] of rows) {
        const v = e.s && e.s[sym.k]; if (v == null) continue;
        const src = prevDay ? entry(addDays(d, -1)) : e; if (!src) continue;
        const r = fn(src); if (r === null) continue;
        (r ? a : b).push(v);
      }
      if (a.length >= 3 && b.length >= 3) {
        const diff = mean(a) - mean(b);
        if (Math.abs(diff) >= 1.5) {
          const w = prevDay ? 'the morning after' : 'on';
          res.push({ diff, worse: diff > 0, text: `${sym.n} averaged ${f1(mean(a))} ${w} ${a.length} ${label}, vs ${f1(mean(b))} ${w} ${b.length} other days.` });
        }
      }
    }
  }
  return res.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 8);
}
function avgFor(dates, key) { const v = dates.map(d => metricVal(entry(d), key)).filter(x => x != null); return v.length ? { avg: mean(v), n: v.length, max: Math.max(...v) } : null; }
function reasonCounts(dates) { const c = {}; dates.forEach(d => { const e = entry(d); (e && e.stressWhy || []).forEach(w => { c[w] = (c[w] || 0) + 1; }); }); return Object.entries(c).sort((a, b) => b[1] - a[1]); }

function reportText(n) {
  const dates = rangeDates(n), prev = rangeDates(n, addDays(dates[0], -1));
  const rows = dates.map(d => [d, entry(d)]).filter(r => r[1]);
  const L = [];
  L.push(`MS symptom summary: ${fmtDate(dates[0])} to ${fmtDate(dates[n - 1])}`);
  L.push(`Days logged: ${rows.length} of ${n}`);
  L.push('');
  L.push('Symptoms (0 = none, 10 = worst): average, peak, previous ' + n + ' days');
  for (const s of allSyms()) {
    const a = avgFor(dates, s.k); if (!a) continue;
    const p = avgFor(prev, s.k);
    L.push(`- ${s.n}: avg ${f1(a.avg)}, peak ${a.max} (${a.n} days)${p ? `; previously ${f1(p.avg)}` : ''}`);
  }
  L.push('  Morning pain is rated on waking; patterns compare it with the previous day.');
  L.push('');
  L.push('Context:');
  const sl = rows.filter(r => r[1].sleep != null).map(r => r[1].sleep);
  if (sl.length) L.push(`- Sleep: average ${f1(mean(sl))} h; under 6 h on ${sl.filter(x => x < 6).length} nights; poor quality on ${rows.filter(r => r[1].sleepQ === 'poor').length} nights`);
  const st = avgFor(dates, 'stress'); if (st) L.push(`- Stress: average ${f1(st.avg)}, peak ${st.max}`);
  const rc = reasonCounts(dates).slice(0, 5); if (rc.length) L.push('- Main stress reasons: ' + rc.map(x => `${x[0]} (${x[1]} days)`).join(', '));
  const c = fn => rows.filter(r => fn(r[1])).length;
  L.push(`- Heat on ${c(e => e.heat)} days; cold/infection on ${c(e => e.ill)} days; missed medication on ${c(e => e.meds === false)} days; active on ${c(e => e.exercise)} days; alcohol on ${c(e => e.alcohol)} days`);
  const evs = store.events.filter(e => e.date >= dates[0] && e.date <= dates[n - 1]).sort((a, b) => a.date.localeCompare(b.date));
  if (evs.length) { L.push(''); L.push('Events:'); evs.forEach(e => L.push(`- ${fmtDate(e.date)}: ${EVENT_TYPES[e.type] || e.type}${e.text ? ': ' + e.text : ''}`)); }
  const pt = patterns(dates);
  if (pt.length) { L.push(''); L.push('Possible patterns (self-tracked, not proof of cause):'); pt.forEach(p => L.push('- ' + p.text)); }
  const notes = rows.filter(r => r[1].note).slice(-8);
  if (notes.length) { L.push(''); L.push('Recent notes:'); notes.forEach(r => L.push(`- ${fmtDate(r[0])}: ${r[1].note.replace(/\n/g, ' / ')}`)); }
  if (store.questions && store.questions.trim()) { L.push(''); L.push('Questions for my appointment:'); L.push(store.questions.trim()); }
  return L.join('\n');
}
function csv() {
  const syms = allSyms();
  const head = ['date', ...syms.map(s => s.k), 'sleep_h', 'sleep_quality', 'stress', 'stress_reasons', 'heat', 'active', 'cold_infection', 'alcohol', 'medication', 'note'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const b = v => v == null ? '' : (v ? 1 : 0);
  const lines = [head.join(',')];
  Object.keys(store.entries).sort().forEach(d => {
    const e = store.entries[d];
    lines.push([d, ...syms.map(s => e.s && e.s[s.k] != null ? e.s[s.k] : ''), e.sleep ?? '', e.sleepQ || '', e.stress ?? '', q((e.stressWhy || []).join('; ')), b(e.heat), b(e.exercise), b(e.ill), b(e.alcohol), e.meds == null ? '' : (e.meds ? 'taken' : 'missed'), q(e.note)].join(','));
  });
  return lines.join('\n');
}

/* ================= optional cloud sync (end-to-end encrypted) ================= */
const FB_CONFIG = {
  apiKey: 'AIzaSyDuU3tcb8Ua5--EvcQG4jZWGMGcRG1L7oY',
  authDomain: 'ms-tracking-93129.firebaseapp.com',
  projectId: 'ms-tracking-93129',
  storageBucket: 'ms-tracking-93129.firebasestorage.app',
  messagingSenderId: '50518652472',
  appId: '1:50518652472:web:8ba313d17b17d49ed558cd',
};
const FB_VER = '10.12.2';
const SKEY = 'ms-tracker-sync';
const RKEY = 'ms-tracker-redirect';
const SYNC0 = () => ({ uid: null, email: null, on: false, seen: {}, h: {}, c: {}, lastS: 0, last: null });
const Sync = { st: SYNC0(), key: null, remote: null, fb: null, cfg: null, busy: false, connecting: false, err: '', ui: { step: 'in', msg: '', email: '' }, afterSync: null, timer: null, pendingUid: null };
try { Sync.st = Object.assign(SYNC0(), JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
function saveSync() { try { localStorage.setItem(SKEY, JSON.stringify(Sync.st)); } catch (e) {} }
function notify(info) { if (typeof Sync.afterSync === 'function') Sync.afterSync(info || {}); }
function schedule() { clearTimeout(Sync.timer); Sync.timer = setTimeout(() => { doSync(); }, 4000); }
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms || 20000))]);

/* ---- change tracking (hash per record) ---- */
function stable(o) {
  if (o === null || typeof o !== 'object') return JSON.stringify(o);
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}
function hash(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, c; i < s.length; i++) { c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function metaObj() { const s = Object.assign({}, store.settings); delete s.lastBackup; return { settings: s, questions: store.questions || '' }; }
function localItems() {
  const m = {};
  for (const d in store.entries) m['d_' + d] = store.entries[d];
  for (const e of store.events) m['e_' + e.id] = e;
  m.meta = metaObj();
  return m;
}
const isDirty = k => (Sync.st.seen[k] ?? null) !== (Sync.st.h[k] ?? null);
function markChanges() {
  const S = Sync.st; if (!S.on) return;
  const items = localItems(), now = Date.now(), first = Object.keys(S.seen).length === 0;
  for (const k in items) { const h = hash(stable(items[k])); if (S.seen[k] !== h) { S.seen[k] = h; S.c[k] = first ? 0 : now; } }
  for (const k of Object.keys(S.seen)) { if (!(k in items) && S.seen[k] !== null) { S.seen[k] = null; S.c[k] = now; } }
  saveSync();
}
function applyRemote(k, v) {
  if (k === 'meta') {
    if (v) { const lb = store.settings.lastBackup; store.settings = Object.assign(defaults().settings, v.settings || {}, { lastBackup: lb === undefined ? null : lb }); store.questions = v.questions || ''; }
  } else if (k.startsWith('d_')) {
    const d = k.slice(2); if (v) store.entries[d] = v; else delete store.entries[d];
  } else if (k.startsWith('e_')) {
    const id = k.slice(2); store.events = store.events.filter(e => e.id !== id); if (v) store.events.push(v);
  }
}

/* ---- encryption (AES-GCM, key from passphrase via PBKDF2) ---- */
const toB64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const fromB64 = b => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function deriveKey(pass, saltB64) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: 310000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encWith(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: toB64(iv), ct: toB64(ct) };
}
async function decWith(key, d) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(d.iv) }, key, fromB64(d.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('ms-tracker-sync', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function keyPut(uid, key) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(key, uid); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} }
async function keyGet(uid) { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction('k').objectStore('k').get(uid); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); } catch (e) { return null; } }
async function keyDel(uid) { try { const db = await idb(); await new Promise(res => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').delete(uid); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }

/* ---- the sync itself ---- */
async function doSync() {
  const S = Sync.st;
  if (!S.on || !Sync.key || !Sync.remote || Sync.busy) return null;
  Sync.busy = true; Sync.err = '';
  let pulled = 0, pushed = 0;
  try {
    markChanges();
    const docs = await withTimeout(Sync.remote.list(S.lastS));
    let maxS = S.lastS;
    for (const d of docs) {
      maxS = Math.max(maxS, d.s || 0);
      let p; try { p = await decWith(Sync.key, d); } catch (e) { continue; }
      const k = p.k, v = p.v === undefined ? null : p.v;
      if (k !== d.id) continue;
      if (isDirty(k) && (S.c[k] || 0) > (d.u || 0)) continue; // this device's change is newer: it gets pushed below
      applyRemote(k, v);
      const cur = localItems()[k];
      const hh = cur === undefined ? null : hash(stable(cur));
      S.seen[k] = hh; S.h[k] = hh; delete S.c[k]; pulled++;
    }
    persist();
    const items = localItems();
    for (const k of Object.keys(S.seen)) {
      if (!isDirty(k)) continue;
      const v = items[k] === undefined ? null : items[k];
      const enc = await encWith(Sync.key, { k, v });
      await withTimeout(Sync.remote.put(k, { iv: enc.iv, ct: enc.ct, u: S.c[k] || Date.now() }));
      S.h[k] = S.seen[k]; delete S.c[k]; pushed++;
    }
    S.lastS = maxS; S.last = Date.now(); saveSync();
    Sync.busy = false; notify({ pulled, pushed });
    return { pulled, pushed };
  } catch (e) {
    Sync.err = fbErr(e); Sync.busy = false; saveSync(); notify({ pulled: 0, pushed: 0 });
    return null;
  }
}

/* ---- Firebase (loaded only when sync is used) ---- */
function fbErr(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email. Use Create account.', 'auth/email-already-in-use': 'That email already has an account. Use Sign in.',
    'auth/weak-password': 'The password needs at least 6 characters.', 'auth/invalid-email': 'That email address looks wrong.',
    'auth/network-request-failed': 'No internet connection.', 'auth/unauthorized-domain': 'Firebase has not authorised this site address yet. Add it under Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.', 'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.', 'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'permission-denied': 'The database rules are blocking access. Check the rules in Firebase.', 'unavailable': 'Cannot reach the server. Check your connection.', 'timeout': 'The server did not answer in time. Check your connection.',
  };
  return m[c] || ('Something went wrong' + (c ? ' (' + c + ')' : '') + '.');
}
async function loadFb() {
  if (Sync.fb) return Sync.fb;
  const B = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
  const [app, auth, fs] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
  const a = app.initializeApp(FB_CONFIG);
  Sync.fb = { auth, fs, au: auth.getAuth(a), db: fs.initializeFirestore(a, { experimentalAutoDetectLongPolling: true }) };
  return Sync.fb;
}
const waitAuth = fb => new Promise(res => { const un = fb.auth.onAuthStateChanged(fb.au, u => { un(); res(u); }); });
function fsRemote(fb, uid) {
  const { fs, db } = fb, col = () => fs.collection(db, 'users', uid, 'items'), cfg = () => fs.doc(db, 'users', uid, 'config', 'key');
  return {
    async list(sinceMs) {
      const snap = await fs.getDocs(fs.query(col(), fs.where('s', '>', fs.Timestamp.fromMillis(sinceMs || 0))));
      return snap.docs.map(x => { const d = x.data(); return { id: x.id, iv: d.iv, ct: d.ct, u: d.u, s: d.s && d.s.toMillis ? d.s.toMillis() : 0 }; });
    },
    async put(k, d) { await fs.setDoc(fs.doc(db, 'users', uid, 'items', k), { iv: d.iv, ct: d.ct, u: d.u, s: fs.serverTimestamp() }); },
    async getConfig() { const s = await fs.getDoc(cfg()); return s.exists() ? s.data() : null; },
    async putConfig(c) { await fs.setDoc(cfg(), c); },
    async wipe() {
      const snap = await fs.getDocs(col()); let batch = fs.writeBatch(db), n = 0;
      for (const x of snap.docs) { batch.delete(x.ref); if (++n % 400 === 0) { await batch.commit(); batch = fs.writeBatch(db); } }
      await batch.commit(); await fs.deleteDoc(cfg());
    },
  };
}
const isStandalone = () => { try { return !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); } catch (e) { return false; } };
async function signInGoogle() {
  const fb = Sync.fb || await loadFb(); // preloaded when the Sync page opens, so the popup opens inside the tap
  const p = new fb.auth.GoogleAuthProvider();
  try { return (await fb.auth.signInWithPopup(fb.au, p)).user; }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) {
      try { localStorage.setItem(RKEY, '1'); } catch (x) {}
      await fb.auth.signInWithRedirect(fb.au, p); return null;
    }
    throw e;
  }
}
async function afterSignIn(user) {
  Sync.remote = fsRemote(Sync.fb, user.uid); Sync.pendingUid = user.uid; Sync.pendingEmail = user.email || '';
  Sync.cfg = await withTimeout(Sync.remote.getConfig());
  Sync.ui.step = Sync.cfg ? 'pass-existing' : 'pass-new'; Sync.ui.msg = '';
}
async function setPassphrase(pass, create) {
  const uid = Sync.pendingUid || Sync.st.uid; let key;
  if (create) {
    const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
    key = await deriveKey(pass, salt);
    const chk = await encWith(key, { ok: 'ms-tracker' });
    const cfg = { salt, iv: chk.iv, ct: chk.ct };
    await withTimeout(Sync.remote.putConfig(cfg)); Sync.cfg = cfg;
  } else {
    key = await deriveKey(pass, Sync.cfg.salt);
    try { const p = await decWith(key, Sync.cfg); if (!p || p.ok !== 'ms-tracker') return false; } catch (e) { return false; }
  }
  if (Sync.st.uid !== uid) Sync.st = Object.assign(SYNC0(), { uid, email: Sync.pendingEmail || Sync.st.email });
  Sync.st.on = true; Sync.st.email = Sync.pendingEmail || Sync.st.email; Sync.key = key; saveSync();
  await keyPut(uid, key);
  return true;
}
async function bootSync() {
  const S = Sync.st; if (!S.on) return;
  Sync.connecting = true; Sync.err = '';
  try {
    const fb = await withTimeout(loadFb(), 15000), user = await waitAuth(fb);
    if (!user || user.uid !== S.uid) { Sync.ui.step = 'in'; Sync.err = 'Signed out. Sign in again to resume sync.'; return; }
    Sync.remote = fsRemote(fb, user.uid);
    Sync.key = await keyGet(user.uid);
    if (!Sync.key) { Sync.cfg = await withTimeout(Sync.remote.getConfig()); Sync.ui.step = 'pass-existing'; Sync.pendingUid = user.uid; Sync.err = 'Enter your passphrase again to resume sync.'; return; }
    Sync.connecting = false; await doSync();
  } catch (e) { Sync.err = fbErr(e); }
  finally { Sync.connecting = false; notify(); }
}
async function signOutLocal() {
  const uid = Sync.st.uid;
  try { if (Sync.fb) await Sync.fb.auth.signOut(Sync.fb.au); } catch (e) {}
  if (uid) await keyDel(uid);
  Sync.st = SYNC0(); saveSync(); Sync.key = null; Sync.remote = null; Sync.cfg = null; Sync.err = '';
  Sync.ui = { step: 'in', msg: '', email: '' };
}

/* ================= UI ================= */
if (typeof document !== 'undefined') {
  let tab = 'home', flow = null, more = 'menu';
  let histMonth = todayStr().slice(0, 7), histMetric = 'morning', selDay = todayStr();
  let insRange = 30, insKey = 'morning', repDays = 30, voiceText = '', voiceDraft = null, evPreset = 'relapse', evDate = null, toastT;
  const armed = {};
  const root = document.getElementById('app');
  const $ = s => document.querySelector(s);
  const cellBg = v => v == null ? '' : `background:hsl(${hue(Math.round(v))} 70% 50% / ${(0.18 + v * 0.05).toFixed(2)})`;

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
  function download(name, text, mime) {
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); store.settings.lastBackup = todayStr(); save(); toast('Saved ' + name); render(true); }
    catch (e) { toast('Download not available here. Open the app from your own link.'); }
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Copy blocked. Select the text and copy it.'); } }
  function arm(key) {
    if (armed[key]) { delete armed[key]; return true; }
    armed[key] = true; render(true);
    setTimeout(() => { if (armed[key]) { delete armed[key]; if (!flow) render(true); } }, 4000);
    return false;
  }

  function render(keep) {
    document.body.classList.toggle('flowing', !!flow);
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    root.innerHTML = flow ? vFlow() : ({ home: vHome, history: vHistory, insights: vInsights, more: vMore })[tab]();
    if (!keep) window.scrollTo(0, 0);
  }

  const syncBadge = () => { const S = Sync.st; if (!S.on) return ''; return `<small class="sb">☁️ ${Sync.err ? 'Sync paused' : S.last ? 'Synced ' + new Date(S.last).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Syncing…'}</small>`; };
  /* ---------- HOME ---------- */
  function vHome() {
    const t = todayStr(), e = entry(t), ed = eveningDate(), ee = entry(ed);
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const mDone = e && e.s && e.s.morning != null;
    const eDone = ee && (ee.eDone || hasEvening(ee));
    const mCard = `<section class="card ck ${h < 12 && !mDone ? 'now' : ''}">
      <div class="ckh"><span class="em">🌅</span><div><h2>Morning check-in</h2><small>${mDone ? 'Done' : 'Morning pain and sleep · about 15 seconds'}</small></div>${mDone ? '<span class="ok">✓</span>' : ''}</div>
      ${mDone ? `<p class="sum">Morning pain <b>${e.s.morning}</b> ${word(e.s.morning).toLowerCase()}${e.sleep != null ? ` · slept <b>${hrsFmt(e.sleep)} h</b>` : ''}${e.sleepQ ? ` (${SLEEPQ[e.sleepQ].toLowerCase()})` : ''}</p><button class="lnk" data-a="start" data-v="morning|${t}">Edit</button>`
        : `<button class="btn pri big" data-a="start" data-v="morning|${t}">Start morning check-in</button>`}</section>`;
    const top = ee ? eveningSyms().filter(s => ee.s && ee.s[s.k] != null).sort((a, b) => ee.s[b.k] - ee.s[a.k]).slice(0, 3) : [];
    const eCard = `<section class="card ck ${h >= 17 && !eDone ? 'now' : ''}">
      <div class="ckh"><span class="em">🌙</span><div><h2>Evening check-in</h2><small>${eDone ? 'Done' : `Your day: ${eveningSyms().length} symptoms, stress, triggers · about a minute`}</small></div>${eDone ? '<span class="ok">✓</span>' : ''}</div>
      ${eDone ? `<p class="sum">${top.length ? top.map(s => `${esc(s.n)} <b>${ee.s[s.k]}</b>`).join(' · ') : 'Saved'}${ee.stress != null ? ` · stress <b>${ee.stress}</b>` : ''}</p><button class="lnk" data-a="start" data-v="evening|${ed}">Edit</button>`
        : `<button class="btn ${h >= 12 ? 'pri' : ''} big" data-a="start" data-v="evening|${ed}">Start evening check-in</button>`}</section>`;
    const week = rangeDates(7).map(d => {
      const x = entry(d), m = metricVal(x, 'morning'), o = metricVal(x, 'overall');
      return `<button class="wd ${d === t ? 'td' : ''}" data-a="day" data-v="${d}"><span>${new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span><i style="${cellBg(m)}">${m == null ? '·' : m}</i><i style="${cellBg(o)}">${o == null ? '·' : Math.round(o)}</i></button>`;
    }).join('');
    const nEntries = Object.keys(store.entries).length;
    const lb = store.settings.lastBackup;
    const needBackup = nEntries >= 7 && (!lb || lb < addDays(t, -14));
    return `<header class="top"><div><small>${fmtDate(t, true)}</small><h1>${greet}</h1></div>${syncBadge()}</header>
    ${memFallback ? '<div class="warn">Storage is blocked here, so entries will not be kept. Open the app from your own link or Home Screen icon.</div>' : ''}
    ${needBackup ? `<div class="warn">Your last backup was ${lb ? fmtDate(lb) : 'never'}. <button class="lnk" data-a="more" data-v="settings">Back up now</button></div>` : ''}
    ${h < 12 ? mCard + eCard : eCard + mCard}
    <section class="card"><h2>🎤 Quick log by voice</h2>
      <p class="hint">Say it in one go, e.g. "Morning pain 7, fatigue 5, slept 6 hours, stressed about work, hot day, took my meds."</p>
      <textarea id="vtext" rows="2" data-in="vtext" placeholder="Tap Dictate, or use the mic on your keyboard">${esc(voiceText)}</textarea>
      <div class="row2"><button class="btn mic" data-a="dict" data-v="vtext">🎤 Dictate</button><button class="btn" data-a="vreview">Review</button></div>
      ${voiceDraft ? `<div class="draft">${voiceDraft.p.found.length ? `<p class="hint">I understood:</p><div class="chips">${voiceDraft.p.found.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : '<p class="hint">No ratings recognised. It will be saved as a note.</p>'}
        <p class="hint">Saves to ${voiceDraft.date === t ? 'today' : fmtDate(voiceDraft.date, true)}.</p>
        <div class="row2"><button class="btn pri" data-a="vsave">Save</button><button class="btn ghost" data-a="vclear">Cancel</button></div></div>` : ''}</section>
    <section class="card"><div class="rowh"><h2>Last 7 days</h2><button class="lnk" data-a="tab" data-v="history">History ›</button></div>
      <div class="week">${week}</div>
      <p class="hint legend"><span>Top: morning pain</span><span>Bottom: day average</span></p></section>
    <section class="card soft"><h2>New or worse symptom?</h2>
      <p class="hint">If a new symptom, or a clear worsening of an old one, lasts more than 24 hours and you don't have a fever or infection, contact your neurology team.</p>
      <button class="btn" data-a="logev">Log it</button></section>
    ${nEntries === 0 ? `<p class="foot">New here? <button class="lnk" data-a="more" data-v="help">How to install and use the app</button></p>` : ''}`;
  }

  /* ---------- CHECK-IN FLOW ---------- */
  function startFlow(kind, date) {
    const steps = kind === 'morning'
      ? [{ t: 'scale', key: 'morning' }, { t: 'sleep' }, { t: 'done' }]
      : [...eveningSyms().map(s => ({ t: 'scale', key: s.k })), { t: 'scale', key: 'stress' }, { t: 'why' }, { t: 'factors' }, { t: 'note' }, { t: 'done' }];
    flow = { kind, date, steps, i: 0 };
    render();
  }
  const skipStep = st => st && st.t === 'why' && !(ensure(flow.date).stress > 0);
  function sleepDefault(date) { for (let i = 1; i <= 7; i++) { const x = entry(addDays(date, -i)); if (x && x.sleep != null) return x.sleep; } return 7; }
  function next() {
    const st = flow.steps[flow.i], e = ensure(flow.date);
    if (st.t === 'sleep' && e.sleep == null) { e.sleep = sleepDefault(flow.date); save(); }
    flow.i = Math.min(flow.steps.length - 1, flow.i + 1);
    while (skipStep(flow.steps[flow.i])) flow.i++;
    if (flow.steps[flow.i].t === 'done') { e[flow.kind === 'morning' ? 'mDone' : 'eDone'] = true; save(); }
    render();
  }
  function back() {
    if (flow.i === 0) { flow = null; render(); return; }
    flow.i--; while (flow.i > 0 && skipStep(flow.steps[flow.i])) flow.i--;
    render();
  }
  function vFlow() {
    const st = flow.steps[flow.i], e = ensure(flow.date), last = flow.steps.length - 1;
    const pct = Math.round(flow.i / last * 100);
    const head = `<div class="fhead"><button class="ic" data-a="back" aria-label="Back">‹</button><div class="prog"><i style="width:${pct}%"></i></div><button class="ic" data-a="close" aria-label="Close">✕</button></div>
      <p class="fdate">${flow.kind === 'morning' ? '🌅 Morning' : '🌙 Evening'} · ${flow.date === todayStr() ? 'Today' : fmtDate(flow.date, true)}</p>`;
    let body = '';
    if (st.t === 'scale') {
      const isS = st.key === 'stress';
      const sym = isS ? { n: 'Stress', q: 'How stressed were you today?' } : symDef(st.key);
      const v = isS ? e.stress : e.s[st.key];
      const y = entry(addDays(flow.date, -1)); const yv = y ? (isS ? y.stress : (y.s || {})[st.key]) : null;
      body = `<h1 class="q">${esc(sym.q)}</h1><p class="sub">${esc(sym.n)} · 0 = none, 10 = worst${st.key === 'morning' ? '<br>Rate it as it felt when you first got up.' : ''}</p>
        <div class="scale">${Array.from({ length: 11 }, (_, i) => `<button data-a="pick" data-v="${i}" class="n ${v === i ? 'sel' : ''}" style="--h:${hue(i)}" aria-label="${i}, ${word(i)}">${i}</button>`).join('')}</div>
        <p class="word">${v == null ? '&nbsp;' : word(v)}</p>
        <div class="row2">${yv != null ? `<button class="btn" data-a="same">Same as yesterday (${yv})</button>` : ''}<button class="btn ghost" data-a="skip">${v == null ? 'Skip' : 'Next'}</button></div>`;
    } else if (st.t === 'sleep') {
      const hrs = e.sleep != null ? e.sleep : sleepDefault(flow.date);
      body = `<h1 class="q">How did you sleep last night?</h1><p class="sub">Hours of actual sleep, roughly</p>
        <div class="stepper"><button class="ic big" data-a="hrs" data-v="-0.5" aria-label="Less">−</button><div><b>${hrsFmt(hrs)}</b><span>hours</span></div><button class="ic big" data-a="hrs" data-v="0.5" aria-label="More">+</button></div>
        <p class="sub">Quality</p>
        <div class="tiles3">${[['poor', '😣'], ['ok', '😐'], ['good', '🙂']].map(([k, i]) => `<button class="tile ${e.sleepQ === k ? 'on' : ''}" data-a="sq" data-v="${k}"><span>${i}</span>${SLEEPQ[k]}</button>`).join('')}</div>
        <button class="btn pri big" data-a="next">Next</button>`;
    } else if (st.t === 'why') {
      const ch = e.stressWhy || [];
      body = `<h1 class="q">What was behind the stress?</h1><p class="sub">Tap all that apply</p>
        <div class="tags">${allReasons().map(r => `<button class="tag ${ch.includes(r) ? 'on' : ''}" data-a="why" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
        <div class="addrow"><input type="text" id="newwhy" placeholder="Add your own reason" maxlength="40"><button class="btn" data-a="addwhy">Add</button></div>
        <button class="btn pri big" data-a="next">Next</button>`;
    } else if (st.t === 'factors') {
      body = `<h1 class="q">Anything that might matter today?</h1><p class="sub">Tap what applies. Leave the rest.</p>
        <div class="tiles2">${FACTORS.map(f => `<button class="tile ${e[f.k] ? 'on' : ''}" data-a="fac" data-v="${f.k}"><span>${f.i}</span>${f.n}<small>${f.d}</small></button>`).join('')}
        <button class="tile ${e.meds === true ? 'on' : ''}" data-a="meds" data-v="1"><span>💊</span>Took my medication<small>As planned</small></button>
        <button class="tile ${e.meds === false ? 'on warnon' : ''}" data-a="meds" data-v="0"><span>⏰</span>Missed a dose<small>Or took it late</small></button></div>
        <button class="btn pri big" data-a="next">Next</button>`;
    } else if (st.t === 'note') {
      body = `<h1 class="q">Anything else about today?</h1><p class="sub">Food, activities, how you felt. Optional.</p>
        <textarea id="fnote" rows="5" data-in="note" placeholder="Type, or tap Dictate">${esc(e.note || '')}</textarea>
        <div class="row2"><button class="btn mic" data-a="dict" data-v="fnote">🎤 Dictate</button></div>
        <button class="btn pri big" data-a="next">Save check-in</button>`;
    } else {
      const items = flow.kind === 'morning'
        ? [e.s.morning != null ? `Morning pain ${e.s.morning} · ${word(e.s.morning)}` : null, e.sleep != null ? `Slept ${hrsFmt(e.sleep)} h${e.sleepQ ? ', ' + SLEEPQ[e.sleepQ].toLowerCase() : ''}` : null]
        : [...eveningSyms().filter(s => e.s[s.k] != null).map(s => `${s.n} ${e.s[s.k]}`), e.stress != null ? `Stress ${e.stress}` : null, ...(e.stressWhy || []), ...FACTORS.filter(f => e[f.k]).map(f => f.n), e.meds === true ? 'Medication taken' : e.meds === false ? 'Missed a dose' : null];
      body = `<div class="done"><div class="big-ok">✓</div><h1 class="q">Saved</h1>
        <div class="chips c">${items.filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="hint">Nothing rated</span>'}</div>
        ${flow.kind === 'morning' ? '<p class="sub">See you this evening.</p>' : '<p class="sub">Rest well.</p>'}
        <button class="btn pri big" data-a="close">Done</button></div>`;
    }
    return head + `<div class="fbody">${body}</div>`;
  }

  /* ---------- HISTORY ---------- */
  function vHistory() {
    const t = todayStr(), [Y, M] = histMonth.split('-').map(Number);
    const first = new Date(Y, M - 1, 1), nd = new Date(Y, M, 0).getDate(), lead = (first.getDay() + 6) % 7;
    const evDays = new Set(store.events.map(e => e.date));
    const metrics = [['morning', 'Morning pain'], ['overall', 'Day average'], ...eveningSyms().map(s => [s.k, s.n]), ['stress', 'Stress']];
    const wk = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
    let cells = Array.from({ length: lead }, () => '<span></span>').join('');
    for (let d = 1; d <= nd; d++) {
      const ds = `${Y}-${pad(M)}-${pad(d)}`, v = metricVal(entry(ds), histMetric);
      cells += `<button class="cd ${ds === selDay ? 'sel' : ''} ${ds === t ? 'td' : ''}" data-a="day" data-v="${ds}" style="${cellBg(v)}" ${ds > t ? 'disabled' : ''}><span>${d}</span>${v != null ? `<b>${Math.round(v)}</b>` : ''}${evDays.has(ds) ? '<em></em>' : ''}</button>`;
    }
    const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `<h1>History</h1>
      <div class="hscroll">${metrics.map(([k, n]) => `<button class="tag ${k === histMetric ? 'on' : ''}" data-a="hmet" data-v="${k}">${esc(n)}</button>`).join('')}</div>
      <section class="card"><div class="mnav"><button class="ic" data-a="hm" data-v="-1" aria-label="Previous month">‹</button><h2>${monthName}</h2><button class="ic" data-a="hm" data-v="1" aria-label="Next month" ${histMonth >= t.slice(0, 7) ? 'disabled' : ''}>›</button></div>
        <div class="cal">${wk.map(w => `<small>${w}</small>`).join('')}${cells}</div>
        <div class="grad"><span>None</span><i></i><span>Worst</span></div><p class="hint">A dot marks an event (episode, appointment, MRI).</p></section>
      ${dayDetail(selDay)}`;
  }
  function dayDetail(d) {
    const e = entry(d), evs = store.events.filter(x => x.date === d);
    let inner = '';
    if (!e) inner = '<p class="hint">Nothing logged for this day.</p>';
    else {
      const rows = allSyms().filter(s => e.s && e.s[s.k] != null).map(s => `<div class="kv"><span>${esc(s.n)}</span><b style="${cellBg(e.s[s.k])}">${e.s[s.k]}</b></div>`);
      if (e.sleep != null || e.sleepQ) rows.push(`<div class="kv"><span>Sleep the night before</span><span>${e.sleep != null ? hrsFmt(e.sleep) + ' h' : ''}${e.sleepQ ? ' · ' + SLEEPQ[e.sleepQ] : ''}</span></div>`);
      if (e.stress != null) rows.push(`<div class="kv"><span>Stress</span><b style="${cellBg(e.stress)}">${e.stress}</b></div>`);
      inner = rows.join('');
      const tags = [...(e.stressWhy || []).map(w => 'Stress: ' + w), ...FACTORS.filter(f => e[f.k]).map(f => f.n), e.meds === true ? 'Medication taken' : e.meds === false ? 'Missed a dose' : null].filter(Boolean);
      if (tags.length) inner += `<div class="chips">${tags.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>`;
      if (e.note) inner += `<p class="note">${esc(e.note)}</p>`;
    }
    if (evs.length) inner += evs.map(x => `<div class="evi"><b>${esc(EVENT_TYPES[x.type] || x.type)}</b>${x.text ? ': ' + esc(x.text) : ''}</div>`).join('');
    return `<section class="card"><h2>${d === todayStr() ? 'Today' : fmtDate(d, true)}</h2>${inner}
      <div class="row2"><button class="btn" data-a="start" data-v="morning|${d}">${e && e.s && e.s.morning != null ? 'Edit' : 'Add'} morning</button><button class="btn" data-a="start" data-v="evening|${d}">${hasEvening(e) ? 'Edit' : 'Add'} evening</button></div>
      <button class="lnk" data-a="logev" data-v="${d}">+ Add an event on this day</button></section>`;
  }

  /* ---------- INSIGHTS ---------- */
  function lineChart(dates, key) {
    const W = 340, H = 170, L = 26, R = 8, T = 10, B = 22, n = dates.length;
    const x = i => L + (n < 2 ? 0 : i / (n - 1) * (W - L - R)), y = v => T + (1 - v / 10) * (H - T - B);
    const vals = dates.map(d => metricVal(entry(d), key));
    const pts = vals.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    if (pts.length < 2) return '<p class="hint">Log at least 2 days to see a chart.</p>';
    const ra = [];
    vals.forEach((v, i) => { const w = vals.slice(Math.max(0, i - 6), i + 1).filter(z => z != null); if (w.length >= 2) ra.push(x(i).toFixed(1) + ',' + y(mean(w)).toFixed(1)); });
    const grid = [0, 5, 10].map(g => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="gl"/><text x="${L - 6}" y="${y(g) + 4}" class="ax" text-anchor="end">${g}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(symName(key))} over time">${grid}
      ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" class="dot"/>`).join('')}
      ${ra.length > 1 ? `<polyline points="${ra.join(' ')}" class="avg"/>` : ''}
      <text x="${L}" y="${H - 4}" class="ax">${fmtDate(dates[0])}</text><text x="${W - R}" y="${H - 4}" class="ax" text-anchor="end">${fmtDate(dates[n - 1])}</text></svg>
      <p class="hint legend"><span><i class="lg dotl"></i>daily rating</span><span><i class="lg avgl"></i>7-day average</span></p>`;
  }
  const symName = k => k === 'stress' ? 'Stress' : k === 'overall' ? 'Day average' : symDef(k).n;
  function vInsights() {
    const dates = rangeDates(insRange), prev = rangeDates(insRange, addDays(dates[0], -1));
    const logged = dates.filter(d => entry(d)).length;
    const keys = [['morning', 'Morning pain'], ...eveningSyms().map(s => [s.k, s.n]), ['stress', 'Stress']];
    const cmp = keys.map(([k, n]) => { const a = avgFor(dates, k), p = avgFor(prev, k); if (!a) return ''; const d = p ? a.avg - p.avg : null;
      const arrow = d == null || Math.abs(d) < 0.5 ? '<span class="flat">–</span>' : d > 0 ? `<span class="up">▲ ${f1(Math.abs(d))}</span>` : `<span class="down">▼ ${f1(Math.abs(d))}</span>`;
      return `<div class="kv"><span>${esc(n)}</span><span><b style="${cellBg(a.avg)}">${f1(a.avg)}</b> ${arrow}</span></div>`; }).join('');
    const pt = patterns(dates);
    const rc = reasonCounts(dates).slice(0, 6), rmax = rc.length ? rc[0][1] : 1;
    return `<h1>Insights</h1>
      <div class="seg">${[30, 90, 180].map(n => `<button data-a="irange" data-v="${n}" class="${n === insRange ? 'on' : ''}">${n} days</button>`).join('')}</div>
      <p class="hint">${logged} of ${insRange} days logged.${logged < 10 ? ' Patterns get more reliable after 2–3 weeks of check-ins.' : ''}</p>
      <section class="card"><div class="hscroll">${keys.map(([k, n]) => `<button class="tag ${k === insKey ? 'on' : ''}" data-a="ikey" data-v="${k}">${esc(n)}</button>`).join('')}</div>${lineChart(dates, insKey)}</section>
      <section class="card"><h2>Averages</h2><p class="hint">Compared with the ${insRange} days before. ▲ means worse.</p>${cmp || '<p class="hint">No data yet.</p>'}</section>
      <section class="card"><h2>Possible patterns</h2>
        ${pt.length ? pt.map(p => `<p class="pat ${p.worse ? 'w' : 'b'}">${esc(p.text)}</p>`).join('') : '<p class="hint">A pattern appears once there are at least 3 days with a trigger and 3 without, and the difference is clear (1.5 points or more).</p>'}
        <p class="hint">Morning pain is compared with what happened the day before; sleep with the night before. These are links in your own records, not proof of cause. Discuss them with your neurologist.</p></section>
      ${rc.length ? `<section class="card"><h2>What stressed you most</h2>${rc.map(([w, c]) => `<div class="bar"><span>${esc(w)}</span><i style="width:${Math.round(c / rmax * 100)}%"></i><b>${c}</b></div>`).join('')}</section>` : ''}`;
  }

  /* ---------- MORE ---------- */
  function vMore() {
    const back = '<button class="lnk backl" data-a="more" data-v="menu">‹ More</button>';
    if (more === 'report') return back + vReport();
    if (more === 'events') return back + vEvents();
    if (more === 'settings') return back + vSettings();
    if (more === 'help') return back + vHelp();
    if (more === 'sync') return back + vSync();
    const items = [['report', '📄', 'Doctor report', 'Summary to copy, print or save as PDF'], ['events', '🗓️', 'Episodes & appointments', 'Relapses, visits, MRI dates, medication changes'], ['settings', '⚙️', 'Settings & backup', 'Choose symptoms, stress reasons, back up your data'], ['sync', '☁️', 'Sync between devices', 'Optional, end-to-end encrypted'], ['help', '❓', 'Help', 'Install on iPhone/iPad, voice tips, privacy']];
    return `<h1>More</h1><section class="card list">${items.map(([v, i, n, d]) => `<button class="li" data-a="more" data-v="${v}"><span class="em">${i}</span><div><b>${n}</b><small>${d}</small></div><span>›</span></button>`).join('')}</section>
      <p class="foot">MS Tracker v2 · a personal tracking aid, not medical advice.</p>`;
  }
  function vReport() {
    return `<h1>Doctor report</h1>
      <div class="seg">${[30, 90, 180].map(n => `<button data-a="rr" data-v="${n}" class="${n === repDays ? 'on' : ''}">${n} days</button>`).join('')}</div>
      <section class="card noprint"><h2>Questions for my appointment</h2><textarea id="questions" rows="3" data-in="questions" placeholder="Write or dictate questions for your neurologist">${esc(store.questions || '')}</textarea>
        <div class="row2"><button class="btn mic" data-a="dict" data-v="questions">🎤 Dictate</button></div></section>
      <section class="card"><pre id="rep">${esc(reportText(repDays))}</pre>
        <div class="row2 noprint"><button class="btn pri" data-a="copyrep">Copy</button><button class="btn" data-a="print">Print / PDF</button></div></section>`;
  }
  function vEvents() {
    const ev = [...store.events].sort((a, b) => b.date.localeCompare(a.date));
    return `<h1>Episodes & appointments</h1>
      <section class="card"><h2>Add</h2>
        <div class="grid2"><select id="evtype">${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}" ${k === evPreset ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <input type="date" id="evdate" value="${evDate || todayStr()}" max="${addDays(todayStr(), 365)}"></div>
        <textarea id="evtext" rows="3" placeholder="What happened? e.g. numbness in left leg since Monday, getting worse"></textarea>
        <div class="row2"><button class="btn mic" data-a="dict" data-v="evtext">🎤 Dictate</button><button class="btn pri" data-a="addev">Add</button></div></section>
      <section class="card"><h2>All events</h2>${ev.length ? ev.map(e => `<div class="item"><div><b>${fmtDate(e.date)}</b> · ${esc(EVENT_TYPES[e.type] || e.type)}${e.text ? `<br><span class="hint">${esc(e.text)}</span>` : ''}</div><button class="x" data-a="delev" data-v="${e.id}">${armed['ev' + e.id] ? 'Tap to delete' : '✕'}</button></div>`).join('') : '<p class="hint">Nothing logged yet.</p>'}</section>`;
  }
  function vSettings() {
    const t = store.settings.tracked;
    const syms = [...BASE, ...customSymDefs()].map(s => `<div class="sw"><span>${esc(s.n)}</span><span class="swr">${s.custom ? `<button class="x" data-a="delsym" data-v="${s.k}">${armed['sym' + s.k] ? 'Tap to remove' : '✕'}</button>` : ''}<button class="tog ${t.includes(s.k) ? 'on' : ''}" data-a="track" data-v="${s.k}" role="switch" aria-checked="${t.includes(s.k)}" aria-label="${esc(s.n)}"><i></i></button></span></div>`).join('');
    const cr = store.settings.customReasons || [];
    const lb = store.settings.lastBackup;
    return `<h1>Settings</h1>
      <section class="card"><h2>Evening symptoms</h2><p class="hint">Morning pain is always part of the morning check-in. Fewer symptoms here means a quicker evening check-in.</p>${syms}
        <div class="addrow"><input type="text" id="newsym" placeholder="Add a symptom, e.g. Heat sensitivity" maxlength="40"><button class="btn" data-a="addsym">Add</button></div></section>
      <section class="card"><h2>Your own stress reasons</h2><p class="hint">Added to the ${DEFAULT_REASONS.length} built-in reasons.</p>
        ${cr.length ? `<div class="tags">${cr.map(r => `<button class="tag" data-a="delwhy" data-v="${esc(r)}">${esc(r)} ✕</button>`).join('')}</div>` : ''}
        <div class="addrow"><input type="text" id="newwhy" placeholder="Add a reason" maxlength="40"><button class="btn" data-a="addwhy">Add</button></div></section>
      <section class="card"><h2>Backup</h2>
        <p class="hint">Your records are stored only on this device, in this app. Deleting the Home Screen icon or clearing Safari data erases them. Save a backup to Files or iCloud Drive every couple of weeks. Last backup: <b>${lb ? fmtDate(lb) : 'never'}</b>.</p>
        <div class="row2"><button class="btn pri" data-a="bjson">Save backup</button><button class="btn" data-a="bcsv">Export CSV</button></div>
        <div class="row2"><label class="btn">Restore from backup<input type="file" id="imp" accept="application/json,.json" hidden></label></div>
        <div class="row2"><button class="btn danger" data-a="erase">${armed.erase ? 'Tap again to erase everything' : 'Erase all data'}</button></div></section>`;
  }
  function vHelp() {
    return `<h1>Help</h1>
      <section class="card"><h2>Install on iPhone or iPad</h2><ol><li>Open your app link in <b>Safari</b>.</li><li>Tap Share, then <b>Add to Home Screen</b>.</li><li>Always open the app from that icon. It keeps its own data, separate from Safari tabs.</li></ol></section>
      <section class="card"><h2>Daily routine</h2><p>Do the <b>morning check-in</b> right after you get up (morning pain and sleep), and the <b>evening check-in</b> before bed (the day's symptoms, stress and triggers). Missed one? Fill it in later from History.</p></section>
      <section class="card"><h2>Voice tips</h2><p>Say a symptom with a number: "fatigue 6", "morning pain eight", "no numbness". Add "slept 5 hours", "stressed about work", "hot day", "took my meds" or "missed my dose". Tap <b>Review</b> to check before saving. If the Dictate button doesn't work, tap the box and use the microphone on your keyboard.</p></section>
      <section class="card"><h2>Privacy</h2><p>By default nothing leaves your device: no account, no server. If you turn on Sync, your records are encrypted on your device with your passphrase before they are uploaded, so the cloud only stores scrambled data and the dates of your entries.</p></section>
      <section class="card"><h2>Important</h2><p>This app helps you notice patterns and talk to your doctor. It doesn't diagnose or give medical advice. For a new or worsening symptom lasting over 24 hours, contact your neurology team. In an emergency, call your local emergency number.</p></section>`;
  }

  const fmtWhen = ms => ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never';
  function vSync() {
    const S = Sync.st, ui = Sync.ui, on = S.on && Sync.key && Sync.remote;
    const m = ui.msg || Sync.err, msg = m ? `<div class="warn">${esc(m)}</div>` : '';
    if (Sync.connecting && !on) return '<h1>Sync</h1><section class="card"><p>Connecting…</p></section>';
    if (on) return `<h1>Sync</h1>${msg}<section class="card"><h2>Sync is on ✓</h2>
      <div class="kv"><span>Account</span><span>${esc(S.email || '')}</span></div>
      <div class="kv"><span>Last synced</span><span>${fmtWhen(S.last)}</span></div>
      <div class="row2"><button class="btn pri" data-a="ssync">${Sync.busy ? 'Syncing…' : 'Sync now'}</button></div>
      <p class="hint">Changes sync a few seconds after you make them, and whenever you open the app. On your other device, sign in with the same account and enter the same passphrase.</p></section>
      <section class="card"><h2>What the cloud can see</h2><p class="hint">Entries, notes and settings are encrypted on this device before upload. The cloud service can see that records exist and their dates, not what is in them.</p></section>
      <section class="card"><h2>Turn off</h2>
        <div class="row2"><button class="btn" data-a="soff">${armed.soff ? 'Tap again to confirm' : 'Turn off sync on this device'}</button></div>
        <p class="hint">Keeps your data on this device and in the cloud.</p>
        <div class="row2"><button class="btn danger" data-a="swipe">${armed.swipe ? 'Tap again to delete cloud data' : 'Delete cloud data'}</button></div>
        <p class="hint">Removes your encrypted records from the cloud and turns sync off here. Data on your devices stays. Turn sync off on your other devices too.</p></section>`;
    if (ui.step === 'pass-new') return `<h1>Sync</h1>${msg}<section class="card"><h2>Create a passphrase</h2>
      <p class="hint">Signed in as ${esc(Sync.pendingEmail || S.email || '')}. This passphrase encrypts your records before they leave this device. You'll enter it once on each device.</p>
      <input type="password" id="pp1" autocomplete="new-password" placeholder="Passphrase (at least 8 characters)"><div style="height:8px"></div>
      <input type="password" id="pp2" autocomplete="new-password" placeholder="Repeat passphrase">
      <p class="hint"><b>If you forget it, your cloud copy cannot be recovered.</b> Your device copy and backup files still work. Use something you will remember, not your account password.</p>
      <button class="btn pri big" data-a="spass-new">Create and start sync</button></section>`;
    if (ui.step === 'pass-existing') return `<h1>Sync</h1>${msg}<section class="card"><h2>Enter your passphrase</h2>
      <p class="hint">Use the passphrase you created when you first turned on sync.</p>
      <input type="password" id="pp1" autocomplete="current-password" placeholder="Passphrase">
      <p class="hint">On the first sync from this device, entries already in the cloud replace entries for the same days on this device.</p>
      <button class="btn pri big" data-a="spass-ex">Unlock and sync</button></section>`;
    return `<h1>Sync</h1>${msg}<section class="card"><h2>Keep iPhone and iPad in step</h2>
      <p class="hint">Sign in to sync your entries between devices. Records are encrypted on your device before upload. Sync is optional: the app works fully without it.</p>
      <button class="btn pri big" data-a="sgoogle">Continue with Google</button>
      ${isStandalone() ? '<p class="hint">If Google sign-in fails inside the Home Screen app, use email below.</p>' : ''}
      <p class="hint" style="text-align:center;margin:14px 0 8px">or use email</p>
      <input type="email" id="fbemail" autocomplete="email" placeholder="Email" value="${esc(ui.email || '')}"><div style="height:8px"></div>
      <input type="password" id="fbpass" autocomplete="current-password" placeholder="Password (at least 6 characters)">
      <div class="row2"><button class="btn" data-a="semail-in">Sign in</button><button class="btn" data-a="semail-up">Create account</button></div>
      <button class="lnk" data-a="sforgot">Forgot password?</button></section>`;
  }
  function renderSync() { if (!flow && tab === 'more' && more === 'sync') render(true); }
  async function busySync(fn) {
    Sync.ui.msg = ''; Sync.err = ''; Sync.connecting = true; renderSync();
    try { await fn(); } catch (e) { Sync.ui.msg = fbErr(e); }
    Sync.connecting = false; renderSync();
  }

  /* ---------- dictation ---------- */
  function dictate(id) {
    const ta = document.getElementById(id); if (!ta) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Use the microphone on your keyboard to dictate.'); ta.focus(); return; }
    let r; try { r = new SR(); } catch (e) { toast('Use the microphone on your keyboard.'); ta.focus(); return; }
    r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = false;
    const base = ta.value ? ta.value.trim() + ' ' : '';
    toast('Listening…');
    r.onresult = ev => { ta.value = base + Array.from(ev.results).map(x => x[0].transcript).join(' '); onInput(ta.dataset.in, ta); };
    r.onerror = ev => toast(/not-allowed/.test(ev.error) ? 'Microphone blocked. Use the keyboard mic instead.' : 'Dictation stopped. Try the keyboard mic.');
    r.onend = () => { if (id === 'vtext' && ta.value.trim()) act('vreview'); };
    try { r.start(); } catch (e) { toast('Use the microphone on your keyboard.'); }
  }

  /* ---------- input + actions ---------- */
  function onInput(kind, el) {
    if (kind === 'vtext') voiceText = el.value;
    else if (kind === 'note' && flow) { ensure(flow.date).note = el.value; save(); }
    else if (kind === 'questions') { store.questions = el.value; save(); const r = $('#rep'); if (r) r.textContent = reportText(repDays); }
  }
  function addReason(v, selectFor) {
    v = (v || '').trim(); if (!v) return;
    let real = allReasons().find(x => x.toLowerCase() === v.toLowerCase());
    if (!real) { store.settings.customReasons.push(v); real = v; }
    if (selectFor) { const e = ensure(selectFor); e.stressWhy = e.stressWhy || []; if (!e.stressWhy.includes(real)) e.stressWhy.push(real); }
    save(); render(true);
  }
  function act(a, v) {
    const e = flow ? ensure(flow.date) : null;
    switch (a) {
      case 'tab': tab = v; render(); break;
      case 'start': { const [k, d] = v.split('|'); startFlow(k, d); break; }
      case 'pick': if (flow.lock) return; if (flow.steps[flow.i].key === 'stress') e.stress = +v; else e.s[flow.steps[flow.i].key] = +v;
        save(); flow.lock = true; render(true); setTimeout(() => { if (flow) { flow.lock = false; next(); } }, 230); break;
      case 'same': { const st = flow.steps[flow.i], y = entry(addDays(flow.date, -1)) || { s: {} }; if (st.key === 'stress') e.stress = y.stress; else e.s[st.key] = y.s[st.key]; save(); next(); break; }
      case 'skip': case 'next': next(); break;
      case 'back': back(); break;
      case 'close': flow = null; render(); break;
      case 'hrs': e.sleep = Math.max(0, Math.min(14, (e.sleep != null ? e.sleep : sleepDefault(flow.date)) + +v)); save(); render(true); break;
      case 'sq': e.sleepQ = e.sleepQ === v ? undefined : v; save(); render(true); break;
      case 'why': { e.stressWhy = e.stressWhy || []; const i = e.stressWhy.indexOf(v); if (i >= 0) e.stressWhy.splice(i, 1); else e.stressWhy.push(v); save(); render(true); break; }
      case 'addwhy': addReason($('#newwhy').value, flow ? flow.date : null); break;
      case 'delwhy': store.settings.customReasons = store.settings.customReasons.filter(r => r !== v); save(); render(true); break;
      case 'fac': e[v] = !e[v]; save(); render(true); break;
      case 'meds': { const val = v === '1'; e.meds = e.meds === val ? undefined : val; save(); render(true); break; }
      case 'dict': dictate(v); break;
      case 'vreview': { const txt = ($('#vtext') || {}).value || voiceText; voiceText = txt; if (!txt.trim()) { toast('Say or type something first'); return; }
        const p = parseText(txt); const onlyMorning = Object.keys(p.s).every(k => k === 'morning') && p.stress == null && !p.why && p.heat == null && p.exercise == null && p.meds == null && p.ill == null && p.alcohol == null;
        voiceDraft = { p, date: onlyMorning ? todayStr() : eveningDate(), text: txt }; render(true); break; }
      case 'vsave': applyParsed(voiceDraft.p, voiceDraft.date, voiceDraft.text); voiceDraft = null; voiceText = ''; toast('Saved'); render(true); break;
      case 'vclear': voiceDraft = null; render(true); break;
      case 'day': { const was = tab === 'history'; selDay = v; histMonth = v.slice(0, 7); tab = 'history'; render(was); break; }
      case 'hm': { const [Y, M] = histMonth.split('-').map(Number); const d = new Date(Y, M - 1 + +v, 1); histMonth = d.getFullYear() + '-' + pad(d.getMonth() + 1); render(true); break; }
      case 'hmet': histMetric = v; render(true); break;
      case 'irange': insRange = +v; render(true); break;
      case 'ikey': insKey = v; render(true); break;
      case 'more': tab = 'more'; more = v; if (v === 'sync' && !Sync.fb) loadFb().catch(() => {}); render(); break;
      case 'rr': repDays = +v; render(true); break;
      case 'copyrep': copy(reportText(repDays)); break;
      case 'print': try { window.print(); } catch (x) { toast('Printing not available here. Use Copy.'); } break;
      case 'logev': evPreset = v ? 'other' : 'relapse'; evDate = v || null; tab = 'more'; more = 'events'; render(); break;
      case 'addev': store.events.push({ id: String(Date.now()), type: $('#evtype').value, date: $('#evdate').value || todayStr(), text: $('#evtext').value.trim() }); save(); evDate = null; toast('Event added'); render(true); break;
      case 'delev': if (arm('ev' + v)) { store.events = store.events.filter(x => x.id !== v); save(); render(true); } break;
      case 'track': { const t = store.settings.tracked; const i = t.indexOf(v); if (i >= 0) { if (eveningSyms().length <= 1) { toast('Keep at least one symptom'); return; } t.splice(i, 1); } else t.push(v); save(); render(true); break; }
      case 'addsym': { const n = $('#newsym').value.trim(); if (!n) return; if (allSyms().some(s => s.n.toLowerCase() === n.toLowerCase())) { toast('Already in the list'); return; }
        const k = 'c' + Date.now().toString(36); store.settings.customSyms.push({ k, n }); store.settings.tracked.push(k); save(); toast('Added'); render(true); break; }
      case 'delsym': if (arm('sym' + v)) { store.settings.customSyms = store.settings.customSyms.filter(s => s.k !== v); store.settings.tracked = store.settings.tracked.filter(k => k !== v); save(); render(true); } break;
      case 'sgoogle': busySync(async () => { const u = await signInGoogle(); if (u) await afterSignIn(u); }); break;
      case 'semail-in': case 'semail-up': { const em = (($('#fbemail') || {}).value || '').trim(), pw = ($('#fbpass') || {}).value || ''; Sync.ui.email = em;
        if (!em || !pw) { Sync.ui.msg = 'Enter your email and password.'; render(true); break; }
        busySync(async () => { const fb = await loadFb(); const c = a === 'semail-up' ? await fb.auth.createUserWithEmailAndPassword(fb.au, em, pw) : await fb.auth.signInWithEmailAndPassword(fb.au, em, pw); await afterSignIn(c.user); }); break; }
      case 'sforgot': { const em = (($('#fbemail') || {}).value || '').trim(); Sync.ui.email = em; if (!em) { Sync.ui.msg = 'Type your email first.'; render(true); break; }
        busySync(async () => { const fb = await loadFb(); await fb.auth.sendPasswordResetEmail(fb.au, em); Sync.ui.msg = 'If that email has an account, a reset link is on its way.'; }); break; }
      case 'spass-new': { const p1 = ($('#pp1') || {}).value || '', p2 = ($('#pp2') || {}).value || '';
        if (p1.length < 8) { Sync.ui.msg = 'The passphrase needs at least 8 characters.'; render(true); break; }
        if (p1 !== p2) { Sync.ui.msg = 'The two passphrases do not match.'; render(true); break; }
        busySync(async () => { await setPassphrase(p1, true); await doSync(); }); break; }
      case 'spass-ex': { const p1 = ($('#pp1') || {}).value || ''; if (!p1) { Sync.ui.msg = 'Enter your passphrase.'; render(true); break; }
        busySync(async () => { const ok = await setPassphrase(p1, false); if (!ok) { Sync.ui.msg = 'That passphrase is not correct.'; return; } await doSync(); }); break; }
      case 'ssync': doSync().then(renderSync); render(true); break;
      case 'soff': if (arm('soff')) { busySync(async () => { await signOutLocal(); }); } break;
      case 'swipe': if (arm('swipe')) { busySync(async () => { await Sync.remote.wipe(); await signOutLocal(); }); } break;
      case 'bjson': download('ms-tracker-backup-' + todayStr() + '.json', JSON.stringify(store, null, 1), 'application/json'); break;
      case 'bcsv': download('ms-tracker-' + todayStr() + '.csv', csv(), 'text/csv'); break;
      case 'erase': if (Sync.st.on) { toast('Turn sync off first (More → Sync), so the cloud copy is not erased too.'); break; } if (arm('erase')) { store = defaults(); save(); toast('All data erased'); render(); } break;
    }
  }

  root.addEventListener('click', ev => { const el = ev.target.closest('[data-a]'); if (!el || el.disabled) return; act(el.dataset.a, el.dataset.v); });
  root.addEventListener('input', ev => { const el = ev.target; if (el.dataset && el.dataset.in) onInput(el.dataset.in, el); });
  root.addEventListener('change', ev => {
    if (ev.target.id !== 'imp') return; const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const o = JSON.parse(r.result); if (!o || typeof o.entries !== 'object') throw 0; if (Sync.st.on) { const b = migrate(o), cur = store; b.entries = Object.assign({}, cur.entries, b.entries); const ids = new Set(b.events.map(x => x.id)); b.events = b.events.concat(cur.events.filter(x => !ids.has(x.id))); b.settings.lastBackup = cur.settings.lastBackup; store = b; save(); toast('Backup merged with your current data'); } else { store = migrate(o); save(); toast('Backup restored'); } render(); } catch (x) { toast('That file is not a valid backup'); } };
    r.readAsText(f);
  });
  root.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.target.id === 'newwhy' || ev.target.id === 'newsym')) { ev.preventDefault(); act(ev.target.id === 'newwhy' ? 'addwhy' : 'addsym'); } });
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'more') more = 'menu'; if (tab === 'history') selDay = selDay || todayStr(); render(); });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  try { if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !/claude|usercontent/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  Sync.afterSync = info => {
    if (flow) return;
    const typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
    if (tab === 'more' && more === 'sync') render(true); else if (!typing && (tab === 'home' || (info && info.pulled))) render(true);
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' || !Sync.st.on) return; if (!Sync.key) { if (!Sync.connecting) bootSync(); } else if (Date.now() - (Sync.st.last || 0) > 60000) doSync(); });
  let redirected = false; try { redirected = !!localStorage.getItem(RKEY); } catch (e) {}
  if (redirected) {
    tab = 'more'; more = 'sync'; Sync.connecting = true;
    (async () => { try { const fb = await loadFb(); const r = await fb.auth.getRedirectResult(fb.au); if (r && r.user) await afterSignIn(r.user); else Sync.ui.msg = 'Google sign-in did not complete. Try again, or use email.'; } catch (e) { Sync.ui.msg = fbErr(e); } try { localStorage.removeItem(RKEY); } catch (e) {} Sync.connecting = false; notify(); })();
  } else if (Sync.st.on) setTimeout(bootSync, 600);
  render();
}
if (typeof module !== 'undefined') module.exports = { parseText, patterns, reportText, csv, migrate, Sync, SYNC0, doSync, markChanges, localItems, deriveKey, encWith, decWith, hash, stable, persist, setPassphrase, fbErr, _set: s => { store = migrate(s); }, _get: () => store };
