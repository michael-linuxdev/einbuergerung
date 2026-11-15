// Behörden & Kontakte
import { $app, esc, toast } from '../core.js';
import { D } from '../data.js';
import { ru } from '../i18n.js';
import { render } from '../router.js';
import { S, save } from '../store.js';

export function findAmt(term) {
  const t = term.trim().toLowerCase(); if (!t) return [];
  const plz = /^\d{5}$/.test(t) ? +t : null;
  return D.amt.behoerden.filter(b => (plz && b.plz?.some(([a, z]) => plz >= a && plz <= z)) || b.name.toLowerCase().includes(t) || b.orte.some(o => o.toLowerCase().startsWith(t)));
}
export const tel = n => `<a href="tel:${n.replace(/[^\d+]/g, '')}">${esc(n)}</a>`;
export function amtCard(b, full = true) {
  const verified = b.stand?.startsWith('geprüft');
  return `<div class="card">
    <div class="row"><h2 class="m-0">${esc(b.name)}</h2><span class="spacer"></span>${verified ? `<span class="badge ok">${esc(b.stand)}</span>` : '<span class="badge">Kontakt über Amt24 prüfen</span>'}</div>
    <p class="muted small mt-xs">${esc(b.art)}</p>
    <dl class="kv">
      ${b.adresse ? `<dt>Adresse</dt><dd>${esc(b.adresse)}</dd>` : `<dt>Sitz</dt><dd>${esc(b.sitz)}</dd>`}
      ${b.post ? `<dt>Post</dt><dd>${esc(b.post)}</dd>` : ''}
      ${b.tel ? `<dt>Telefon</dt><dd>${(Array.isArray(b.tel) ? b.tel : [b.tel]).map(tel).join('<br>')}${b.telZentrale ? `<br><span class="small muted">Zentrale: ${tel(b.telZentrale)}</span>` : ''}</dd>` : ''}
      ${b.mail ? `<dt>E-Mail</dt><dd><a href="mailto:${esc(b.mail)}">${esc(b.mail)}</a></dd>` : ''}
      ${b.zeiten ? `<dt>Zeiten</dt><dd>${esc(b.zeiten)}</dd>` : ''}
      <dt>Web</dt><dd><a href="${esc(b.web)}" target="_blank" rel="noopener">${esc(b.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd>
      ${b.aussen ? `<dt>Außenstellen</dt><dd>${b.aussen.map(esc).join('<br>')}</dd>` : ''}
    </dl>
    ${b.hinweis ? `<div class="notice mt">${esc(b.hinweis)}${ru(b.hru)}</div>` : ''}
    ${b.downloads ? `<div class="row mt">${b.downloads.map(d => `<a class="btn small" href="${esc(d.url)}" target="_blank" rel="noopener">⬇ ${esc(d.t)}</a>`).join('')}</div>` : ''}
    ${!verified ? `<div class="row mt"><a class="btn small" href="${esc(D.amt.amt24)}" target="_blank" rel="noopener">Genaue Kontaktdaten auf Amt24</a></div>` : ''}
    ${full && b.extra ? `<h3 class="mt-l">Weitere Kontakte vor Ort</h3><ul class="list">${b.extra.map(x => `<li><b>${esc(x.name)}</b><div class="small">${esc(x.adresse)}${x.tel ? ' · ' + tel(x.tel) : ''}${x.mail ? ` · <a href="mailto:${esc(x.mail)}">${esc(x.mail)}</a>` : ''}${x.zeiten ? '<br>' + esc(x.zeiten) : ''}<br><a href="${esc(x.web)}" target="_blank" rel="noopener">${esc(x.web.replace(/^https?:\/\/(www\.)?/, ''))}</a></div></li>`).join('')}</ul>` : ''}
  </div>`;
}
export function amt() {
  const mine = S.amt && D.amt.behoerden.find(b => b.id === S.amt);
  render(`<h1>Behörden & Kontakte</h1>
    <div class="notice">Diese App ist eine private Lernhilfe und keine Behörde. Anträge stellst du direkt bei der zuständigen Stelle.</div>
    <p class="muted">${esc(D.amt.regel)}${ru('ui.in-chemnitz-dresden-and-leipzig-the')}</p>
    <label class="lbl" for="ort">Wohnort oder Postleitzahl</label>
    <input class="text" id="ort" type="search" placeholder="z. B. Freital, Pirna oder 01705" autocomplete="address-level2">
    <div class="chips mt">${['Freital', 'Pirna', 'Dresden', 'Leipzig', 'Chemnitz'].map(o => `<button class="chip" data-ort="${o}">${o}</button>`).join('')}</div>
    <div id="treffer" class="mt"></div>
    ${mine ? `<h2 class="mt-l">Meine Behörde</h2>${amtCard(mine)}<button class="btn small ghost" data-act="forget">Andere Behörde wählen</button>` : ''}
    <h2 class="mt-xl">Beratung, Tests und Kurse</h2>
    ${D.info.kontakte.map(g => `<div class="card"><h3>${esc(g.g)}</h3><ul class="list">${g.items.map(k => `<li><b>${k.web ? `<a href="${esc(k.web)}" target="_blank" rel="noopener">${esc(k.name)}</a>` : `<a href="#${k.go}">${esc(k.name)}</a>`}</b><div class="small">${esc(k.d)}</div>${ru(k.dru)}</li>`).join('')}</ul></div>`).join('')}
    <h2 class="mt-xl">Alle Einbürgerungsbehörden in Sachsen</h2>
    <div class="card"><ul class="list">${D.amt.behoerden.map(b => `<li class="row"><div class="grow"><b>${esc(b.name)}</b><div class="small muted">${esc(b.sitz)} · u. a. ${b.orte.slice(0, 4).map(esc).join(', ')}</div></div><button class="btn small" data-amt="${b.id}">Wählen</button></li>`).join('')}</ul></div>
    <p class="small muted">Weitere Bundesländer folgen. Fehler gefunden? Bitte melden – Kontaktdaten ändern sich manchmal.</p>`);
  const inp = document.getElementById('ort'), out = document.getElementById('treffer');
  inp.oninput = () => {
    const r = findAmt(inp.value);
    out.innerHTML = !inp.value.trim() ? '' : r.length ? r.map(b => `${amtCard(b)}<button class="btn primary" data-amt="${b.id}" style="margin:-4px 0 14px">Als meine Behörde speichern</button>`).join('') : `<div class="notice">Ort nicht gefunden. Liegt er nicht in Chemnitz, Dresden oder Leipzig, ist das Landratsamt deines Landkreises zuständig. Sicher findest du es auf <a href="${esc(D.amt.amt24)}" target="_blank" rel="noopener">Amt24</a> unter „Zuständige Stelle“.</div>`;
  };
  $app.onclick = e => {
    const o = e.target.closest('[data-ort]'); if (o) { inp.value = o.dataset.ort; inp.oninput(); return; }
    const t = e.target.closest('[data-amt],[data-act="forget"]'); if (!t) return;
    if (t.dataset.amt) { S.amt = t.dataset.amt; save(); toast('Behörde gespeichert'); amt(); }
    else { S.amt = null; save(); amt(); }
  };
}
