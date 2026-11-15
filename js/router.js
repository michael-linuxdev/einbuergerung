// Router: Adresse → Seite, Ereignisse je Seite, Zurück-Link, Bestätigen, Scrollposition
import { $app } from './core.js';
import { installieren } from './install.js';
import { stopSpeak } from './speech.js';
import { S } from './store.js';
import { amt } from './views/amt.js';
import { einstellungen, gespraech, mehr, profil, sprache, teilen, tutorial, waehlen } from './views/app.js';
import { check } from './views/check.js';
import { docs } from './views/docs.js';
import { dtz, kurs, lektion, vokabeln } from './views/kurs.js';
import { lebenslauf, plan } from './views/plan.js';
import { start } from './views/start.js';
import { audio, closePop, glossar, katalog, lernen, pruefung, test } from './views/test.js';

export let cleanup = null;
export function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  EVENTS.forEach(ev => { $app[ev] = null; });
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  let h = location.hash; try { h = decodeURIComponent(h); } catch {}
  const parts = (h.replace(/^#\/?/, '') || 'start').split(/--|\//);
  const [p, a, b] = parts;
  // Unterseiten: welcher Menüpunkt aktiv ist; alte Adressen (#kosten, #fristen …) führen auf die neue Stelle
  const parent = { lernen: 'test', pruefung: 'test', katalog: 'test', audio: 'test', glossar: 'test', lektion: 'kurs', vokabeln: 'kurs', dtz: 'kurs', termine: 'docs', kosten: 'docs', briefe: 'docs', fristen: 'check' }[p];
  // Erststart: erst Sprache, dann Einführung
  if (!S.onboarded && p !== 'sprache' && p !== 'tutorial') { location.replace('#sprache--erst'); return; }
  document.body.classList.toggle('onboarding', !S.onboarded && (p === 'sprache' || p === 'tutorial'));
  const extra = ['check', 'fristen', 'plan', 'lebenslauf', 'installieren', 'profil', 'einstellungen', 'gespraech', 'waehlen', 'teilen', 'sprache', 'tutorial'].includes(p);
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.toggle('active', n.dataset.nav === p || n.dataset.nav === parent || (extra && n.dataset.nav === 'mehr' && innerWidth < 900)));
  const views = { start, test, lernen, pruefung, katalog, kurs, lektion, vokabeln, dtz, docs, amt, check, einstellungen, mehr, plan, lebenslauf, installieren, audio, glossar, profil, gespraech, waehlen, teilen, sprache, tutorial,
    termine: () => docs('termine'), kosten: () => docs('kosten'), briefe: () => docs('briefe'), fristen: () => check('fristen') };
  BACK = extra && p !== 'tutorial' ? `<a class="back no-print only-mobile" href="#mehr">‹ Mehr</a>` : '';
  window.scrollTo(0, 0);
  (views[p] || start)(a, b);
  // Seitentitel für Verlauf und Screenreader
  const h1 = $app.querySelector('h1'); document.title = h1 && p !== 'start' ? `${h1.textContent.trim()} · Einbürgerung Sachsen` : 'Einbürgerung Sachsen';
  closePop(); stopSpeak(); document.querySelector('#reader [data-read="stop"]')?.setAttribute('hidden', '');
  $app.focus({ preventScroll: true });
}
// Aufräumen beim Verlassen der Seite (Timer, Tastatur, Vorlesen)
export function onLeave(fn) { cleanup = fn; }
// Ereignisse der Seite: route() setzt sie vor jeder neuen Seite zurück, Seiten setzen nur, was sie brauchen
export const EVENTS = ['onclick', 'onchange', 'oninput', 'onsubmit'];
// Zweimal tippen zum Bestätigen: true beim zweiten Tippen
export function confirmTap(btn, label) { if (btn.dataset.sure) return true; btn.dataset.sure = '1'; btn.textContent = label; btn.classList.add('primary'); return false; }
// neu zeichnen, ohne dass die Seite nach oben springt
export function keepScroll(fn) { const y = scrollY; fn(); scrollTo(0, y); }
export let BACK = '';
 // Zurück zu „Mehr“ auf dem Handy, wenn die Seite keinen eigenen Zurück-Link hat
export const render = html => { $app.innerHTML = `<div class="wrap">${BACK && !/^\s*<a class="back/.test(html) ? BACK : ''}${html}</div>`; };
