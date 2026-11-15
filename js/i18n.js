// Sprachen: Deutsch immer, dazu eine Hilfssprache (Wörterbücher data/i18n/<code>.json mit festen IDs) oder „Nur Deutsch“
import { esc, toast } from './core.js';
import { VOICE, listen, readerBar, say, speak } from './speech.js';
import { S, save } from './store.js';

export function applyPrefs() {
  document.body.classList.toggle('no-ru', !hl());
  document.documentElement.dataset.hl = hl() || 'de';
  const r = document.documentElement;
  if (S.theme !== 'auto') { r.dataset.theme = S.theme; applyPrefs.set = true; }
  else if (applyPrefs.set) { r.removeAttribute('data-theme'); applyPrefs.set = false; }
  r.dataset.size = S.size;
}
/* Sprachen: Deutsch immer, dazu eine Hilfssprache (Russisch, Englisch) oder „Nur Deutsch“
   Hilfssprachen-Texte stehen in den Daten auf Russisch; data/en.json ordnet jedem russischen Text die englische Fassung zu. */
export const LANG = {
  de: { bcp: 'de-DE', tag: 'DE', name: 'Nur Deutsch', de: 'Deutsch', adj: 'deutsche', read: 'Vorlesen', page: 'Seite auf Deutsch vorlesen' },
  ru: { bcp: 'ru-RU', tag: 'RU', name: 'Русский', de: 'Russisch', adj: 'russische', read: 'Прочитать по-русски', page: 'Прочитать страницу по-русски', also: 'Пояснения дополнительно на русском' },
  en: { bcp: 'en-GB', tag: 'EN', name: 'English', de: 'Englisch', adj: 'englische', read: 'Read aloud in English', page: 'Read this page in English', also: 'Explanations also in English' },
  tr: { bcp: 'tr-TR', tag: 'TR', name: 'Türkçe', de: 'Türkisch', adj: 'türkische', read: 'Türkçe sesli oku', page: 'Sayfayı Türkçe oku', also: 'Açıklamalar ayrıca Türkçe', ai: 'Otomatik çeviri – geçerli olan Almanca metindir.' },
  ar: { bcp: 'ar-SA', tag: 'AR', name: 'العربية', de: 'Arabisch', adj: 'arabische', read: 'اقرأ بالعربية', page: 'اقرأ الصفحة بالعربية', also: 'الشروح أيضًا بالعربية', rtl: true, ai: 'ترجمة آلية – النص الألماني هو المعتمد.' },
  pl: { bcp: 'pl-PL', tag: 'PL', name: 'Polski', de: 'Polnisch', adj: 'polnische', read: 'Przeczytaj po polsku', page: 'Przeczytaj stronę po polsku', also: 'Wyjaśnienia także po polsku', ai: 'Tłumaczenie automatyczne – obowiązuje tekst niemiecki.' },
  ro: { bcp: 'ro-RO', tag: 'RO', name: 'Română', de: 'Rumänisch', adj: 'rumänische', read: 'Citește cu voce tare în română', page: 'Citește pagina în română', also: 'Explicații și în limba română', ai: 'Traducere automată – textul german este cel valabil.' }
};
export const HL = ['ru', 'en', 'tr', 'ar', 'pl', 'ro'];
 // Hilfssprachen, Reihenfolge in der Auswahl
export const hl = () => HL.includes(S.lang) ? S.lang : (S.lang === 'de' ? null : 'ru');
export const hlName = () => hl() ? LANG[hl()].de : 'Deutsch';
 // „Russisch“ / „Englisch“ …
export const dirAttr = l => LANG[l]?.rtl ? ' dir="rtl"' : '';
// Wörterbücher data/i18n/<code>.json: feste ID → Text in der Hilfssprache (auch Russisch).
// Die IDs stehen in den Daten (z. B. q.g1, info.steps.s1.dru) und im Code (ui.…).
export const DICT = {};
export async function loadDict(l) {
  if (DICT[l]) return true;
  const url = `data/i18n/${l}.json`;
  try { const r = await fetch(url); if (!r.ok) throw 0; DICT[l] = await r.json(); } catch { return false; }
  // für die Offline-Nutzung im Service Worker ablegen (beim ersten Besuch läuft der noch nicht)
  navigator.serviceWorker?.ready.then(reg => reg.active?.postMessage({ type: 'CACHE', url })).catch(() => {});
  return true;
}
// ID → Text in der gewählten Hilfssprache ('' bei „Nur Deutsch“ oder wenn die Übersetzung fehlt)
export function tr(id) {
  const l = hl(); if (!id || !l) return '';
  return DICT[l]?.[id] ?? '';
}
export async function setLang(l) {
  if (l !== 'de' && !(await loadDict(l))) { toast(`${LANG[l].de} konnte nicht geladen werden – bitte mit Internet erneut versuchen.`); return false; }
  S.lang = l; save(); applyPrefs(); readerBar();
  return true;
}
// Text in der Hilfssprache (Quelle: russischer Text, andere Sprachen aus data/<code>.json); bei „Nur Deutsch“ leer
// Vorlese-Knopf nur an ganzen Absätzen (ruSay); Listen, Antworten und Kacheln liest die Vorlese-Leiste unten vor
export const ruRaw = (x, withSay = false) => x && hl() ? `<span class="ru" lang="${hl()}"${dirAttr(hl())}>${esc(x)}${withSay ? ' ' + say(x, 'hl') : ''}</span>` : '';
export const ru = id => ruRaw(tr(id));
export const ruSay = id => ruRaw(tr(id), true);
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { for (const k in VOICE) delete VOICE[k]; };
// Vorlese- und Mikrofon-Knöpfe überall: abfangen, bevor ein Elternelement (z. B. eine Antwort) reagiert
document.addEventListener('click', e => {
  const s = e.target.closest('.say'); if (!s) return;
  e.preventDefault(); e.stopPropagation();
  if (s.dataset.mic) listen(s.dataset.mic, s); else speak(s.dataset.t, s.dataset.say);
}, true);
// Elemente mit role="button", die kein <button> sind (Vorlesen, Karteikarte): mit Enter/Leertaste bedienbar
document.addEventListener('keydown', e => { const s = e.target.closest?.('[role="button"]:not(button)'); if (s && !s.classList.contains('term') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); s.click(); } });
