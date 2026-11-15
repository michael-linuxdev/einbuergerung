// Vorlesen (Deutsch + Hilfssprache), Nachsprechen mit Spracherkennung, Vorlese-Leiste
import { $app, esc, toast } from './core.js';
import { LANG, hl } from './i18n.js';

export const SAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6"/></svg>';
// kleiner Vorlese-Knopf als <span>, damit er auch in Antwort-Buttons stehen darf
// lang 'hl' = die gewählte Hilfssprache
export const say = (text, lang = 'de') => { if (lang === 'hl') lang = hl(); if (!text || !lang) return ''; const L = LANG[lang]; return `<span class="say" role="button" tabindex="0" data-say="${lang}" data-t="${esc(text)}" aria-label="${lang === 'de' ? 'Vorlesen' : esc(L.read)}">${SAY_ICON}${lang === 'de' ? '' : `<small>${L.tag}</small>`}</span>`; };
export const speakIcon = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>';
export function speakBtn(text) { return `<button class="speak" data-act="speak" data-t="${esc(text)}" aria-label="Vorlesen">${speakIcon}</button>`; }
export const VOICE = {};
export function voiceFor(lang) {
  if (VOICE[lang] === undefined) { const vs = speechSynthesis.getVoices(); VOICE[lang] = vs.find(v => v.lang && v.lang.toLowerCase().startsWith(lang) && /google|enhanced|premium|siri/i.test(v.name)) || vs.find(v => v.lang && v.lang.toLowerCase().startsWith(lang)) || null; }
  return VOICE[lang];
}
// Lange Texte in Sätze teilen (Chrome bricht sehr lange Ausgaben sonst ab)
export function chunks(text) { return String(text).replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*\s*/g)?.map(s => s.trim()).filter(Boolean) || []; }
export let sayToken = 0;
export function speak(text, lang = 'de', onDone) {
  if (!('speechSynthesis' in window)) { toast('Sprachausgabe wird auf diesem Gerät nicht unterstützt.'); return; }
  speechSynthesis.cancel();
  const v = voiceFor(lang);
  if (lang !== 'de' && !v && speechSynthesis.getVoices().length) toast(`Keine ${LANG[lang]?.adj || ''} Stimme installiert – in den Geräteeinstellungen unter Sprachausgabe hinzufügen.`);
  const my = ++sayToken, parts = chunks(text.replace(/\s*\/\s*/g, ', '));
  const next = k => {
    if (my !== sayToken) return;
    if (k >= parts.length) { onDone?.(); return; }
    const u = new SpeechSynthesisUtterance(parts[k]); u.lang = (LANG[lang] || LANG.de).bcp; u.rate = lang === 'de' ? 0.9 : 1; if (v) u.voice = v;
    u.onend = () => next(k + 1); u.onerror = () => next(k + 1);
    speechSynthesis.speak(u);
  };
  next(0);
}
export function stopSpeak() { sayToken++; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
export const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const mic = text => Rec ? `<span class="say mic" role="button" tabindex="0" data-mic="${esc(text)}" aria-label="Nachsprechen und prüfen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3"/></svg></span>` : '';
export function listen(target, el) {
  stopSpeak();
  const r = new Rec(); r.lang = 'de-DE'; r.interimResults = false; r.maxAlternatives = 3;
  el.classList.add('on'); toast('Sprich jetzt …');
  const words = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  r.onresult = e => {
    const alts = [...e.results[0]].map(a => a.transcript);
    const want = words(target);
    const best = alts.map(a => { const got = new Set(words(a)); return { a, p: Math.round(want.filter(w => got.has(w)).length / want.length * 100) }; }).sort((x, y) => y.p - x.p)[0];
    toast(`${best.p >= 80 ? '✓ Sehr gut' : best.p >= 50 ? 'Fast' : 'Nochmal versuchen'} (${best.p} %): „${best.a}“`);
  };
  r.onerror = e => toast(e.error === 'not-allowed' ? 'Bitte den Mikrofon-Zugriff erlauben.' : 'Nicht verstanden – bitte nochmal.');
  r.onend = () => el.classList.remove('on');
  try { r.start(); } catch { el.classList.remove('on'); }
}
// Ganze Seite vorlesen (Deutsch oder Hilfssprache)
export function pageText(lang) {
  const root = $app.cloneNode(true);
  root.querySelectorAll('.say, .speak, button.btn, .nav, script, style, .no-read, input, select, textarea').forEach(n => n.remove());
  if (lang !== 'de') return [...root.querySelectorAll('.ru')].map(n => n.textContent.trim()).filter(Boolean).join('. ');
  root.querySelectorAll('.ru').forEach(n => n.remove());
  return root.textContent.replace(/\s+/g, ' ').replace(/[›‹]/g, '').trim();
}
export function readerBar() {
  document.getElementById('reader')?.remove();
  const el = document.createElement('div'); el.id = 'reader'; el.className = 'reader no-print';
  const h = hl();
  el.innerHTML = `<span class="ico" aria-hidden="true">${SAY_ICON}</span><button data-read="de" aria-label="Seite auf Deutsch vorlesen">DE</button>${h ? `<button data-read="${h}" aria-label="${esc(LANG[h].page)}">${LANG[h].tag}</button>` : ''}<button data-read="stop" aria-label="Stopp" hidden>■</button>`;
  el.onclick = e => {
    const b = e.target.closest('[data-read]'); if (!b) return;
    const stop = el.querySelector('[data-read="stop"]');
    if (b.dataset.read === 'stop') { stopSpeak(); stop.hidden = true; return; }
    const t = pageText(b.dataset.read); if (!t) return toast(b.dataset.read !== 'de' ? `Auf dieser Seite gibt es keinen ${LANG[b.dataset.read].adj}n Text.` : 'Kein Text gefunden.');
    stop.hidden = false; speak(t, b.dataset.read, () => { stop.hidden = true; });
  };
  document.body.appendChild(el);
}
