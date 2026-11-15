// Mehr, Einstellungen, Familienmodus, Gespräch üben, Wählen, Weiterempfehlen, Sprache, Einführung
import { $app, ABC, APP_URL, EMBED, VERSION, back, esc, fmtDate, toast } from '../core.js';
import { D } from '../data.js';
import { HL, LANG, applyPrefs, dirAttr, hl, hlName, loadDict, ru, ruSay, setLang } from '../i18n.js';
import { installGate, platform } from '../install.js';
import { confirmTap, keepScroll, onLeave, render } from '../router.js';
import { SAY_ICON, mic, readerBar, say, stopSpeak } from '../speech.js';
import { IDB, P, S, activity, checkBackup, exportBackup, fullBackup, idbDel, idbGet, idbKeys, idbPut, pKey, profileName, resetProfile, restoreBackup, save, switchProfile, writeJSON } from '../store.js';
import { gloss } from './test.js';

// Was nicht schon unter Test, Deutsch, Unterlagen oder Behörden steht
export const MEHR = [
  ['Lernen', 'ui.learning', [['plan', 'Mein Lernplan', 'ui.my-study-plan', 'Tagesziele bis zum Prüfungstermin, mit Erinnerung'],
    ['gespraech', 'Gespräch bei der Behörde üben', 'ui.preparing-for-the-interview-at-the-a', 'Typische Fragen, Musterantworten, das Bekenntnis erklärt']]],
  ['Antrag', 'ui.application-and-documents', [['check', 'Voraussetzungen & Fristen', 'ui.requirements-and-deadlines', 'Ab wann darf ich? Pass und Aufenthaltstitel gültig?'],
    ['lebenslauf', 'Lebenslauf-Generator', 'ui.cv-generator', 'Ausführlicher Lebenslauf als Text für den Antrag']]],
  ['Nach der Einbürgerung', 'ui.after-naturalisation', [['waehlen', 'Mein erstes Mal wählen', 'ui.my-first-time-voting', 'Wahlen in Sachsen einfach erklärt – mit Quiz']]],
  ['App', 'ui.app', [['einstellungen', 'Einstellungen & Sprache', 'ui.settings-and-information', () => `Jetzt: ${hl() ? 'Deutsch + ' + LANG[hl()].de : 'Nur Deutsch'} · Schrift, Sicherung`],
    ['profil', 'Familienmodus', 'ui.family-mode', 'Mehrere Personen auf einem Gerät'],
    ['tutorial', 'Einführung ansehen', 'ui.watch-the-introduction', 'Kurze Tour durch die App'],
    ['installieren', 'Als App installieren', 'ui.install-as-an-app', 'Anleitung für iPhone, iPad und Android'],
    ['teilen', 'App weiterempfehlen', 'ui.recommend-the-app', 'Per WhatsApp, Telegram oder QR-Code']]]
];
export function mehr() {
  render(`<h1>Mehr</h1>${MEHR.map(([g, gr, items]) => `<h2 class="group-h">${g}${ru(gr)}</h2><div class="grid two">
    ${items.map(([h, t, r, d]) => `<a class="tile compact" href="#${h}"><h3>${t}</h3>${ru(r)}<div class="meta">${typeof d === 'function' ? d() : d}</div><span class="arrow" aria-hidden="true">›</span></a>`).join('')}</div>`).join('')}`);
}
export function profil() {
  render(`<h1>Familienmodus</h1><p class="muted">Mehrere Personen können auf einem Gerät lernen – jede mit eigenem Lernstand. Unterlagen-Checkliste, Behörde, Kosten und Mitbring-Listen sind gemeinsam.${ru('ui.several-people-can-learn-on-one-devi')}</p>
    <div class="card"><ul class="list">${P.list.map(p => `<li><div class="row"><input class="text grow" data-pname="${esc(p.id)}" value="${esc(p.name)}" placeholder="Name (z. B. Olga)" aria-label="Name">
      ${p.id === P.active ? '<span class="badge ok">aktiv</span>' : `<button class="btn small primary" data-use="${esc(p.id)}">Wechseln</button>`}
      ${P.list.length > 1 && p.id !== 'p1' ? `<button class="btn small ghost" data-del="${esc(p.id)}">Löschen</button>` : ''}</div></li>`).join('')}</ul>
      <button class="btn small mt-s" data-act="add">+ Person hinzufügen</button></div>
    <p class="small muted">Tipp: Jede Person kann eigene Prüfungstermine, Fristen und einen eigenen Lebenslauf haben.</p>`);
  $app.onchange = e => { const n = e.target.dataset.pname; if (n) { P.list.find(p => p.id === n).name = e.target.value.trim(); writeJSON('eb.profiles', P); toast('Gespeichert'); } };
  $app.onclick = e => {
    const t = e.target.closest('[data-use],[data-del],[data-act="add"]'); if (!t) return;
    if (t.dataset.use) { switchProfile(t.dataset.use); toast(`Profil: ${profileName() || 'ohne Namen'}`); location.hash = '#start'; }
    else if (t.dataset.del) {
      if (!confirmTap(t, 'Wirklich löschen?')) return;
      const id = t.dataset.del; if (P.active === id) switchProfile('p1');
      P.list = P.list.filter(p => p.id !== id); writeJSON('eb.profiles', P);
      try { localStorage.removeItem(pKey(id)); } catch {} idbDel(pKey(id)); profil();
    } else { const id = 'p' + Date.now().toString(36); P.list.push({ id, name: '' }); writeJSON('eb.profiles', P); profil(); setTimeout(() => document.querySelector(`[data-pname="${id}"]`)?.focus(), 50); }
  };
}
export let pendingImport = null;
export async function snapshotList() {
  const ks = (await idbKeys() || []).filter(k => String(k).startsWith('snap:')).sort().reverse();
  const box = document.getElementById('snaps'); if (!box) return;
  const label = k => /^snap:\d{4}-/.test(k) ? fmtDate(new Date(k.slice(5) + 'T12:00')) : k.includes('zuruecksetzen') ? 'Vor dem Zurücksetzen' : 'Vor der letzten Wiederherstellung';
  box.innerHTML = ks.length ? `<ul class="list">${ks.map(k => `<li class="row"><span>${label(k)}</span><span class="spacer"></span><button class="btn small" data-snap="${k}">Wiederherstellen</button></li>`).join('')}</ul>` : '<p class="small muted">Noch keine Sicherungspunkte – der erste entsteht morgen beim Öffnen.</p>';
}
export async function storageStatus() {
  const el = document.getElementById('persist'); if (!el) return;
  let pers = null; try { pers = await navigator.storage?.persisted?.(); } catch {}
  el.innerHTML = `${IDB.db ? '✓ Doppelte Speicherung aktiv' : '⚠ Nur einfache Speicherung (zweite Ablage nicht verfügbar)'}<br>${pers ? '✓ Dauerhafter Speicher vom Browser bestätigt' : 'Dauerhafter Speicher nicht bestätigt – am sichersten: App installieren und regelmäßig eine Sicherungsdatei herunterladen.'}`;
}
export function einstellungen() {
  render(`<h1>Einstellungen</h1>
    <div class="card"><h2>Sprache</h2>${ru('ui.language')}<p class="small mt-s">Deutsch steht immer an erster Stelle. Dazu kannst du eine Hilfssprache wählen – jederzeit änderbar.</p>${langChoice()}
      <div class="row mt-xs"><a class="btn small" href="#tutorial">Einführung wiederholen</a></div></div>
    <div class="card"><label class="lbl">Schriftgröße</label><div class="chips">${[['m', 'Normal'], ['l', 'Groß'], ['xl', 'Sehr groß']].map(([k, n]) => `<button class="chip ${S.size === k ? 'on' : ''}" data-size="${k}">${n}</button>`).join('')}</div>
      <label class="lbl">Darstellung</label><div class="chips m-0">${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, n]) => `<button class="chip ${S.theme === k ? 'on' : ''}" data-theme="${k}">${n}</button>`).join('')}</div></div>
    <div class="card"><h2>Speichern & Sichern</h2>
      <p class="small">Alles wird automatisch gespeichert – sofort nach jeder Eingabe, doppelt auf diesem Gerät.${ru('ui.everything-is-saved-automatically-st')}</p>
      <p class="small" id="persist">…</p>
      <p class="small">${S.lastExport ? `Letzte Sicherungsdatei: ${fmtDate(S.lastExport)}` : 'Noch keine Sicherungsdatei heruntergeladen.'}</p>
      <div class="row">${EMBED ? '' : '<button class="btn small primary" data-act="export">Sicherungsdatei herunterladen</button>'}<label class="btn small">Sicherungsdatei laden<input type="file" accept="application/json,.json" id="imp" hidden></label></div><div id="impbox" class="mt"></div>
      <h3 class="mt-l">Automatische Sicherungspunkte</h3><p class="small muted">Einmal täglich, die letzten 7 Tage.</p><div id="snaps"></div>
      <div class="row mt"><button class="btn small ghost" data-act="reset">Lernstand dieses Profils zurücksetzen</button></div></div>
    <div class="card"><h2>Familienmodus</h2><p class="small">${P.list.length} Profil${P.list.length > 1 ? 'e' : ''} auf diesem Gerät.</p><a class="btn small" href="#profil">Profile verwalten</a></div>
    <div class="card"><h2>App installieren</h2><p class="small">${platform().standalone ? 'Die App ist installiert. 👍' : 'Installiert funktioniert alles auch ohne Internet, und der Browser hält deine Daten zuverlässiger.'}</p><a class="btn small" href="#installieren">Anleitung für dein Gerät</a></div>
    <div class="card"><h2>Quellen & Hinweise</h2>
      <p class="small"><b>Fragenkatalog:</b> ${esc(D.qmeta.source)}. Amtliches Werk nach § 5 UrhG, unverändert wiedergegeben. Lösungen: ${esc(D.qmeta.answers)}.</p>
      <p class="small">${esc(D.qmeta.translation_ru)}. ${esc(D.qmeta.images)}. Schrift „Lora“ unter SIL Open Font License.</p>
      <p class="small"><b>Rechtsstand:</b> Staatsangehörigkeitsgesetz in der Fassung nach Abschaffung der 3-Jahres-Einbürgerung (in Kraft seit 30.10.2025). Gebühr 255 € (§ 38 StAG). Behördenangaben: Websites der Landkreise und des Freistaates Sachsen, Stand ${esc(D.info.stand)}.</p>
      <p class="small"><b>Keine Rechtsberatung.</b> Diese App ist ein privates, kostenloses Lernangebot und steht in keiner Verbindung zum BAMF oder zu Behörden. Verbindlich ist allein die Auskunft deiner Einbürgerungsbehörde.</p>
      <p class="small"><b>Datenschutz:</b> keine Anmeldung, keine Cookies, kein Tracking. Alle Eingaben bleiben auf deinem Gerät.</p>
      <p class="small muted">Version ${VERSION}</p></div>`);
  storageStatus(); snapshotList();
  $app.onchange = e => {
    if (e.target.id === 'imp') {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      f.text().then(t => {
        const b = checkBackup(JSON.parse(t)); if (!b) throw new Error('ungültig');
        pendingImport = JSON.parse(t);
        const when = b.v === 2 && JSON.parse(t).created ? fmtDate(Date.parse(JSON.parse(t).created)) : '';
        const who = b.v === 2 ? `${b.profiles.list.length} Profil${b.profiles.list.length > 1 ? 'e' : ''}` : '1 Profil';
        document.getElementById('impbox').innerHTML = `<div class="notice" role="alert"><b>Aktuellen Stand ersetzen?</b><div class="small mt-xs">Sicherung${when ? ' vom ' + when : ''} · ${who}. Dein jetziger Stand wird vorher als Sicherungspunkt abgelegt.</div>${ru('ui.replace-your-current-progress-your-c')}
          <div class="row mt"><button class="btn small primary" data-act="imp-ok">Ersetzen</button><button class="btn small ghost" data-act="imp-no">Abbrechen</button></div></div>`;
        document.getElementById('impbox').scrollIntoView({ block: 'nearest' });
      }).catch(() => toast('Datei ungültig – bitte eine Sicherungsdatei dieser App wählen.'));
    }
  };
  $app.onclick = async e => {
    const t = e.target.closest('[data-size],[data-theme],[data-act],[data-snap],[data-lang]'); if (!t) return;
    if (t.dataset.lang) { if (await setLang(t.dataset.lang)) { toast(langToast()); einstellungen(); } }
    else if (t.dataset.size) { S.size = t.dataset.size; save(); applyPrefs(); einstellungen(); }
    else if (t.dataset.theme) { S.theme = t.dataset.theme; save(); applyPrefs(); einstellungen(); }
    else if (t.dataset.act === 'export') { exportBackup(); einstellungen(); }
    else if (t.dataset.act === 'imp-no') { pendingImport = null; document.getElementById('impbox').innerHTML = ''; }
    else if (t.dataset.act === 'imp-ok' && pendingImport) {
      await idbPut('snap:vor-wiederherstellung', fullBackup());
      try { restoreBackup(pendingImport); } catch { return toast('Datei ungültig – bitte eine Sicherungsdatei dieser App wählen.'); }
      pendingImport = null; if (hl()) await loadDict(hl()); applyPrefs(); readerBar(); toast('Sicherung geladen'); einstellungen();
    }
    else if (t.dataset.snap) {
      if (!confirmTap(t, 'Sicher? Nochmal tippen')) return;
      await idbPut('snap:vor-wiederherstellung', fullBackup());
      const b = await idbGet(t.dataset.snap); if (!b) return toast('Sicherungspunkt nicht lesbar');
      try { restoreBackup(b); } catch { return toast('Sicherungspunkt nicht lesbar'); }
      if (hl()) await loadDict(hl()); applyPrefs(); readerBar(); toast('Wiederhergestellt'); einstellungen();
    }
    else if (t.dataset.act === 'reset') {
      if (!confirmTap(t, 'Wirklich zurücksetzen? Nochmal tippen')) return; await idbPut('snap:vor-zuruecksetzen', fullBackup()); resetProfile(); applyPrefs(); toast('Zurückgesetzt'); einstellungen(); }
  };
}
export function gespraech() {
  const G = D.info.gespraech;
  render(`${back('#mehr', 'Mehr')}<h1>Gespräch bei der Behörde üben</h1><p>${esc(G.intro[0])} ${say(G.intro[0])}</p>${ruSay(G.intro[1])}
    <p class="small muted">So übst du: Frage anhören, laut antworten, dann die Musterantwort vergleichen. Mit dem Mikrofon prüft die App, ob du verstanden wirst.</p>
    ${G.fragen.map((f, k) => `<div class="card"><div class="q-head"><span>Frage ${k + 1} von ${G.fragen.length}</span></div>
      <div class="q-text">${esc(f.q)} ${say(f.q)}${ruSay(f.qru)}</div>
      <details><summary class="btn small" style="display:inline-flex">Musterantwort zeigen</summary>
        <div class="why mt"><b>SO KÖNNTEST DU ANTWORTEN</b>${esc(f.a)} ${say(f.a)} ${mic(f.a.split(' / ')[0])}${ruSay(f.aru)}</div>
        <p class="small muted mt-s">Ersetze Jahreszahlen, Orte und Beruf durch deine eigenen.</p></details></div>`).join('')}
    <div class="card"><h2>Das Bekenntnis – was unterschreibe ich?</h2><p>${esc(G.bekenntnis[0])} ${say(G.bekenntnis[0])}</p>${ruSay(G.bekenntnis[1])}</div>`);
}
export function waehlen() {
  const W = D.info.waehlen; const ans = Array(W.quiz.length).fill(null);
  const draw = () => {
    render(`${back('#mehr', 'Mehr')}<h1>Mein erstes Mal wählen</h1><p>${esc(W.intro[0])} ${say(W.intro[0])}</p>${ruSay(W.intro[1])}
      ${W.punkte.map(([t, de, r]) => `<div class="card"><h3>${esc(t)}</h3><p class="m-0">${esc(de)} ${say(t + '. ' + de)}</p>${ruSay(r)}</div>`).join('')}
      <h2 class="mt-xl">Kurzes Quiz</h2>
      ${W.quiz.map((q, k) => `<div class="card"><div class="q-text fs-105">${k + 1}. ${esc(q.q)}</div><div class="opts">${q.o.map((o, i) => {
        let c = ''; if (ans[k] !== null) { if (i === q.a) c = 'right'; else if (i === ans[k]) c = 'wrong'; }
        return `<button class="opt ${c}" data-w="${k}" data-i="${i}" ${ans[k] !== null ? 'disabled' : ''}><span class="k">${ABC[i]}</span><span>${esc(o)}</span></button>`; }).join('')}</div></div>`).join('')}
      ${ans.every(a => a !== null) ? `<div class="feedback ok">${ans.filter((a, k) => a === W.quiz[k].a).length} von ${W.quiz.length} richtig – du bist bereit für deine erste Wahl!</div>` : ''}
      <p class="small muted mt">Alle Termine und Wahllokale nennt dir deine Gemeinde mit der Wahlbenachrichtigung.</p>`);
  };
  $app.onclick = e => { const t = e.target.closest('[data-w]'); if (t) { ans[+t.dataset.w] = +t.dataset.i; activity(); keepScroll(draw); } };
  draw();
}
export const SHARE_TEXT = 'Kostenlose App zur Vorbereitung auf die Einbürgerung in Sachsen: alle 310 Testfragen, Deutschkurs A1–B1, Unterlagen-Checkliste – mit Erklärungen auf Russisch, Englisch, Türkisch, Arabisch, Polnisch oder Rumänisch.';
export async function shareApp() {
  if (navigator.share) { try { await navigator.share({ title: 'Einbürgerung Sachsen', text: SHARE_TEXT, url: APP_URL }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${SHARE_TEXT} ${APP_URL}`); toast('Link kopiert – jetzt einfügen und verschicken'); } catch { toast(APP_URL); }
}
export function teilen() {
  render(`${back('#mehr', 'Mehr')}<h1>App weiterempfehlen</h1><p class="muted">Kennst du jemanden, der sich einbürgern lassen möchte? Schick ihm die App – kostenlos, ohne Anmeldung.${ru('ui.do-you-know-someone-who-wants-to-bec')}</p>
    <div class="card center"><img src="icons/qr.svg" alt="QR-Code zu ${APP_URL}" style="width:min(240px,70vw);aspect-ratio:1;image-rendering:pixelated;border:1px solid var(--line);border-radius:var(--radius)">
      <p class="small mt">QR-Code mit der Handykamera scannen lassen</p><p class="eyebrow mt-s">${APP_URL.replace('https://', '').replace(/\/$/, '')}</p></div>
    <div class="grid two">
      <button class="btn primary" data-act="share">Teilen …</button>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + ' ' + APP_URL)}" target="_blank" rel="noopener">Per WhatsApp senden</a>
      <a class="btn" href="https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(SHARE_TEXT)}" target="_blank" rel="noopener">Per Telegram senden</a>
      <button class="btn" data-act="copy">Link kopieren</button>
    </div>`);
  $app.onclick = async e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    if (t.dataset.act === 'share') shareApp();
    if (t.dataset.act === 'copy') { try { await navigator.clipboard.writeText(APP_URL); toast('Link kopiert'); } catch { toast(APP_URL); } }
  };
}
// Begrüßung und Frage in allen Sprachen (für den Erststart, bevor eine Sprache gewählt ist)
export const WELCOME = { ru: ['Добро пожаловать!', 'Какой язык добавить к немецкому?'], en: ['Welcome!', 'Which language would you like alongside German?'], tr: ['Hoş geldiniz!', 'Almancanın yanında hangi dili istersiniz?'], ar: ['أهلاً وسهلاً!', 'ما اللغة التي تريدها إلى جانب الألمانية؟'], pl: ['Witamy!', 'Jaki język chcesz obok niemieckiego?'], ro: ['Bun venit!', 'Ce limbă vrei pe lângă germană?'] };
export const many = i => HL.map(l => `<span lang="${l}"${dirAttr(l)}>${WELCOME[l][i]}</span>`).join(' · ');
export function langChoice(first) {
  const cur = S.lang || (first ? '' : 'ru');
  const opts = [...HL.map(k => [k, `Deutsch + ${LANG[k].name}`, `Erklärungen zusätzlich auf ${LANG[k].de}`, LANG[k].also]), ['de', 'Nur Deutsch', 'Alles nur auf Deutsch – gut für Fortgeschrittene', '']];
  return `<div class="langs" role="radiogroup" aria-label="Sprache">${opts.map(([k, t, d, n]) => `<button class="lang ${cur === k ? 'on' : ''}" data-lang="${k}" role="radio" aria-checked="${cur === k}"><span class="flag" aria-hidden="true">${k === 'de' ? 'DE' : 'DE+' + LANG[k].tag}</span><span><b>${esc(t)}</b><span class="small">${d}</span>${n ? `<span class="small" lang="${k}"${dirAttr(k)} style="color:var(--ru)">${n}</span>` : ''}${LANG[k]?.ai ? `<span class="small muted ai">KI-Übersetzung · <span lang="${k}"${dirAttr(k)}>${LANG[k].ai}</span></span>` : ''}</span><span class="tick" aria-hidden="true">${cur === k ? '✓' : ''}</span></button>`).join('')}</div>`;
}
export function langToast() { return hl() ? `Sprache: Deutsch + ${hlName()}` : 'Sprache: Nur Deutsch'; }
// Vorauswahl beim Erststart nach Gerätesprache
export function guessLang() {
  const map = { ru: 'ru', uk: 'ru', be: 'ru', kk: 'ru', en: 'en', tr: 'tr', ar: 'ar', pl: 'pl', ro: 'ro', mo: 'ro', de: '' };
  for (const x of (navigator.languages || [navigator.language || '']).map(x => String(x).slice(0, 2).toLowerCase())) if (x in map) return map[x];
  return '';
}
export function sprache(mode) {
  const first = mode === 'erst' && !S.onboarded;
  if (first && !S.lang) { const g = guessLang(); if (g) { S.lang = g; loadDict(g).then(ok => { if (!ok) S.lang = ''; if (location.hash.startsWith('#sprache')) sprache(mode); }); } }
  render(`${first ? '' : back('#einstellungen', 'Einstellungen')}
    ${first ? `<div class="welcome"><div class="eyebrow">Einbürgerung Sachsen</div><h1>Willkommen!</h1><p class="muted m-0">${many(0)}</p></div>` : '<h1>Sprache</h1>'}
    <p class="mt"><b>Welche Sprache möchtest du zusätzlich zu Deutsch?</b><span class="small" style="display:block;color:var(--ru)">${many(1)}</span></p>
    ${langChoice(first)}
    <p class="small muted">Deutsch steht immer an erster Stelle. Du kannst die Sprache jederzeit unter <b>Einstellungen</b> ändern.${ru('ui.german-always-comes-first-you-can-ch')}</p>
    ${first ? `<div class="row end"><button class="btn primary" data-act="weiter" ${S.lang ? '' : 'disabled'}>Weiter ›</button></div>` : '<div class="row"><a class="btn" href="#tutorial">Einführung ansehen</a></div>'}`);
  $app.onclick = async e => {
    const b = e.target.closest('[data-lang]');
    if (b) { if (await setLang(b.dataset.lang)) { if (!first) toast(langToast()); sprache(mode); } return; }
    if (e.target.closest('[data-act="weiter"]') && S.lang) { await setLang(S.lang); location.hash = '#tutorial--erst'; }
  };
}
export const NAV_SVG = id => document.querySelector(`.nav [data-nav="${id}"] svg`)?.outerHTML || '';
export function tutorialSlides() {
  return [
    { ico: '<svg viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor"/><path d="M10 16.5l4 4 8-9" stroke="var(--brand-ink)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      t: ['Deine Lernhilfe für die Einbürgerung', 'ui.your-guide-to-naturalisation'],
      p: [['Hier lernst du alles für den Einbürgerungstest und die B1-Prüfung und findest Unterlagen und Behörden in Sachsen.', 'ui.here-you-prepare-for-the-naturalisat'],
          ['Kostenlos, ohne Anmeldung, funktioniert auch ohne Internet.', 'ui.free-no-registration-and-it-also-wor']] },
    { ico: NAV_SVG('start'), t: ['Start: dein Tag', 'ui.start-your-day'],
      p: [['Der Ring zeigt dein Tagesziel. Darunter steht, was heute dran ist.', 'ui.the-ring-shows-your-daily-goal-below'],
          ['„Schritt für Schritt“ zeigt den ganzen Weg bis zur Urkunde.', 'ui.schritt-f-r-schritt-step-by-step-sho']] },
    { ico: NAV_SVG('test'), t: ['Test: lernen und üben', 'ui.test-learn-and-practise'],
      p: [['„Lernen“ fragt dich klug ab: Fragen, die du falsch hattest, kommen öfter wieder.', 'ui.lernen-learn-asks-you-cleverly-quest'],
          ['„Prüfung simulieren“ ist wie der echte Test: 33 Fragen in 60 Minuten. Bestanden ab 17 richtigen.', 'ui.pr-fung-simulieren-practice-exam-is']] },
    { ico: `<svg viewBox="0 0 24 24">${SAY_ICON.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, t: ['Hilfen auf jeder Seite', 'ui.help-on-every-page'], demo: true,
      p: [['Gepunktet unterstrichene Wörter antippen – dann kommt eine einfache Erklärung.', 'ui.tap-a-word-with-a-dotted-underline-a'],
          ['Lautsprecher = vorlesen. Mikrofon = nachsprechen, die App prüft deine Aussprache.', 'ui.speaker-read-aloud-microphone-repeat'],
          ['Unten rechts kannst du die ganze Seite vorlesen lassen.', 'ui.at-the-bottom-right-you-can-have-the']] },
    { ico: NAV_SVG('kurs'), t: ['Deutsch: von A1 bis B1', 'ui.german-from-a1-to-b1'],
      p: [['30 Lektionen mit Grammatik, Wörtern, Dialogen und Übungen.', 'ui.30-lessons-with-grammar-vocabulary-d'],
          ['Dazu ein Vokabeltrainer und Aufgaben wie in der B1-Prüfung.', 'ui.plus-a-vocabulary-trainer-and-tasks']] },
    { ico: NAV_SVG('docs'), t: ['Unterlagen und Behörden', 'ui.documents-and-authorities'],
      p: [['Hake ab, welche Unterlagen du schon hast. Finde deine Einbürgerungsbehörde über Ort oder Postleitzahl.', 'ui.tick-off-which-documents-you-already'],
          ['Unter „Mehr“: Lernplan, Lebenslauf, Kosten, Ablaufdaten, Briefvorlagen und vieles mehr.', 'ui.under-mehr-more-study-plan-cv-costs']] },
    { ico: NAV_SVG('profil'), t: ['Dein Fortschritt', 'ui.your-progress'],
      p: [['Alles wird automatisch gespeichert – nur auf diesem Gerät, ohne Konto.', 'ui.everything-is-saved-automatically-on'],
          ['Lade ab und zu unter „Einstellungen“ eine Sicherungsdatei herunter, z. B. für ein neues Handy. Mehrere Personen? Nutzt den Familienmodus.', 'ui.download-a-backup-file-in-the-settin']] },
    { ico: NAV_SVG('einstellungen'), t: ['Sprache und Einführung', 'ui.language-and-introduction'],
      p: [['Die Sprache kannst du jederzeit unter „Einstellungen“ ändern – auch auf „Nur Deutsch“.', 'ui.you-can-change-the-language-at-any-t'],
          ['Diese Einführung findest du dort und unter „Mehr“ wieder. Viel Erfolg!', 'ui.you-can-open-this-introduction-again']] }
  ];
}
export function tutorial(mode) {
  const first = mode === 'erst' && !S.onboarded;
  const slides = tutorialSlides();
  let k = 0;
  const finish = () => { S.onboarded = true; save(); document.body.classList.remove('onboarding'); location.hash = '#start'; if (first) setTimeout(() => installGate(), 400); };
  const draw = () => {
    const s = slides[k], last = k === slides.length - 1;
    render(`<div class="tut">
      <div class="row tut-head"><span class="eyebrow">Einführung · ${k + 1} / ${slides.length}</span><span class="spacer"></span>${last ? '' : `<button class="btn small ghost" data-act="skip">${first ? 'Überspringen' : 'Schließen'}</button>`}</div>
      <div class="tut-ico" aria-hidden="true">${s.ico}</div>
      <h1>${esc(s.t[0])} ${say(s.t[0])}</h1>${ru(s.t[1])}
      ${s.p.map(([d, r]) => `<p>${esc(d)} ${say(d)}${ruSay(r)}</p>`).join('')}
      ${s.demo ? `<div class="card tut-demo"><div class="small muted mb-s">Probier es aus:${ru('ui.try-it')}</div><div class="q-text fs-105">Was steht im ${gloss('Grundgesetz')}? ${say('Was steht im Grundgesetz?')} ${mic('Was steht im Grundgesetz?')}</div></div>` : ''}
      <div class="dots" aria-hidden="true">${slides.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row tut-nav">${k ? '<button class="btn" data-act="prev">‹ Zurück</button>' : `${first ? '<a class="btn ghost" href="#sprache--erst">‹ Sprache</a>' : ''}`}<span class="spacer"></span><button class="btn primary" data-act="${last ? 'done' : 'next'}">${last ? (first ? 'Los geht’s' : 'Fertig') : 'Weiter ›'}</button></div>
    </div>`);
    $app.querySelector('[data-act="next"],[data-act="done"]')?.focus({ preventScroll: true });
  };
  $app.onclick = e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'next') { k = Math.min(slides.length - 1, k + 1); stopSpeak(); draw(); window.scrollTo(0, 0); }
    else if (a === 'prev') { k = Math.max(0, k - 1); stopSpeak(); draw(); window.scrollTo(0, 0); }
    else if (a === 'skip' || a === 'done') finish();
  };
  // Wischen auf dem Handy
  let x0 = null;
  const ts = e => { x0 = e.touches[0].clientX; }, te = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) { k = Math.max(0, Math.min(slides.length - 1, k + (dx < 0 ? 1 : -1))); stopSpeak(); draw(); } };
  $app.addEventListener('touchstart', ts, { passive: true }); $app.addEventListener('touchend', te);
  onLeave(() => { $app.removeEventListener('touchstart', ts); $app.removeEventListener('touchend', te); });
  draw();
}
