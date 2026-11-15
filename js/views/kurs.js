// Deutschkurs A1–B1: Lektionen, Übungen, Vokabeltrainer, B1-Prüfung (DTZ)
import { $app, ABC, back, bar, esc, pct, shuffle, toast } from '../core.js';
import { D } from '../data.js';
import { dirAttr, hl, hlName, ru, ruSay, tr } from '../i18n.js';
import { keepScroll, onLeave, render } from '../router.js';
import { mic, say, speak, speakBtn, speakIcon } from '../speech.js';
import { S, activity, learned, save, srsGrade } from '../store.js';

export function kurs() {
  const lvls = ['A1', 'A2', 'B1'];
  const vokDue = D.vok.filter(v => S.vok[v.id] && S.vok[v.id].due <= Date.now()).length;
  const next = D.kurs.find(l => !S.kurs[l.id]?.done);
  render(`<h1>Deutschkurs A1 – B1</h1>
    <p class="muted">30 Lektionen mit Grammatik, Wortschatz (mit Sprachausgabe), Dialogen und Übungen – ${hl() ? `alle Erklärungen auch auf ${hlName()}` : 'mit einfachen Erklärungen'}. Ziel: das B1-Zertifikat für die Einbürgerung.${ru('ui.30-lessons-with-grammar-vocabulary-w')}</p>
    <div class="grid two mb-s">
      <a class="tile" href="#vokabeln"><h3>Vokabeltrainer</h3><div class="meta">${D.vok.length} Wörter · ${vokDue} heute fällig</div><span class="arrow">›</span></a>
      <a class="tile" href="#dtz"><h3>B1-Prüfung (DTZ) üben</h3><div class="meta">Hören, Lesen, Schreiben, Sprechen</div><span class="arrow">›</span></a>
    </div>
    ${next ? `<a class="btn primary block" style="margin:6px 0 4px" href="#lektion--${next.id}">Weiter mit ${next.lv}.${D.kurs.filter(l => l.lv === next.lv).indexOf(next) + 1}: ${esc(next.t)}</a>` : ''}
    ${lvls.map(lv => {
      const ls = D.kurs.filter(l => l.lv === lv); const d = ls.filter(l => S.kurs[l.id]?.done).length;
      return `<details class="level"><summary><span class="lv">Niveau ${lv}</span><span class="badge ${d === ls.length ? 'ok' : ''}">${d}/${ls.length}</span><span class="spacer"></span><span class="chev" aria-hidden="true">›</span></summary>
      <div class="grid two mt">${ls.map((l, k) => {
        const st = S.kurs[l.id];
        return `<a class="tile" href="#lektion--${l.id}"><div class="meta">${lv}.${k + 1}</div><h3>${esc(l.t)}</h3>${ru(l.ru)}<div class="meta mt-xs">${st?.done ? `<span class="badge ok">✓ geschafft · ${st.best}%</span>` : st ? `<span class="badge warn">${st.best}% – nochmal üben</span>` : esc(l.gr.t)}</div></a>`;
      }).join('')}</div></details>`;
    }).join('')}`);
}
export function lektion(id, tab = 'gr') {
  const l = D.kurs.find(x => x.id === id); if (!l) return kurs();
  const idx = D.kurs.indexOf(l), nxt = D.kurs[idx + 1];
  const tabs = [['gr', 'Grammatik'], ['vok', 'Wörter'], ['dia', 'Dialog'], ['ue', 'Übungen']];
  let body = '';
  if (tab === 'gr') body = `<div class="card"><h2>${esc(l.gr.t)}</h2>${ru(l.gr.ru)}<p class="mt">${esc(l.gr.de)} ${say(l.gr.de)}</p>${ruSay(l.gr.rde)}
      <h3 class="mt-l">Beispiele</h3><ul class="list">${l.gr.ex.map(e => `<li class="vok"><div>${esc(e[0])}${ru(e[1])}</div><div class="row nowrap">${speakBtn(e[0])}${mic(e[0])}</div></li>`).join('')}</ul></div>
      <div class="row end"><a class="btn primary" href="#lektion--${id}--vok">Weiter: Wörter ›</a></div>`;
  if (tab === 'vok') body = `<div class="card"><ul class="list">${l.vok.map(v => `<li class="vok"><div><b>${esc(v[0])}</b>${ru(v[1])}</div>${speakBtn(v[0].replace(/ –.*$/, ''))}${mic(v[0].replace(/ –.*$/, ''))}</li>`).join('')}</ul></div>
      <div class="row end"><a class="btn" href="#vokabeln--${id}">Als Karteikarten üben</a><a class="btn primary" href="#lektion--${id}--dia">Weiter: Dialog ›</a></div>`;
  if (tab === 'dia') body = `<div class="card dia"><div class="row mb"><button class="btn small" data-act="speakall">${speakIcon.replace('<svg', '<svg width="18" height="18" style="fill:none;stroke:currentColor;stroke-width:2"')} Ganzen Dialog anhören</button></div>
      ${l.dia.map(d => `<div class="vok mb"><p><b>${esc(d[0])}:</b> ${esc(d[1])}${ru(d[2])}</p><div class="row nowrap">${speakBtn(d[1])}${mic(d[1])}</div></div>`).join('')}</div>
      <div class="row end"><a class="btn primary" href="#lektion--${id}--ue">Weiter: Übungen ›</a></div>`;
  if (tab === 'ue') body = `<div id="ue"></div>`;
  render(`${back('#kurs', 'Kurs')}<div class="muted small">${l.lv} · Lektion ${idx + 1} von ${D.kurs.length}</div><h1>${esc(l.t)}</h1>${ru(l.ru)}
    <div class="tabs mt" role="tablist">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${n}</button>`).join('')}</div>${body}`);
  $app.onclick = e => {
    const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
    if (t.dataset.tab) location.hash = `#lektion--${id}--${t.dataset.tab}`;
    else if (t.dataset.act === 'speak') speak(t.dataset.t);
    else if (t.dataset.act === 'speakall') speak(l.dia.map(d => d[1]).join(' … '));
  };
  if (tab === 'ue') uebungen(l, nxt);
}
export function norm(s) { return String(s).toLowerCase().replace(/[.,!?;:„“"]/g, '').replace(/\s+/g, ' ').trim(); }
export function uebungen(l, nxt) {
  const box = document.getElementById('ue');
  const items = l.ue; let i = 0, score = 0;
  function show() {
    const u = items[i];
    let inner = '';
    if (u.k === 'mc') inner = `<div class="opts">${u.o.map((o, k) => `<button class="opt" data-ue="mc" data-i="${k}"><span class="k">${ABC[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    if (u.k === 'gap') inner = `<form data-ue="gap" autocomplete="off"><input class="text" name="a" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Antwort eingeben" aria-label="Antwort"><div class="row end mt"><button class="btn primary">Prüfen</button></div></form>`;
    if (u.k === 'order') { u._bank = shuffle(u.w.map((w, k) => ({ w, k }))); u._line = []; inner = `<div class="word-line" id="line" aria-label="Dein Satz"></div><div class="word-bank" id="bank"></div><div class="row end"><button class="btn" data-ue="reset">Zurücksetzen</button><button class="btn primary" data-ue="order">Prüfen</button></div>`; }
    box.innerHTML = `<div class="row mb"><div class="grow">${bar(pct(i, items.length))}</div><span class="small muted">${i + 1}/${items.length}</span></div>
      <div class="card"><div class="muted small mb-s">${u.k === 'mc' ? 'Wähle die richtige Antwort.' : u.k === 'gap' ? 'Ergänze die Lücke.' : 'Bilde einen Satz (Wörter antippen).'}${ru(u.k === 'mc' ? 'ui.choose-the-correct-answer' : u.k === 'gap' ? 'ui.fill-in-the-gap' : 'ui.build-a-sentence-tap-the-words')}</div>
      <div class="q-text">${esc(u.q || '')}</div>${inner}<div id="fb"></div></div>`;
    if (u.k === 'order') drawOrder(u);
    if (u.k === 'gap') box.querySelector('input').focus();
  }
  function drawOrder(u) {
    box.querySelector('#line').innerHTML = u._line.map((x, k) => `<button class="word" data-ue="un" data-i="${k}">${esc(x.w)}</button>`).join('');
    box.querySelector('#bank').innerHTML = u._bank.map((x, k) => `<button class="word" data-ue="put" data-i="${k}">${esc(x.w)}</button>`).join('');
  }
  function result(ok, solution) {
    if (ok) score++;
    activity();
    box.querySelectorAll('button.opt, input, [data-ue="order"], [data-ue="reset"], form button').forEach(b => b.disabled = true);
    box.querySelector('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? 'Richtig!' : 'Richtig wäre: ' + esc(solution)}</div><div class="row end mt"><button class="btn primary" data-ue="next">Weiter</button></div>`;
    box.querySelector('[data-ue="next"]').focus();
  }
  box.onclick = e => {
    const t = e.target.closest('[data-ue]'); if (!t || t.disabled) return;
    const u = items[i], a = t.dataset.ue;
    if (a === 'mc') { const k = +t.dataset.i; t.classList.add(k === u.a ? 'right' : 'wrong'); box.querySelectorAll('.opt')[u.a].classList.add('right'); result(k === u.a, u.o[u.a]); }
    if (a === 'put') { u._line.push(u._bank.splice(+t.dataset.i, 1)[0]); drawOrder(u); }
    if (a === 'un') { u._bank.push(u._line.splice(+t.dataset.i, 1)[0]); drawOrder(u); }
    if (a === 'reset') { u._bank = shuffle(u.w.map((w, k) => ({ w, k }))); u._line = []; drawOrder(u); }
    if (a === 'order') { if (u._bank.length) return toast('Bitte alle Wörter verwenden.'); const s = u._line.map(x => x.w).join(' '); result([u.a, ...(u.alt || [])].some(x => norm(x) === norm(s)), u.a + '.'); }
    if (a === 'next') { i++; i < items.length ? show() : finish(); }
  };
  box.onsubmit = e => { e.preventDefault(); const u = items[i]; const v = e.target.a.value; if (!v.trim()) return; result([u.a, ...(u.alt || [])].some(x => norm(x) === norm(v)), u.a); };
  function finish() {
    const p = pct(score, items.length), prev = S.kurs[l.id];
    S.kurs[l.id] = { done: p >= 70 || !!prev?.done, best: Math.max(p, prev?.best || 0) }; save();
    box.innerHTML = `<div class="card center"><div class="stat" style="font-size:2.6em">${score}/${items.length}</div>
      <p>${p >= 70 ? '<span class="badge ok">Lektion geschafft!</span>' : '<span class="badge warn">Ab 70 % gilt die Lektion als geschafft.</span>'}</p>
      <div class="row center-x"><button class="btn" data-ue="again">Nochmal</button>${nxt ? `<a class="btn primary" href="#lektion--${nxt.id}">Nächste Lektion ›</a>` : `<a class="btn primary" href="#dtz">Zur B1-Prüfung ›</a>`}</div></div>`;
    box.onclick = e => { if (e.target.closest('[data-ue="again"]')) uebungen(l, nxt); };
  }
  show();
}
export function vokabeln(lessonId) {
  let pool = lessonId ? D.vok.filter(v => v.lesson === lessonId) : null;
  if (!pool) {
    const now = Date.now();
    const unlocked = new Set(D.kurs.filter((l, k) => k === 0 || S.kurs[l.id] || S.kurs[D.kurs[k - 1].id]?.done).map(l => l.id));
    const due = D.vok.filter(v => S.vok[v.id] && S.vok[v.id].due <= now);
    const neu = D.vok.filter(v => !S.vok[v.id] && unlocked.has(v.lesson));
    pool = [...due, ...neu].slice(0, 20);
  } else pool = shuffle(pool);
  const total = D.vok.length, L = learned(S.vok, D.vok.map(v => v.id));
  if (!pool.length) { render(`${back('#kurs', 'Kurs')}<h1>Vokabeltrainer</h1><div class="card"><p>Heute ist nichts fällig. Bearbeite eine neue Lektion, dann kommen neue Wörter dazu.</p><p class="muted">${L} von ${total} Wörtern sicher gelernt.</p></div>`); return; }
  let i = 0, flipped = false, dir = 'de';
  const H = hl();
  function show() {
    const v = pool[i], tv = H ? tr(v.ru) : '';
    // „Nur Deutsch“: Karte zeigt das Wort, Rückseite übt Aussprache und Bedeutung selbst einschätzen
    if (!H || !tv) dir = 'de';
    const front = dir === 'de' ? `<div>${esc(v.de)}</div>` : `<div lang="${H}"${dirAttr(H)}>${esc(tv)}</div>`;
    const backSide = !flipped ? '<div class="small muted">Antippen zum Umdrehen</div>'
      : dir === 'de' ? (tv ? `<div class="ru" lang="${H}"${dirAttr(H)} style="display:block">${esc(tv)}</div>` : '<div class="small muted">Weißt du, was das Wort bedeutet? Sprich es laut nach.</div>')
      : `<div style="color:var(--brand)">${esc(v.de)}</div>`;
    render(`${back(lessonId ? '#lektion--' + lessonId + '--vok' : '#kurs', 'Zurück')}<h1>Vokabeltrainer</h1>
      ${H ? `<div class="chips"><button class="chip ${dir === 'de' ? 'on' : ''}" data-dir="de">Deutsch → ${hlName()}</button><button class="chip ${dir !== 'de' ? 'on' : ''}" data-dir="${H}">${hlName()} → Deutsch</button></div>` : ''}
      <div class="row mb"><div class="grow">${bar(pct(i, pool.length))}</div><span class="small muted">${i + 1}/${pool.length}</span></div>
      <div class="card flash" data-act="flip" role="button" tabindex="0" aria-label="Karte umdrehen">
        ${front}
        ${backSide}
      </div>
      <div class="row center-x">${speakBtn(v.de.replace(/ –.*$/, ''))}${mic(v.de.replace(/ –.*$/, ''))}</div>
      ${flipped ? `<div class="grid two mt"><button class="btn" data-act="no">Noch nicht gewusst</button><button class="btn primary" data-act="yes">Gewusst</button></div>` : ''}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act],[data-dir]'); if (!t) return;
    if (t.dataset.dir) { dir = t.dataset.dir; flipped = false; return show(); }
    const a = t.dataset.act;
    if (a === 'flip') { flipped = !flipped; if (flipped && dir !== 'de') speak(pool[i].de); show(); $app.querySelector(flipped ? '[data-act="yes"]' : '.flash')?.focus({ preventScroll: true }); }
    else if (a === 'speak') speak(t.dataset.t);
    else if (a === 'yes' || a === 'no') {
      srsGrade(S.vok, pool[i].id, a === 'yes'); activity();
      if (a === 'no') pool.push(pool[i]);
      i++; flipped = false;
      if (i >= pool.length) render(`${back('#kurs', 'Kurs')}<div class="card"><h2>Fertig für jetzt!</h2><p>${learned(S.vok, D.vok.map(v => v.id))} von ${total} Wörtern sicher gelernt.</p><a class="btn primary" href="#kurs">Zum Kurs</a></div>`);
      else show();
    }
  };
  show();
}
export function dtz(part, id) {
  if (part === 'schreiben' && id) {
    const w = D.dtz.schreiben.find(x => x.id === id); if (!w) return dtz();
    // Entwürfe gehören zum Profil (und damit in die Sicherung); alte Ablage eb.draft.* einmalig übernehmen
    if (S.drafts[id] == null) { try { const old = localStorage.getItem('eb.draft.' + id); if (old) { S.drafts[id] = old; save(); localStorage.removeItem('eb.draft.' + id); } } catch {} }
    const draft = S.drafts[id] || '';
    render(`${back('#dtz', 'B1-Prüfung')}<h1>${esc(w.t)}</h1>${ru(w.ru)}
      <div class="card"><p>${esc(w.sit)}</p><p class="small muted">Schreiben Sie zu allen vier Punkten (ca. 30 Minuten):</p><ul>${w.p.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <label class="lbl" for="txt">Dein Text</label><textarea id="txt" class="text" spellcheck="true" lang="de">${esc(draft)}</textarea>
      <div class="row" style="margin:10px 0 18px"><span class="small muted" id="wc"></span><span class="spacer"></span><button class="btn" data-act="muster">Musterlösung zeigen</button></div>
      <div id="muster"></div>`);
    const ta = document.getElementById('txt'), wc = document.getElementById('wc');
    let st = null;
    const count = () => { wc.textContent = `${(ta.value.match(/\S+/g) || []).length} Wörter (Ziel: ca. 80–120)`; };
    ta.oninput = () => { count(); S.drafts[id] = ta.value; clearTimeout(st); st = setTimeout(save, 500); };
    count();
    $app.onclick = e => { if (e.target.closest('[data-act="muster"]')) document.getElementById('muster').innerHTML = `<h2>Musterlösung</h2><pre class="letter">${esc(w.muster)}</pre><div class="notice ok">Prüfe deinen Text: Anrede? Alle 4 Punkte? Konnektoren (deshalb, außerdem …)? Schluss und Gruß?</div>`; };
    onLeave(() => { clearTimeout(st); save(); });
    return;
  }
  if ((part === 'hoeren' || part === 'lesen') && id) return dtzAufgabe(part, id);
  const done = S.dtzDone || {};
  const tiles = (arr, part, meta) => arr.map(x => `<a class="tile" href="#dtz--${part}--${x.id}"><h3>${esc(x.t)}</h3>${ru(x.ru)}<div class="meta">${done[x.id] != null ? `<span class="badge ${done[x.id] === x.q.length ? 'ok' : 'warn'}">${done[x.id]}/${x.q.length} richtig</span>` : meta}</div><span class="arrow">›</span></a>`).join('');
  render(`${back('#kurs', 'Kurs')}<h1>B1-Prüfung (DTZ)</h1><p>${esc(D.dtz.info.de)}</p>${ruSay(D.dtz.info.ru)}
    <h2 class="mt-xl">Hören</h2>${ru('ui.listening')}<div class="grid two mt-s">${tiles(D.dtz.hoeren, 'hoeren', 'Anhören und Fragen beantworten')}</div>
    <h2 class="mt-xl">Lesen</h2>${ru('ui.reading')}<div class="grid two mt-s">${tiles(D.dtz.lesen, 'lesen', 'Text lesen und Fragen beantworten')}</div>
    <h2 class="mt-xl">Schreiben</h2><div class="grid two">${D.dtz.schreiben.map(w => `<a class="tile" href="#dtz--schreiben--${w.id}"><h3>${esc(w.t)}</h3>${ru(w.ru)}<div class="meta">4 Leitpunkte · mit Musterlösung</div><span class="arrow">›</span></a>`).join('')}</div>
    <h2 class="mt-xl">Sprechen</h2>
    ${D.dtz.sprechen.map(s => `<div class="card"><h3>${esc(s.t)}</h3>${ru(s.ru)}<ul class="list mt-s">${s.fragen.map(f => `<li class="vok"><span>${esc(f)}</span>${speakBtn(f)}</li>`).join('')}</ul></div>`).join('')}
    <div class="notice">Tipp: Nimm deine Antworten mit dem Handy auf und hör sie dir an. Sprich in ganzen Sätzen und benutze weil, deshalb, außerdem.</div>`);
  $app.onclick = e => { const t = e.target.closest('[data-act="speak"]'); if (t) speak(t.dataset.t); };
}
export function dtzAufgabe(part, id) {
  const x = D.dtz[part].find(y => y.id === id); if (!x) return dtz();
  const ans = Array(x.q.length).fill(null);
  let showText = part === 'lesen', plays = 0;
  function draw() {
    const checked = ans.every(a => a !== null);
    render(`${back('#dtz', 'B1-Prüfung')}<div class="muted small">${part === 'hoeren' ? 'Hören' : 'Lesen'}</div><h1>${esc(x.t)}</h1>${ru(x.ru)}
      <div class="card">
        ${part === 'hoeren' ? `<div class="row"><button class="btn primary" data-act="play">${speakIcon.replace('<svg', '<svg width="20" height="20" style="fill:none;stroke:currentColor;stroke-width:2"')} ${plays ? 'Nochmal hören' : 'Anhören'}</button><button class="btn small ghost" data-act="text">${showText ? 'Text ausblenden' : 'Text anzeigen'}</button></div><p class="small muted mt-s">In der Prüfung hörst du jeden Text einmal oder zweimal. Versuche es erst ohne Text.</p>` : ''}
        ${showText ? `<pre class="letter mt">${esc(x.text)}</pre>` : ''}
      </div>
      ${x.q.map((q, k) => `<div class="card"><div class="q-text fs-1">${k + 1}. ${esc(q.q)}</div><div class="opts">${q.o.map((o, i) => {
        let cls = ''; if (ans[k] !== null) { if (i === q.a) cls = 'right'; else if (i === ans[k]) cls = 'wrong'; }
        return `<button class="opt ${cls}" data-q="${k}" data-i="${i}" ${ans[k] !== null ? 'disabled' : ''}><span class="k">${ABC[i]}</span><span>${esc(o)}</span></button>`; }).join('')}</div></div>`).join('')}
      ${checked ? `<div class="feedback ${ans.every((a, k) => a === x.q[k].a) ? 'ok' : 'bad'}">${ans.filter((a, k) => a === x.q[k].a).length} von ${x.q.length} richtig</div><div class="row end mt"><a class="btn primary" href="#dtz">Zur Übersicht</a></div>` : ''}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act],[data-q]'); if (!t) return;
    if (t.dataset.act === 'play') { plays++; speak(x.text); draw(); }
    else if (t.dataset.act === 'text') { showText = !showText; draw(); }
    else if (t.dataset.q != null) {
      ans[+t.dataset.q] = +t.dataset.i; activity();
      if (ans.every(a => a !== null)) { S.dtzDone = S.dtzDone || {}; S.dtzDone[x.id] = ans.filter((a, k) => a === x.q[k].a).length; save(); }
      keepScroll(draw);
    }
  };
  draw();
}
