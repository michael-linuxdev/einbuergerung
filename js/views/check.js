// Voraussetzungen & Fristen (Pass, Aufenthaltstitel)
import { $app, EMBED, dayKey, daysUntil, download, esc, fmtDate, icsFile, toast } from '../core.js';
import { D } from '../data.js';
import { ru } from '../i18n.js';
import { keepScroll, render } from '../router.js';
import { S, save } from '../store.js';

export function check(part) {
  const C = D.info.check, F = S.fristen;
  const answered = C.filter(c => S.check[c.id] != null);
  const vals = answered.map(c => c.o[S.check[c.id]].v);
  const overall = answered.length < C.length ? null : vals.includes(0) ? 'r' : vals.includes(1) ? 'y' : 'g';
  let frist = '';
  if (S.einreise) { const d = new Date(S.einreise); d.setFullYear(d.getFullYear() + (S.ehe ? 3 : 5)); frist = d <= new Date() ? `<div class="notice ok">Die Mindestaufenthaltsdauer ist erfüllt (seit ${fmtDate(d)}).</div>` : `<div class="notice">Antrag frühestens ab <b>${fmtDate(d)}</b>. Den Test und Deutsch kannst du schon vorher machen!</div>`; }
  const ab = S.amt && D.amt.behoerden.find(b => b.id === S.amt)?.extra?.find(x => x.name.startsWith('Ausländerbehörde'));
  render(`<h1>Voraussetzungen & Fristen</h1>
    <p class="muted">Unverbindliche Selbsteinschätzung nach § 10 StAG (Stand ${esc(D.info.stand)}). Die Entscheidung trifft die Einbürgerungsbehörde.${ru('ui.non-binding-self-assessment-under-10')}</p>
    <div class="card"><h2>Ab wann darf ich?</h2>${ru('ui.from-when-can-i-apply')}
      <label class="lbl mt" for="ein">Beginn des rechtmäßigen Aufenthalts in Deutschland</label>
      <input class="text" type="date" id="ein" value="${esc(S.einreise)}" max="${dayKey()}">
      <label class="check mt"><input type="checkbox" id="ehe" ${S.ehe ? 'checked' : ''}><div>Ich bin mit einer/einem Deutschen verheiratet (Ehe besteht seit mind. 2 Jahren)${ru('ui.i-am-married-to-a-german-citizen-for')}</div></label>
      <div class="mt">${frist}</div>
      <p class="small muted">Zeiten mit Duldung oder Aufenthaltsgestattung zählen meist nicht oder nur teilweise. Unterbrechungen durch Auslandsaufenthalte mit der Behörde klären.</p></div>
    <div class="card" id="fristen"><h2>Pass und Aufenthaltstitel</h2><p class="small muted">Beide müssen während des ganzen Verfahrens gültig sein. Die App warnt dich 6 Monate vor Ablauf.${ru('ui.your-passport-and-residence-permit-m')}</p>
      <ul class="list">${F.map((f, k) => { const st = fristStatus(f.d); const n = f.d ? daysUntil(f.d) : null;
      return `<li><div class="row"><span class="ampel ${st || 'none'}"></span><input class="text grow" data-t="${k}" value="${esc(f.t)}" aria-label="Bezeichnung">${k > 1 ? `<button class="btn small ghost" data-del="${k}">Löschen</button>` : ''}</div>
        <div class="row mt-s"><label class="lbl small m-0" for="fd${k}">gültig bis</label><input class="text grow" type="date" id="fd${k}" data-d="${k}" value="${esc(f.d)}"></div>
        ${n != null ? `<div class="small mt-xs">${n < 0 ? `<b class="c-bad">Abgelaufen seit ${-n} Tagen – sofort verlängern!</b>` : n < 180 ? `<b class="c-warn">Noch ${n} Tage – jetzt Verlängerung beantragen.</b>` : `Noch ${n} Tage gültig.`}</div>` : ''}</li>`; }).join('')}</ul>
      <div class="row"><button class="btn small" data-act="add">+ Weiteres Dokument</button>${!EMBED && F.some(f => f.d) ? '<button class="btn small" data-act="ics">Erinnerung in den Kalender</button>' : ''}</div>
      <p class="small muted mt">Den Aufenthaltstitel verlängert die Ausländerbehörde${ab ? ` (${esc(ab.adresse)}, Tel. ${esc(ab.tel)})` : ' deines Landkreises bzw. deiner Stadt'}. Den Pass verlängert die Botschaft oder das Konsulat deines Herkunftslands – das dauert oft Monate.</p></div>
    ${overall ? `<div class="card"><h2><span class="ampel ${overall}"></span>${overall === 'g' ? 'Gute Chancen' : overall === 'y' ? 'Fast – es fehlen noch Schritte' : 'Derzeit nicht erfüllt'}</h2><p class="small">${overall === 'g' ? 'Nach deinen Angaben erfüllst du die Voraussetzungen. Nimm Kontakt zu deiner Behörde auf.' : overall === 'y' ? 'Einige Punkte musst du noch erledigen oder klären. Die Hinweise unten zeigen, was zu tun ist.' : 'Mindestens eine Voraussetzung fehlt. Lass dich beraten – oft gibt es einen Weg.'}</p>${overall !== 'r' ? '<a class="btn small" href="#amt">Zu meiner Behörde</a>' : '<a class="btn small" href="#amt">Beratungsstellen</a>'}</div>` : ''}
    <h2 class="mt-l">Erfülle ich die Voraussetzungen?</h2>
    ${C.map((c, k) => { const sel = S.check[c.id]; const o = sel != null ? c.o[sel] : null;
      return `<div class="card"><div class="muted small">${k + 1} / ${C.length}</div><h3>${esc(c.q)}</h3>${ru(c.ru)}<div class="opts mt">${c.o.map((x, i) => `<button class="opt ${sel === i ? 'sel' : ''}" data-c="${c.id}" data-i="${i}" aria-pressed="${sel === i}"><span class="ampel ${['r', 'y', 'g'][x.v]}" aria-hidden="true"></span><span>${esc(x.t)}${ru(x.ru)}</span></button>`).join('')}</div>${o?.hint ? `<div class="tip mt">${esc(o.hint)}${ru(o.hru)}</div>` : ''}</div>`; }).join('')}`);
  if (part === 'fristen') document.getElementById('fristen').scrollIntoView();
  const again = () => keepScroll(() => check());
  $app.onchange = e => {
    const t = e.target;
    if (t.id === 'ein') { S.einreise = t.value; save(); again(); }
    else if (t.id === 'ehe') { S.ehe = t.checked; save(); again(); }
    else if (t.dataset.d != null) { F[+t.dataset.d].d = t.value; save(); again(); }
    else if (t.dataset.t != null) { F[+t.dataset.t].t = t.value; save(); }
  };
  $app.onclick = e => {
    const t = e.target.closest('[data-c],[data-act],[data-del]'); if (!t) return;
    if (t.dataset.c) { S.check[t.dataset.c] = +t.dataset.i; save(); again(); }
    else if (t.dataset.del != null) { F.splice(+t.dataset.del, 1); save(); again(); }
    else if (t.dataset.act === 'add') { F.push({ id: 'x' + Date.now(), t: 'Neues Dokument', d: '' }); save(); again(); }
    else if (t.dataset.act === 'ics') {
      const ev = [];
      F.filter(f => f.d).forEach(f => {
        const end = new Date(f.d + 'T00:00');
        [[180, '6 Monate'], [30, '1 Monat']].forEach(([d, l]) => { const st = new Date(end); st.setDate(st.getDate() - d); if (st > new Date()) ev.push({ title: `${f.t} läuft in ${l} ab`, desc: `Gültig bis ${fmtDate(end)}. Jetzt Verlängerung beantragen.`, start: st, alarm: 'PT9H' }); });
      });
      if (!ev.length) return toast('Alle Termine liegen schon in der Vergangenheit.');
      download('ablaufdaten.ics', icsFile(ev), 'text/calendar'); toast('Kalenderdatei erstellt – bitte öffnen und hinzufügen');
    }
  };
}
export function fristStatus(d) { if (!d) return null; const n = daysUntil(d); return n < 0 ? 'r' : n < 180 ? 'y' : 'g'; }
export function fristWarnings() {
  const w = (S.fristen || []).filter(f => ['r', 'y'].includes(fristStatus(f.d)));
  if (!w.length) return '';
  return `<a class="notice" href="#fristen" style="display:block;margin-top:14px;text-decoration:none;color:inherit">${w.map(f => { const n = daysUntil(f.d); return `<div><b>${esc(f.t)}</b> ${n < 0 ? 'ist abgelaufen!' : `läuft in ${n} Tagen ab (${fmtDate(new Date(f.d + 'T00:00'))}).`}</div>`; }).join('')}<div class="small mt-xs">Rechtzeitig verlängern – sonst kann sich das Verfahren verzögern. ›</div></a>`;
}
