// Start der App: Daten laden, erste Seite zeigen, Updates anbieten
import { $app, toast } from './core.js';
import { D } from './data.js';
import { LANG, applyPrefs, hl, loadDict, ru } from './i18n.js';
import { installGate } from './install.js';
import { route } from './router.js';
import { readerBar } from './speech.js';
import { restoreFromIDB, save } from './store.js';

export async function boot() {
  await restoreFromIDB();
  const files = ['questions', 'info', 'behoerden-sn', 'kurs-a1', 'kurs-a2', 'kurs-b1', 'dtz', 'glossar'];
  const res = await Promise.all(files.map(f => fetch(`data/${f}.json`).then(r => r.json())));
  D.q = res[0].questions; D.qmeta = res[0].meta; D.info = res[1]; D.amt = res[2];
  D.kurs = [...res[3], ...res[4], ...res[5]]; D.dtz = res[6]; D.glossar = res[7];
  D.topics = [...new Set(D.q.map(q => q.t))];
  const forms = D.glossar.flatMap((g, k) => g.f.map(f => [f, k])).sort((a, b) => b[0].length - a[0].length);
  D.gIndex = Object.fromEntries(forms.map(([f, k]) => [f.toLowerCase(), k]));
  D.gRe = new RegExp(`(?<![\\p{L}])(${forms.map(([f]) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'giu');
  D.qById = Object.fromEntries(D.q.map(q => [q.id, q]));
  D.general = D.q.filter(q => q.id.startsWith('g'));
  D.state = D.q.filter(q => q.id.startsWith('SN'));
  D.vok = D.kurs.flatMap(l => l.vok.map(v => ({ id: l.id + ':' + v[0], de: v[0], ru: v[1], lv: l.lv, lesson: l.id })));
  if (hl() && !(await loadDict(hl()))) setTimeout(() => toast(`${LANG[hl()].de} konnte nicht geladen werden – bitte mit Internet neu öffnen.`), 800);
  applyPrefs();
  window.addEventListener('hashchange', route);
  route();
  readerBar();
  installGate();
}
boot().catch(err => { console.error(err); $app.innerHTML = '<div class="wrap"><div class="card"><h2>Die Daten konnten nicht geladen werden.</h2><p>Bitte Seite neu laden. Beim ersten Öffnen ist eine Internetverbindung nötig.</p></div></div>'; });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; save(); location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { if (!w || !navigator.serviceWorker.controller) return; showUpdate(w); };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
    // beim Zurückkehren in die App nach Updates schauen
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
}
export function showUpdate(worker) {
  if (document.getElementById('update')) return;
  const el = document.createElement('div'); el.id = 'update'; el.className = 'update no-print'; el.setAttribute('role', 'status');
  el.innerHTML = `<div><b>Neue Version verfügbar</b>${ru('ui.new-version-available')}</div><button class="btn small primary" data-up>Jetzt laden</button>`;
  el.querySelector('[data-up]').onclick = () => { save(); worker.postMessage({ type: 'SKIP_WAITING' }); el.querySelector('[data-up]').textContent = 'Lädt …'; };
  document.body.appendChild(el);
}
