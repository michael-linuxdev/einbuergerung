// Zustand und sicheres Speichern (localStorage + IndexedDB), Profile, Sicherungen, Lernaktivität, Wiederholung (Leitner)
import { DAY, dayKey, download, toast, today } from './core.js';
import { applyPrefs } from './i18n.js';
import { planData } from './views/plan.js';

export const KEY = 'eb.v1';
export const LANG_CODES = ['', 'de', 'ru', 'en', 'tr', 'ar', 'pl', 'ro'];
 // '' = noch nicht gewählt
export const defaults = { theme: 'auto', size: 'm', srs: {}, wrong: {}, exams: [], kurs: {}, vok: {}, docs: {}, persona: ['angestellt'], check: {}, amt: null, einreise: '', ehe: false, testdate: '', b1date: '', planTime: '19:00', cv: null, kosten: null, fristen: [{ id: 'pass', t: 'Reisepass', d: '' }, { id: 'titel', t: 'Aufenthaltstitel', d: '' }], installSeen: false, lang: '', onboarded: false };
// Familienmodus: mehrere Profile; Unterlagen, Behörde, Kosten und Termin-Checklisten sind gemeinsam.
export const SHARED = ['docs', 'persona', 'amt', 'kosten', 'term', 'theme', 'size', 'installSeen', 'lang', 'onboarded'];
Object.assign(defaults, { daily: {}, stat: {}, milestones: {}, term: {}, drafts: {} });
// Immer eine frische Kopie: sonst teilen sich Profile und „Zurücksetzen“ dieselben Objekte (srs, wrong, fristen …)
export const fresh = () => structuredClone(defaults);
export const kind = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
// Gespeicherte Werte mit falschem Typ (beschädigt oder aus fremder Datei) durch Standardwerte ersetzen
export function clean(st) {
  const out = {};
  if (!st || kind(st) !== 'object') return out;
  for (const k in st) {
    if (k === '_ts') continue;
    const d = defaults[k], v = st[k];
    if (!(k in defaults)) { if (['lastExport', 'dtzDone'].includes(k) && ['number', 'object'].includes(kind(v))) out[k] = v; continue; }
    if (d === null ? ['null', k === 'amt' ? 'string' : 'object'].includes(kind(v)) : kind(v) === kind(d)) out[k] = v;
  }
  // Einträge in Lernständen prüfen
  const filt = (k, ok) => { if (out[k]) out[k] = Object.fromEntries(Object.entries(out[k]).filter(([, v]) => ok(v))); };
  const num = x => typeof x === 'number' && isFinite(x);
  filt('srs', v => v && num(v.l) && num(v.due)); filt('vok', v => v && num(v.l) && num(v.due));
  filt('stat', v => v && num(v.r) && num(v.w)); filt('daily', num);
  ['wrong', 'docs', 'term', 'milestones'].forEach(k => filt(k, v => typeof v === 'boolean'));
  filt('check', num); filt('drafts', v => typeof v === 'string');
  if (out.exams) out.exams = out.exams.filter(e => e && num(e.date) && num(e.score) && num(e.total));
  if (out.fristen) out.fristen = out.fristen.filter(f => f && typeof f.t === 'string' && typeof f.d === 'string').map(f => ({ id: String(f.id || 'x' + Math.random().toString(36).slice(2)), t: f.t, d: f.d }));
  if (out.persona) out.persona = out.persona.filter(p => typeof p === 'string');
  if (out.kosten) out.kosten = Object.fromEntries(Object.entries(out.kosten).filter(([, v]) => num(v)));
  if ('cv' in out && out.cv !== null) {
    const cv = out.cv, str = x => typeof x === 'string' ? x : '';
    out.cv = kind(cv) !== 'object' || !Array.isArray(cv.entries) ? null : { name: str(cv.name), geb: str(cv.geb), ort: str(cv.ort), eltern: str(cv.eltern), geschwister: str(cv.geschwister), schluss: str(cv.schluss),
      entries: cv.entries.filter(e => e && kind(e) === 'object').map(e => ({ typ: ['schule', 'ausbildung', 'studium', 'arbeit', 'wehrdienst', 'ohne', 'wohnort', 'einreise', 'heirat', 'kind', 'kurs', 'sonst'].includes(e.typ) ? e.typ : 'sonst', von: str(e.von), bis: str(e.bis), was: str(e.was), wo: str(e.wo) })) };
  }
  return out;
}
/* Sicheres Speichern
   Jede Änderung geht sofort in localStorage UND IndexedDB (zweite Ablage).
   Beim Start wird die neuere bzw. vorhandene Kopie genommen; täglich ein Sicherungspunkt (7 Tage). */
