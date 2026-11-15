// Startseite: Tagesziel, Fragen-Fortschritt, nächster Schritt, Schritt für Schritt
import { $app, DAY, EMBED, bar, dayKey, daysUntil, esc, fmtDate, pct, toast } from '../core.js';
import { D } from '../data.js';
import { LANG, hl, ru, ruRaw, tr } from '../i18n.js';
import { render } from '../router.js';
import { P, S, dailyGoal, exportBackup, learned, profileName, save, streak } from '../store.js';
import { fristWarnings } from './check.js';
import { visibleDocs } from './docs.js';
import { planData } from './plan.js';

export function stepDone(id) {
  const docsItems = visibleDocs().flatMap(g => g.items);
  switch (id) {
    case 's1': return Object.keys(S.check).length >= D.info.check.length;
    case 's2': return D.kurs.filter(l => S.kurs[l.id]?.done).length === D.kurs.length;
    case 's3': return S.exams.some(e => e.score >= 17 && e.total === 33) && learned(S.srs, D.q.map(q => q.id)) >= 250;
    case 's4': return docsItems.length && docsItems.filter(i => S.docs[i.id]).length >= docsItems.length * 0.8;
    case 's5': return !!S.amt;
    case 's6': return !!S.milestones.antrag;
    case 's7': case 's8': return !!S.milestones.urkunde;
    default: return false;
  }
}
export function greet() { const h = new Date().getHours(); return h < 11 ? ['Guten Morgen', 'ui.good-morning'] : h < 18 ? ['Guten Tag', 'ui.good-afternoon'] : ['Guten Abend', 'ui.good-evening']; }
// Schritte, die man selbst abhakt (Antrag gestellt, Urkunde erhalten)
export const MS = { s6: 'antrag', s8: 'urkunde' };
export const msBtn = (id, cls = '') => MS[id] ? `<button class="btn small ${cls}" data-ms="${MS[id]}" aria-pressed="${!!S.milestones[MS[id]]}">${S.milestones[MS[id]] ? '✓ Erledigt' : 'Als erledigt markieren'}</button>` : '';
export function start() {
  const qL = learned(S.srs, D.q.map(q => q.id));
  const best = S.exams.length ? Math.max(...S.exams.map(e => e.score)) : null;
  const p = planData();
  const goal = dailyGoal(), doneToday = S.daily[dayKey()] || 0, st = streak();
  const next = D.kurs.find(l => !S.kurs[l.id]?.done);
  const [g, gru] = greet(), name = profileName();
  const tasks = [];
  if (S.testdate && p.tDays >= 0 && p.tDays <= 7) tasks.push('eine Prüfungssimulation');
  else tasks.push(`${Math.max(0, goal - doneToday) || goal} Testfragen`);
  if (next) tasks.push(`Lektion ${next.lv}.${D.kurs.filter(l => l.lv === next.lv).indexOf(next) + 1}`);
  const soonest = (S.fristen || []).filter(f => f.d).map(f => ({ ...f, n: daysUntil(f.d) })).sort((a, b) => a.n - b.n)[0];
  let resid = null;
  if (S.einreise) { const d = new Date(S.einreise); d.setFullYear(d.getFullYear() + (S.ehe ? 3 : 5)); resid = Math.ceil((d - Date.now()) / DAY); }
  const backupDue = !EMBED && Object.keys(S.daily).length >= 3 && (!S.lastExport || Date.now() - S.lastExport > 30 * DAY);
  render(`
    <div class="hero">
      <div class="row"><span class="eyebrow">Deine Lernhilfe · Einbürgerung in Sachsen</span><span class="spacer"></span>${st ? `<span class="streak" title="Lerntage am Stück">🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'}</span>` : ''}</div>
      <h1>${g}${name ? ', ' + esc(name) : ''}.</h1>${ruRaw(tr(gru) + (name ? ', ' + name : '') + '.')}
      <p class="small muted mt-s">Private, kostenlose Lernhilfe – kein Angebot einer Behörde.${ru('ui.a-private-free-learning-aid-not-a-se')}</p>
      <div class="row mt"><a class="who" href="#profil">👤 ${P.list.length > 1 ? `${esc(name || 'Profil')} wechseln` : 'Familienmodus'}</a><a class="who" href="#sprache">🌐 ${hl() ? 'DE + ' + LANG[hl()].tag : 'Nur DE'}</a></div>
    </div>
    <a class="doc" href="#test">
      <div class="field"><span>Einbürgerungstest</span><span>${S.testdate ? 'Termin ' + fmtDate(new Date(S.testdate + 'T00:00')) : 'Noch kein Termin'}</span></div>
      <div class="count">${qL}<small> / 310 Fragen sicher</small></div>
      <div class="mt">${bar(pct(qL, 310))}</div>
    </a>
    <div class="today">
      <div class="ring" style="--p:${Math.min(100, pct(doneToday, goal))}" role="img" aria-label="Tagesziel ${doneToday} von ${goal}"><div><span>${doneToday}/${goal}<small>HEUTE</small></span></div></div>
      <div class="body"><div class="eyebrow">Heute${S.testdate && p.tDays >= 0 ? ` · noch ${p.tDays} Tage` : ''}</div>
        <h3>${doneToday >= goal ? 'Tagesziel geschafft! 🎉' : esc(tasks.join(' und '))}</h3>
        <div class="row"><a class="btn small" href="${S.testdate && p.tDays <= 7 && p.tDays >= 0 ? '#pruefung' : '#lernen'}">${S.testdate && p.tDays <= 7 && p.tDays >= 0 ? 'Simulation' : 'Fragen lernen'}</a>${next ? `<a class="btn small o" href="#lektion--${next.id}">Lektion</a>` : ''}</div></div>
    </div>
    <div class="mini">
      <a href="#test"><div class="n">${best !== null ? best + '/33' : '–'}</div><div class="l">Beste Simulation</div></a>
      ${soonest ? `<a href="#check--fristen"><div class="n" style="color:${soonest.n < 0 ? 'var(--bad)' : soonest.n < 180 ? 'var(--warn)' : 'inherit'}">${soonest.n < 0 ? 'abgelaufen' : soonest.n + ' T.'}</div><div class="l">${esc(soonest.t)} gültig</div></a>`
        : resid !== null ? `<a href="#check"><div class="n">${resid <= 0 ? '✓' : resid + ' T.'}</div><div class="l">${resid <= 0 ? 'Aufenthaltsdauer erfüllt' : 'bis Antrag möglich'}</div></a>`
        : `<a href="#check"><div class="n">?</div><div class="l">Ab wann darfst du? Prüfen</div></a>`}
    </div>
    ${fristWarnings()}
    ${backupDue ? `<div class="notice">Sichere deinen Fortschritt ab und zu als Datei – z. B. für einen Handywechsel.<div class="row mt-s"><button class="btn small" data-act="backup">Sicherung herunterladen</button></div></div>` : ''}
    ${(() => { const k = D.info.steps.findIndex(s => !stepDone(s.id)); if (k < 0) return ''; const s = D.info.steps[k];
      const body = `<span class="n" aria-hidden="true">${k + 1}</span><span class="b"><span class="eyebrow">Nächster Schritt · ${k + 1}/${D.info.steps.length}</span><b>${esc(s.t)}</b>${ru(s.ru)}</span>`;
      return MS[s.id] || !s.go ? `<div class="next">${body}${msBtn(s.id, 'primary')}</div>` : `<a class="next" href="#${s.go}">${body}<span class="go" aria-hidden="true">›</span></a>`; })()}
    <details class="level"><summary><span class="lv">Schritt für Schritt</span><span class="badge">${D.info.steps.filter(s => stepDone(s.id)).length}/${D.info.steps.length}</span><span class="spacer"></span><span class="chev">›</span></summary>
      <ol class="steps mt">${D.info.steps.map(s => `<li class="${stepDone(s.id) ? 'done' : ''}"><b>${esc(s.t)}</b>${ru(s.ru)}<div class="small mt-xs">${esc(s.d)}</div>${ru(s.dru)}${s.go || MS[s.id] ? `<div class="row mt-s">${s.go ? `<a class="btn small" href="#${s.go}">Öffnen</a>` : ''}${msBtn(s.id)}</div>` : ''}</li>`).join('')}</ol></details>
    <p class="small muted">Stand ${esc(D.info.stand)}. Keine Rechtsberatung – verbindlich ist die Auskunft deiner Einbürgerungsbehörde.</p>`);
  $app.onclick = e => {
    const m = e.target.closest('[data-ms]');
    if (m) { const k = m.dataset.ms; S.milestones[k] = !S.milestones[k]; save(); if (S.milestones[k]) toast(k === 'urkunde' ? 'Herzlichen Glückwunsch! 🎉 Als Nächstes: „Mein erstes Mal wählen“' : 'Antrag gestellt – viel Erfolg!'); start(); return; }
    if (e.target.closest('[data-act="backup"]')) exportBackup();
  };
}
