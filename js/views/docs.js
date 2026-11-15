// Unterlagen mit Reitern: Checkliste, Mitbringen, Kosten, Briefe
import { $app, EMBED, bar, esc, pct, toast } from '../core.js';
import { D } from '../data.js';
import { ru } from '../i18n.js';
import { render } from '../router.js';
import { S, save } from '../store.js';

export const PERSONAS = [['angestellt', 'Angestellt'], ['selbst', 'Selbständig'], ['studium', 'Studium/Ausbildung'], ['rente', 'Rente'], ['fluechtling', 'Flüchtling/Staatenlos']];
export const DOC_TABS = [['docs', 'Checkliste'], ['termine', 'Mitbringen'], ['kosten', 'Kosten'], ['briefe', 'Briefe']];
export const docsTabs = cur => `<nav class="tabs no-print" aria-label="Unterlagen">${DOC_TABS.map(([k, n]) => `<a href="#${k === 'docs' ? 'docs' : 'docs--' + k}" class="${k === cur ? 'on' : ''}" ${k === cur ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
export function visibleDocs() { return D.info.docs.filter(g => !g.persona || S.persona.includes(g.persona)); }
export function docs(tab) {
  if (tab === 'termine') return termine();
  if (tab === 'kosten') return kosten();
  if (tab === 'briefe') return briefe();
  const groups = visibleDocs();
  const all = groups.flatMap(g => g.items), done = all.filter(i => S.docs[i.id]).length;
  const myAmt = S.amt && D.amt.behoerden.find(b => b.id === S.amt);
  render(`<h1>Unterlagen</h1>${docsTabs('docs')}
    <p class="muted">Welche Unterlagen genau nötig sind, legt deine Behörde fest. Diese Liste zeigt, was typischerweise verlangt wird.${ru('ui.your-authority-decides-exactly-which')}</p>
    ${myAmt?.downloads ? `<div class="notice ok"><b>${esc(myAmt.name)}:</b> ${myAmt.downloads.map(d => `<a href="${d.url}" target="_blank" rel="noopener">${esc(d.t)}</a>`).join(', ')}${myAmt.hinweis ? `<div class="small mt-xs">${esc(myAmt.hinweis)}</div>` : ''}</div>` : `<div class="notice">Wähle unter <a href="#amt">Behörden</a> deinen Wohnort – dann siehst du hier die Hinweise deiner Behörde.</div>`}
    <div class="card no-print"><b>Meine Situation</b>${ru('ui.my-situation')}<div class="chips mt">${PERSONAS.map(([k, n]) => `<button class="chip ${S.persona.includes(k) ? 'on' : ''}" data-p="${k}">${n}</button>`).join('')}</div></div>
    <div class="card"><div class="row"><b>${done} von ${all.length} erledigt</b><span class="spacer"></span>${EMBED ? '' : '<button class="btn small no-print" data-act="print">Drucken / PDF</button>'}</div><div class="mt-s">${bar(pct(done, all.length))}</div></div>
    ${groups.map(g => `<div class="card"><h2>${esc(g.g)}</h2>${ru(g.gru)}<ul class="list">${g.items.map(it => `<li><label class="check ${S.docs[it.id] ? 'done' : ''}"><input type="checkbox" data-doc="${it.id}" ${S.docs[it.id] ? 'checked' : ''}><div><span class="t">${esc(it.t)}</span>${ru(it.ru)}${it.tip ? `<div class="tip">${esc(it.tip)}${ru(it.tru)}</div>` : ''}</div></label></li>`).join('')}</ul></div>`).join('')}
    <p class="small muted">Tipp: Kopien ins Antragsformular nur, wenn die Behörde es verlangt. Fremdsprachige Urkunden immer mit Übersetzung von beeidigten Übersetzer:innen.</p>`);
  $app.onchange = e => { const c = e.target.closest('[data-doc]'); if (c) { S.docs[c.dataset.doc] = c.checked; save(); c.closest('.check').classList.toggle('done', c.checked); const n = all.filter(i => S.docs[i.id]).length; $app.querySelector('.card .row b').textContent = `${n} von ${all.length} erledigt`; $app.querySelector('.card .progress i').style.width = pct(n, all.length) + '%'; } };
  $app.onclick = e => {
    const p = e.target.closest('[data-p]');
    if (p) { const k = p.dataset.p; S.persona = S.persona.includes(k) ? S.persona.filter(x => x !== k) : [...S.persona, k]; save(); docs(); }
    if (e.target.closest('[data-act="print"]')) window.print();
  };
}
export function briefe() {
  render(`<h1>Unterlagen</h1>${docsTabs('briefe')}<h2>Briefvorlagen</h2><p class="muted">Für E-Mails und Briefe an die Behörde. Ersetze die Angaben in [eckigen Klammern].${ru('ui.for-emails-and-letters-to-the-author')}</p>
    ${D.info.briefe.map(b => `<div class="card"><h2>${esc(b.t)}</h2>${ru(b.ru)}<pre class="letter mt">${esc(b.text)}</pre><div class="row"><button class="btn small" data-copy="${b.id}">Kopieren</button>${S.amt && D.amt.behoerden.find(x => x.id === S.amt)?.mail ? `<a class="btn small" href="mailto:${esc(D.amt.behoerden.find(x => x.id === S.amt).mail)}?subject=${encodeURIComponent(b.t)}&body=${encodeURIComponent(b.text)}">Als E-Mail an meine Behörde</a>` : ''}</div></div>`).join('')}`);
  $app.onclick = async e => {
    const t = e.target.closest('[data-copy]'); if (!t) return;
    const b = D.info.briefe.find(x => x.id === t.dataset.copy);
    try { await navigator.clipboard.writeText(b.text); toast('Kopiert'); } catch { toast('Kopieren nicht möglich – bitte Text markieren.'); }
  };
}
export function termine() {
  render(`<h1>Unterlagen</h1>${docsTabs('termine')}<h2>Was muss ich mitbringen?</h2><p class="muted">Abhakbare Listen für deine Termine. Verbindlich ist immer, was in deiner Einladung steht.${ru('ui.checklists-for-your-appointments-wha')}</p>
    ${D.info.termine.map(T => { const done = T.items.filter((_, k) => S.term[`${T.id}:${k}`]).length;
      return `<details class="level" ${done && done < T.items.length ? 'open' : ''}><summary><span class="lv">${esc(T.t)}</span><span class="badge ${done === T.items.length ? 'ok' : ''}">${done}/${T.items.length}</span><span class="spacer"></span><span class="chev">›</span></summary>${ru(T.ru)}
      <ul class="list mt-s">${T.items.map(([t, r], k) => { const id = `${T.id}:${k}`; return `<li><label class="check ${S.term[id] ? 'done' : ''}"><input type="checkbox" data-term="${id}" ${S.term[id] ? 'checked' : ''}><div><span class="t">${esc(t)}</span>${ru(r)}</div></label></li>`; }).join('')}</ul>
      <button class="btn small ghost" data-reset="${T.id}">Liste zurücksetzen</button></details>`; }).join('')}`);
  $app.onchange = e => { const c = e.target.closest('[data-term]'); if (c) { S.term[c.dataset.term] = c.checked; save(); c.closest('.check').classList.toggle('done', c.checked); } };
  $app.onclick = e => { const r = e.target.closest('[data-reset]'); if (r) { Object.keys(S.term).filter(k => k.startsWith(r.dataset.reset + ':')).forEach(k => delete S.term[k]); save(); termine(); } };
}
export function kosten() {
  const K = S.kosten = Object.assign({ erw: 1, kind: 0, kindAllein: 0, testPers: 1, testPreis: 25, b1Pers: 1, b1Preis: 150, uebers: 3, uebersPreis: 50, apost: 0, apostPreis: 0, sonst: 0 }, S.kosten || {});
  const rows = () => [
    ['Einbürgerung Erwachsene', K.erw, 255, 'gesetzlich (§ 38 StAG)'],
    ['Kinder, mit den Eltern eingebürgert, ohne Einkommen', K.kind, 51, 'gesetzlich'],
    ['Minderjährige, allein eingebürgert', K.kindAllein, 255, 'gesetzlich'],
    ['Einbürgerungstest', K.testPers, K.testPreis, 'bei der VHS'],
    ['B1-Sprachprüfung', K.b1Pers, K.b1Preis, 'je nach Anbieter'],
    ['Beglaubigte Übersetzungen (Urkunden)', K.uebers, K.uebersPreis, 'Schätzwert'],
    ['Apostille / Legalisation', K.apost, K.apostPreis, 'je nach Land'],
    ['Sonstiges (Fotos, Porto, Fahrten …)', 1, K.sonst, '']];
  const sum = () => rows().reduce((s, r) => s + r[1] * r[2], 0);
  const num = (k, label, step = 1) => `<div><label class="lbl small" for="k-${k}">${label}</label><input class="text" type="number" inputmode="decimal" min="0" step="${step}" id="k-${k}" data-k="${k}" value="${esc(K[k])}"></div>`;
  render(`<h1>Unterlagen</h1>${docsTabs('kosten')}<h2>Kostenrechner</h2><p class="muted">Was kostet die Einbürgerung für deine Familie? Die Gebühren der Behörde sind gesetzlich festgelegt, alles andere sind Schätzwerte – trage deine echten Preise ein.${ru('ui.how-much-does-naturalisation-cost-fo')}</p>
    <div class="card"><h2>Personen</h2><div class="grid three">${num('erw', 'Erwachsene (ab 16)')}${num('kind', 'Kinder mit Eltern')}${num('kindAllein', 'Kinder allein')}</div></div>
    <div class="card"><h2>Prüfungen</h2><div class="grid two">${num('testPers', 'Personen Einbürgerungstest')}${num('testPreis', 'Preis Test (€)')}${num('b1Pers', 'Personen B1-Prüfung')}${num('b1Preis', 'Preis B1-Prüfung (€)', 5)}</div>
      <p class="small muted">Wer einen deutschen Schulabschluss hat, braucht weder Test noch Sprachprüfung. Im Integrationskurs ist die Prüfung oft schon enthalten.</p></div>
    <div class="card"><h2>Unterlagen</h2><div class="grid two">${num('uebers', 'Anzahl Übersetzungen')}${num('uebersPreis', 'Preis pro Übersetzung (€)', 5)}${num('apost', 'Anzahl Apostillen')}${num('apostPreis', 'Preis pro Apostille (€)', 5)}${num('sonst', 'Sonstiges gesamt (€)', 5)}</div></div>
    <div class="card" id="sum"></div>
    <p class="small muted">Bei geringem Einkommen kann die Behörde die Gebühr ermäßigen oder Ratenzahlung erlauben. Die Gebühr für die Einbürgerung wird meist erst mit dem Gebührenbescheid fällig. Nach der Einbürgerung kommen noch Personalausweis und Reisepass dazu (Gebühren beim Bürgerbüro).</p>`);
  const drawSum = () => {
    document.getElementById('sum').innerHTML = `<h2>Übersicht</h2><div class="scroll-x"><table class="tbl"><tbody>${rows().filter(r => r[1] * r[2] > 0).map(r => `<tr><td>${esc(r[0])}<div class="small muted">${r[0].startsWith('Sonstiges') ? '' : `${r[1]} × ${r[2]} € · `}${esc(r[3])}</div></td><td class="num">${(r[1] * r[2]).toLocaleString('de-DE')} €</td></tr>`).join('')}</tbody><tfoot><tr><td><b>Gesamt</b></td><td class="num"><b>${sum().toLocaleString('de-DE')} €</b></td></tr></tfoot></table></div>`;
  };
  $app.oninput = e => { const k = e.target.dataset.k; if (k) { K[k] = Math.max(0, parseFloat(e.target.value) || 0); if (k === 'erw') { K.testPers = K.erw; K.b1Pers = K.erw; document.getElementById('k-testPers').value = K.erw; document.getElementById('k-b1Pers').value = K.erw; } save(); drawSum(); } };
  drawSum();
}