export const IDB = { db: null };
export function idbOpen() {
  return new Promise(res => {
    try { const r = indexedDB.open('einbuergerung', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { IDB.db = r.result; res(r.result); }; r.onerror = () => res(null); r.onblocked = () => res(null); }
    catch { res(null); }
  });
}
export const idbReq = (mode, fn) => new Promise(res => { if (!IDB.db) return res(undefined); try { const st = IDB.db.transaction('kv', mode).objectStore('kv'); const r = fn(st); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch { res(undefined); } });
export const idbGet = k => idbReq('readonly', st => st.get(k));
export const idbPut = (k, v) => idbReq('readwrite', st => st.put(v, k));
export const idbDel = k => idbReq('readwrite', st => st.delete(k));
export const idbKeys = () => idbReq('readonly', st => st.getAllKeys());
export let saveWarned = false;
export const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch { return fb; } };
export function writeJSON(k, v, fresh = false) {
  // fresh: neu angelegte Standardwerte bekommen Zeitstempel 0, damit eine ältere Sicherung in IndexedDB Vorrang hat
  if (v && typeof v === 'object' && !Array.isArray(v)) v._ts = fresh ? 0 : Date.now();
  let ok = true;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { ok = false; }
  idbPut(k, v).then(r => { if (!ok && r === undefined) saveFailed(); });
  if (!ok && !IDB.db) saveFailed();
}
export function saveFailed() {
  if (saveWarned) return; saveWarned = true;
  setTimeout(() => toast('Achtung: Speichern fehlgeschlagen. Bitte unter Einstellungen eine Sicherung herunterladen.'), 300);
}
export async function restoreFromIDB() {
  await idbOpen();
  if (!IDB.db) return;
  const keys = (await idbKeys() || []).filter(k => typeof k === 'string' && k.startsWith('eb.'));
  let changed = false;
  for (const k of keys) {
    const fromDb = await idbGet(k), fromLs = readJSON(k, null);
    if (fromDb && (!fromLs || (fromDb._ts || 0) > (fromLs._ts || 0))) { try { localStorage.setItem(k, JSON.stringify(fromDb)); } catch {} changed = true; }
    else if (fromLs && !fromDb) idbPut(k, fromLs);
  }
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('eb.') && !keys.includes(k)) { const v = readJSON(k, null); if (v) idbPut(k, v); } }
  if (changed) { P = readJSON('eb.profiles', P); S = load(); }
  // täglicher Sicherungspunkt
  const today = 'snap:' + dayKey();
  if (!(await idbGet(today)) && (S.exams.length || Object.keys(S.srs).length || Object.keys(S.kurs).length)) {
    await idbPut(today, fullBackup());
    const snaps = (await idbKeys() || []).filter(k => /^snap:\d{4}-/.test(String(k))).sort();
    for (const k of snaps.slice(0, Math.max(0, snaps.length - 7))) await idbDel(k);
  }
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
}
export function fullBackup() {
  save();
  const data = { v: 2, created: new Date().toISOString(), profiles: P, shared: readJSON('eb.shared', {}), own: {} };
  P.list.forEach(p => { data.own[p.id] = readJSON(pKey(p.id), {}); });
  return data;
}
// Sicherungsdatei prüfen: nur Sicherungen dieser App, Werte mit falschem Typ werden verworfen
export const validProfiles = x => x && Array.isArray(x.list) && x.list.length > 0 && x.list.every(p => p && /^p[0-9a-z]{1,20}$/.test(p.id) && typeof p.name === 'string') && x.list.some(p => p.id === x.active);
export function checkBackup(b) {
  if (!b || kind(b) !== 'object') return null;
  if (b.v === 2) {
    if (!validProfiles(b.profiles) || kind(b.shared) !== 'object' || kind(b.own) !== 'object') return null;
    const profiles = { active: b.profiles.active, list: b.profiles.list.map(p => ({ id: p.id, name: p.name.slice(0, 60) })) };
    const own = {}; profiles.list.forEach(p => { own[p.id] = clean(b.own[p.id]); });
    return { v: 2, profiles, shared: clean(b.shared), own };
  }
  // alte Sicherungsdatei (Version 1): ein einzelner Lernstand
  const st = clean(b);
  return ['srs', 'exams', 'kurs', 'docs', 'vok'].some(k => k in st) ? { v: 1, st } : null;
}
export function restoreBackup(raw) {
  const b = checkBackup(raw); if (!b) throw new Error('ungültig');
  if (b.v === 1) { S = Object.assign(fresh(), b.st); S.onboarded = true; save(); return; }
  // Profile, die es in der Sicherung nicht gibt, entfernen
  P.list.filter(p => !b.profiles.list.some(q => q.id === p.id)).forEach(p => { try { localStorage.removeItem(pKey(p.id)); } catch {} idbDel(pKey(p.id)); });
  writeJSON('eb.profiles', b.profiles); writeJSON('eb.shared', b.shared);
  Object.entries(b.own).forEach(([id, v]) => writeJSON(pKey(id), v));
  P = b.profiles;
  S = load();
}
addEventListener('pagehide', () => save());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
addEventListener('storage', e => { if (e.key && e.key.startsWith('eb.')) { P = readJSON('eb.profiles', P); S = load(); } });
export let P = readJSON('eb.profiles', null);
if (!validProfiles(P)) { P = { active: 'p1', list: [{ id: 'p1', name: '' }] }; writeJSON('eb.profiles', P, true); }
export const pKey = id => id === 'p1' ? KEY : `${KEY}.${id}`;
export let S = load();
export function load() {
  const own = clean(readJSON(pKey(P.active), {}));
  let shared = readJSON('eb.shared', null);
  if (!shared) { shared = {}; const first = readJSON(KEY, {}); SHARED.forEach(k => { if (k in first) shared[k] = first[k]; }); writeJSON('eb.shared', shared, true); }
  // bis 1.3 gab es nur „Russisch an/aus“ (shared.ru) statt der Sprachwahl
  const legacy = kind(shared) === 'object' && !('lang' in shared) && ('ru' in shared) ? (shared.ru === false ? 'de' : 'ru') : null;
  shared = clean(shared);
  const st = Object.assign(fresh(), own, shared);
  // Umstieg von „Russisch an/aus“ (bis 1.3) auf die Sprachwahl; wer die App schon benutzt hat, braucht keinen Erststart
  if (legacy) { st.lang = legacy; st.onboarded = true; }
  if (!LANG_CODES.includes(st.lang)) st.lang = '';
  return st;
}
export function save() {
  const own = {}, shared = {};
  for (const k in S) (SHARED.includes(k) ? shared : own)[k] = S[k];
  writeJSON(pKey(P.active), own); writeJSON('eb.shared', shared);
}
export const profileName = () => P.list.find(p => p.id === P.active)?.name || '';
// Lernstand des aktiven Profils löschen; gemeinsame Daten (Unterlagen, Behörde, Sprache …) bleiben
export function resetProfile() { const keep = {}; SHARED.forEach(k => { keep[k] = S[k]; }); S = Object.assign(fresh(), keep); save(); }
export function switchProfile(id) { save(); P.active = id; writeJSON('eb.profiles', P); S = load(); applyPrefs(); }
export function activity(n = 1) { const k = dayKey(); S.daily[k] = (S.daily[k] || 0) + n; save(); }
export function streak() {
  let n = 0; const d = new Date();
  if (!S.daily[dayKey(d.getTime())]) d.setDate(d.getDate() - 1); // heute noch nicht gelernt: Serie zählt bis gestern
  while (S.daily[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function dailyGoal() { const p = typeof planData === 'function' && S.testdate ? planData() : null; return Math.max(10, Math.min(40, p && p.tDays > 0 ? p.qPerDay + 5 : 20)); }
export function statAdd(id, ok) { const s = S.stat[id] || { r: 0, w: 0 }; ok ? s.r++ : s.w++; S.stat[id] = s; }
export const INTERVAL = [0, 1, 2, 4, 7, 14];
 // Tage je Stufe
export function srsGrade(store, id, correct) {
  const c = store[id] || { l: 0, due: 0 };
  if (correct) c.l = Math.min(5, c.l + 1); else c.l = 1;
  c.due = today() + INTERVAL[c.l] * DAY;
  store[id] = c; save();
}
export const learned = (store, ids) => ids.filter(id => (store[id]?.l || 0) >= 4).length;
export function exportBackup() {
  download(`einbuergerung-sicherung-${dayKey()}.json`, JSON.stringify(fullBackup()), 'application/json');
  S.lastExport = Date.now(); save(); toast('Sicherungsdatei erstellt');
}
