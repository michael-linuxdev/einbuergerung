// Lernplan mit Kalender-Erinnerung, Lebenslauf-Generator
import { $app, DAY, EMBED, MONATE, daysUntil, download, esc, icsFile, toast, today } from '../core.js';
import { D } from '../data.js';
import { ru } from '../i18n.js';
import { keepScroll, render } from '../router.js';
import { S, save } from '../store.js';

export function planData() {
  const openQ = D.q.filter(q => (S.srs[q.id]?.l || 0) < 4).length;
  const openL = D.kurs.filter(l => !S.kurs[l.id]?.done);
  const r = { openQ, openL: openL.length, nextL: openL[0] };
  if (S.testdate) { r.tDays = daysUntil(S.testdate); r.qPerDay = r.tDays > 0 ? Math.ceil(openQ / Math.max(1, r.tDays - 3)) : openQ; }
  if (S.b1date) { r.bDays = daysUntil(S.b1date); r.lPerWeek = r.bDays > 0 ? Math.ceil(openL.length / Math.max(1, (r.bDays - 14) / 7)) : openL.length; }
  return r;
}
export function plan() {
  const p = planData();
  render(`<h1>Mein Lernplan</h1><p class="muted">Trage deine Termine ein. Die App rechnet aus, wie viel du pro Tag bzw. Woche schaffen musst.${ru('ui.enter-your-exam-dates-the-app-works')}</p>
    <div class="card grid two">
      <div><label class="lbl" for="td">Termin Einbürgerungstest</label><input class="text" type="date" id="td" value="${esc(S.testdate)}"></div>
      <div><label class="lbl" for="bd">Termin B1-Sprachprüfung</label><input class="text" type="date" id="bd" value="${esc(S.b1date)}"></div>
    </div>
    ${S.testdate ? `<div class="card"><h2>Einbürgerungstest</h2>${p.tDays < 0 ? '<p>Der Termin liegt in der Vergangenheit.</p>' : `<dl class="kv"><dt>Noch</dt><dd><b>${p.tDays} Tage</b></dd><dt>Offene Fragen</dt><dd>${p.openQ} von 310</dd><dt>Pro Tag</dt><dd><b>${p.qPerDay} Fragen</b> (die letzten 3 Tage nur Wiederholung)</dd><dt>Letzte Woche</dt><dd>täglich eine Prüfungssimulation, Ziel: sicher über 25 Punkte</dd></dl>`}</div>` : ''}
    ${S.b1date ? `<div class="card"><h2>B1-Prüfung</h2>${p.bDays < 0 ? '<p>Der Termin liegt in der Vergangenheit.</p>' : `<dl class="kv"><dt>Noch</dt><dd><b>${p.bDays} Tage</b></dd><dt>Offene Lektionen</dt><dd>${p.openL} von ${D.kurs.length}</dd><dt>Pro Woche</dt><dd><b>${p.lPerWeek} Lektion${p.lPerWeek > 1 ? 'en' : ''}</b></dd><dt>Letzte 2 Wochen</dt><dd>Hören, Lesen, Schreiben und Sprechen im B1-Bereich üben</dd></dl>${p.bDays < 60 && p.openL > 10 ? '<div class="notice mt">Das wird knapp. Ein Integrationskurs oder ein späterer Termin kann helfen.</div>' : ''}`}</div>` : ''}
    ${(S.testdate || S.b1date) && !EMBED ? `<div class="card"><h2>Erinnerung im Kalender</h2><p class="small">Lädt einen täglichen Lerntermin in deinen Kalender (iPhone, Android, Outlook). Dein Handy erinnert dich dann jeden Tag.${ru('ui.adds-a-daily-study-reminder-to-your')}</p>
      <div class="row"><label class="lbl m-0" for="pt">Uhrzeit</label><input class="text" type="time" id="pt" value="${esc(S.planTime)}" style="width:auto"><button class="btn primary" data-act="ics">Erinnerung hinzufügen</button></div></div>` : ''}`);
  $app.onchange = e => {
    if (e.target.id === 'td') { S.testdate = e.target.value; save(); plan(); }
    if (e.target.id === 'bd') { S.b1date = e.target.value; save(); plan(); }
    if (e.target.id === 'pt') { S.planTime = e.target.value || '19:00'; save(); }
  };
  $app.onclick = e => {
    if (!e.target.closest('[data-act="ics"]')) return;
    const start = new Date(today() + DAY);
    const last = [S.testdate, S.b1date].filter(Boolean).map(s => new Date(s + 'T00:00')).sort((a, b) => b - a)[0];
    const ev = [{ title: 'Einbürgerung: 20 Minuten lernen', desc: 'Lernplan in der App öffnen: https://einbuergerung.micana.de/#plan', start, time: S.planTime, until: last, min: 20 }];
    if (S.testdate) ev.push({ title: 'Einbürgerungstest', desc: 'Ausweis und Anmeldebestätigung mitnehmen.', start: new Date(S.testdate + 'T00:00'), alarm: '-P1D' });
    if (S.b1date) ev.push({ title: 'B1-Sprachprüfung', desc: 'Ausweis und Anmeldebestätigung mitnehmen.', start: new Date(S.b1date + 'T00:00'), alarm: '-P1D' });
    download('lernplan-einbuergerung.ics', icsFile(ev), 'text/calendar');
    toast('Kalenderdatei erstellt – bitte öffnen und hinzufügen');
  };
}
export const CV_TYPES = [
  ['schule', 'Schule'], ['ausbildung', 'Ausbildung'], ['studium', 'Studium'], ['arbeit', 'Arbeit'], ['wehrdienst', 'Wehrdienst'],
  ['ohne', 'Ohne Arbeit / Elternzeit / Pflege'], ['wohnort', 'Wohnort / Umzug'], ['einreise', 'Einreise nach Deutschland'],
  ['heirat', 'Heirat'], ['kind', 'Geburt eines Kindes'], ['kurs', 'Sprach- oder Integrationskurs'], ['sonst', 'Sonstiges']];
export const CV_HINT = { schule: ['Schule (z. B. Mittelschule Nr. 5)', 'Ort, Land'], ausbildung: ['Beruf (z. B. Elektriker)', 'Betrieb / Ort'], studium: ['Fach und Hochschule', 'Ort, Land'], arbeit: ['Tätigkeit (z. B. Lagerarbeiter)', 'Firma, Ort'], wehrdienst: ['–', 'Ort, Land'], ohne: ['Grund (z. B. Elternzeit, Arbeitssuche)', 'Ort'], wohnort: ['–', 'Ort'], einreise: ['Grund (z. B. Familiennachzug)', 'erster Wohnort'], heirat: ['Name der Ehepartnerin / des Ehepartners', 'Ort'], kind: ['Name des Kindes', 'Ort'], kurs: ['Kurs (z. B. Integrationskurs)', 'Träger, Ort'], sonst: ['Was? (ganzer Satz möglich)', 'Ort'] };
export const ONCE = ['einreise', 'heirat', 'kind'];
export function mon(v) { if (!v) return ''; const [y, m] = v.split('-'); return `${MONATE[+m - 1]} ${y}`; }
export function cvDefault() { return { name: '', geb: '', ort: '', eltern: '', geschwister: '', entries: [{ typ: 'schule', von: '', bis: '', was: '', wo: '' }], schluss: '' }; }
export function cvText(cv) {
  const s = [];
  const geb = cv.geb ? new Date(cv.geb + 'T00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '[Geburtsdatum]';
  s.push(`Mein Name ist ${cv.name || '[Vorname Nachname]'}. Ich wurde am ${geb} in ${cv.ort || '[Geburtsort, Land]'} geboren.`);
  if (cv.eltern) s.push(cv.eltern.trim().replace(/([^.!?])$/, '$1.'));
  if (cv.geschwister) s.push(cv.geschwister.trim().replace(/([^.!?])$/, '$1.'));
  const es = cv.entries.filter(e => e.von).sort((a, b) => a.von.localeCompare(b.von));
  for (const e of es) {
    const von = mon(e.von), bis = mon(e.bis), seit = !e.bis && !ONCE.includes(e.typ);
    const zeit = seit ? `Seit ${von}` : `Von ${von} bis ${bis}`;
    const wo = e.wo ? ` in ${e.wo}` : '';
    const was = (e.was || '').trim();
    switch (e.typ) {
      case 'schule': s.push(`${zeit} ${seit ? 'besuche' : 'besuchte'} ich ${was || 'die Schule'}${wo}.`); break;
      case 'ausbildung': s.push(`${zeit} ${seit ? 'mache' : 'machte'} ich eine Ausbildung als ${was || '[Beruf]'}${wo}.`); break;
      case 'studium': s.push(`${zeit} ${seit ? 'studiere' : 'studierte'} ich ${was || '[Fach]'}${wo}.`); break;
      case 'arbeit': s.push(`${zeit} ${seit ? 'arbeite' : 'arbeitete'} ich als ${was || '[Tätigkeit]'}${e.wo ? ` bei ${e.wo}` : ''}.`); break;
      case 'wehrdienst': s.push(`${zeit} ${seit ? 'leiste' : 'leistete'} ich meinen Wehrdienst${wo}.`); break;
      case 'ohne': s.push(`${zeit} ${seit ? 'bin' : 'war'} ich nicht berufstätig${was ? ` (${was})` : ''}${wo}.`); break;
      case 'wohnort': s.push(`${zeit} ${seit ? 'wohne' : 'wohnte'} ich${wo}.`); break;
      case 'einreise': s.push(`Im ${von} reiste ich nach Deutschland ein${was ? ` (${was})` : ''}${e.wo ? ` und wohnte zuerst in ${e.wo}` : ''}.`); break;
      case 'heirat': s.push(`Im ${von} heiratete ich ${was || '[Name]'}${wo}.`); break;
      case 'kind': s.push(`Im ${von} wurde ${was ? `unser Kind ${was}` : 'unser Kind'}${wo} geboren.`); break;
      case 'kurs': s.push(`${zeit} ${seit ? 'besuche' : 'besuchte'} ich ${was || 'einen Sprachkurs'}${wo}.`); break;
      default: if (was) s.push(`${seit || !e.bis ? (e.bis ? zeit : `Im ${von}`) : zeit}: ${was.replace(/([^.!?])$/, '$1.')}`);
    }
  }
  if (cv.schluss) s.push(cv.schluss.trim().replace(/([^.!?])$/, '$1.'));
  return s.join(' ');
}
export function cvGaps(cv) {
  const t = cv.entries.filter(e => e.von && !ONCE.includes(e.typ) && e.typ !== 'wohnort').sort((a, b) => a.von.localeCompare(b.von));
  const gaps = []; let end = null;
  const toM = v => { const [y, m] = v.split('-'); return +y * 12 + (+m - 1); };
  const nowM = new Date().getFullYear() * 12 + new Date().getMonth();
  for (const e of t) {
    const a = toM(e.von), b = e.bis ? toM(e.bis) : nowM;
    if (end !== null && a - end > 3) gaps.push(`${mon(`${Math.floor(end / 12)}-${String(end % 12 + 1).padStart(2, '0')}`)} – ${mon(e.von)}`);
    end = end === null ? b : Math.max(end, b);
  }
  if (end !== null && nowM - end > 3) gaps.push(`${mon(`${Math.floor(end / 12)}-${String(end % 12 + 1).padStart(2, '0')}`)} – heute`);
  return gaps;
}
export function lebenslauf() {
  if (!S.cv) { S.cv = cvDefault(); save(); }
  const cv = S.cv;
  const field = (k, label, ph, type = 'text') => `<div><label class="lbl" for="cv-${k}">${label}</label><input class="text" id="cv-${k}" data-f="${k}" type="${type}" value="${esc(cv[k])}" placeholder="${esc(ph)}"></div>`;
  render(`<h1>Lebenslauf-Generator</h1>
    <p class="muted">Viele Behörden – z. B. das Landratsamt Pirna, auch für Freital – verlangen einen ausführlichen Lebenslauf als Fließtext auf Deutsch, lückenlos ab der Geburt. Trage deine Stationen ein, die App schreibt den Text.${ru('ui.many-authorities-e-g-the-district-of')}</p>
    <div class="card grid two">
      ${field('name', 'Vor- und Nachname', 'z. B. Olga Ivanova')}
      ${field('geb', 'Geburtsdatum', '', 'date')}
      ${field('ort', 'Geburtsort und Land', 'z. B. Omsk, Russland')}
      <div class="full"><label class="lbl" for="cv-eltern">Eltern (ganzer Satz)</label><input class="text" id="cv-eltern" data-f="eltern" value="${esc(cv.eltern)}" placeholder="z. B. Mein Vater Igor Ivanov war Ingenieur, meine Mutter Elena Ivanova ist Lehrerin."></div>
      <div class="full"><label class="lbl" for="cv-geschwister">Geschwister (ganzer Satz, optional)</label><input class="text" id="cv-geschwister" data-f="geschwister" value="${esc(cv.geschwister)}" placeholder="z. B. Ich habe einen älteren Bruder, Pavel, er lebt in Moskau."></div>
    </div>
    <h2>Stationen</h2><p class="small muted">Monat und Jahr genügen. „Bis“ leer lassen, wenn es heute noch so ist.</p>
    <div id="entries">${cv.entries.map((e, k) => `<div class="card flat">
      <div class="row"><select class="text grow" data-e="${k}" data-k="typ" aria-label="Art der Station">${CV_TYPES.map(([v, n]) => `<option value="${v}" ${e.typ === v ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn small ghost" data-del="${k}" aria-label="Station löschen">Löschen</button></div>
      <div class="grid two mt">
        <div><label class="lbl small" for="e${k}von">${ONCE.includes(e.typ) ? 'Wann' : 'Von'}</label><input class="text" id="e${k}von" type="month" data-e="${k}" data-k="von" value="${esc(e.von)}"></div>
        ${ONCE.includes(e.typ) ? '<div></div>' : `<div><label class="lbl small" for="e${k}bis">Bis</label><input class="text" id="e${k}bis" type="month" data-e="${k}" data-k="bis" value="${esc(e.bis)}"></div>`}
        ${CV_HINT[e.typ][0] !== '–' ? `<div><label class="lbl small" for="e${k}was">Was</label><input class="text" id="e${k}was" data-e="${k}" data-k="was" value="${esc(e.was)}" placeholder="${esc(CV_HINT[e.typ][0])}"></div>` : ''}
        <div><label class="lbl small" for="e${k}wo">Wo</label><input class="text" id="e${k}wo" data-e="${k}" data-k="wo" value="${esc(e.wo)}" placeholder="${esc(CV_HINT[e.typ][1])}"></div>
      </div></div>`).join('')}</div>
    <button class="btn block mb-l" data-act="add">+ Station hinzufügen</button>
    <div class="card"><label class="lbl" for="cv-schluss">Abschluss (optional)</label><textarea class="text" id="cv-schluss" data-f="schluss" style="min-height:90px" placeholder="z. B. Ich fühle mich in Deutschland zu Hause und möchte deshalb die deutsche Staatsangehörigkeit annehmen.">${esc(cv.schluss)}</textarea></div>
    <button class="btn primary block" data-act="gen">Lebenslauf erstellen</button>
    <div id="out" class="mt-l"></div>`);
  const rerenderKeep = () => keepScroll(lebenslauf);
  $app.oninput = e => {
    const t = e.target;
    if (t.dataset.f) { cv[t.dataset.f] = t.value; save(); }
    if (t.dataset.e != null && t.dataset.k !== 'typ') { cv.entries[+t.dataset.e][t.dataset.k] = t.value; save(); }
  };
  $app.onchange = e => { const t = e.target; if (t.dataset.k === 'typ') { cv.entries[+t.dataset.e].typ = t.value; save(); rerenderKeep(); } };
  $app.onclick = async e => {
    const t = e.target.closest('[data-act],[data-del]'); if (!t) return;
    if (t.dataset.del != null) { cv.entries.splice(+t.dataset.del, 1); save(); rerenderKeep(); }
    else if (t.dataset.act === 'add') { const last = cv.entries[cv.entries.length - 1]; cv.entries.push({ typ: 'arbeit', von: last?.bis || '', bis: '', was: '', wo: '' }); save(); rerenderKeep(); }
    else if (t.dataset.act === 'gen') {
      const gaps = cvGaps(cv);
      document.getElementById('out').innerHTML = `${gaps.length ? `<div class="notice">Mögliche Lücken (mehr als 3 Monate): ${gaps.map(esc).join('; ')}. Behörden möchten einen lückenlosen Lebenslauf – ergänze z. B. „Ohne Arbeit“ oder „Elternzeit“.</div>` : '<div class="notice ok">Keine Lücken gefunden.</div>'}
        <label class="lbl" for="cvout">Dein Lebenslauf (du kannst ihn hier noch bearbeiten)</label><textarea class="text" id="cvout" lang="de">${esc(cvText(cv))}</textarea>
        <div class="row mt"><button class="btn primary" data-act="copy">Text kopieren</button></div>
        <p class="small muted">Tipp: In ein Textdokument einfügen, Ort, Datum und Unterschrift ergänzen und ausdrucken. Lass den Text am besten noch einmal von jemandem mit gutem Deutsch lesen.</p>`;
      document.getElementById('out').scrollIntoView({ behavior: 'smooth' });
    } else if (t.dataset.act === 'copy') {
      const ta = document.getElementById('cvout');
      try { await navigator.clipboard.writeText(ta.value); toast('Kopiert'); } catch { ta.select(); toast('Text markiert – jetzt kopieren'); }
    }
  };
}
