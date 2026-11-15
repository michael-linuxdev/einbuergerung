// Einbürgerungstest: Lernen, Prüfung, Katalog, Statistik, Audio-Modus, Wörterbuch, Erfolgsbild
import { $app, ABC, APP_URL, EMBED, back, bar, download, esc, fmtDate, pct, shuffle } from '../core.js';
import { D } from '../data.js';
import { LANG, dirAttr, hl, hlName, ru, ruRaw, ruSay, tr } from '../i18n.js';
import { confirmTap, onLeave, render } from '../router.js';
import { chunks, say, speak, speakBtn, voiceFor } from '../speech.js';
import { S, activity, learned, profileName, save, srsGrade, statAdd } from '../store.js';

export function test() {
  const ids = D.q.map(q => q.id);
  const now = Date.now();
  const due = D.q.filter(q => S.srs[q.id] && S.srs[q.id].due <= now).length;
  const neu = D.q.filter(q => !S.srs[q.id]).length;
  const L = learned(S.srs, ids);
  const wrong = Object.keys(S.wrong).filter(k => S.wrong[k]).length;
  const last = S.exams.slice(-5).reverse();
  render(`
    <h1>Einbürgerungstest</h1>
    <p class="muted">33 Fragen in 60 Minuten: 30 aus 300 allgemeinen + 3 aus 10 Sachsen-Fragen. Bestanden ab 17 richtigen. Gebühr 25 € bei der Volkshochschule.${ru('ui.33-questions-in-60-minutes-30-out-of')}</p>
    <div class="card"><div class="row"><div><div class="stat">${L} / 310</div><div class="muted small">sicher gelernt (Stufe 4+)</div></div><div class="spacer"></div><span class="badge brand">${due} fällig</span><span class="badge">${neu} neu</span></div><div class="mt">${bar(pct(L, 310))}</div></div>
    <div class="grid two">
      <a class="tile" href="#lernen"><h3>Lernen</h3>${ru('ui.learn')}<div class="meta">Bis zu 20 Fragen: erst fällige Wiederholungen, dann neue. Falsche kommen wieder.</div><span class="arrow">›</span></a>
      <a class="tile" href="#pruefung"><h3>Prüfung simulieren</h3>${ru('ui.practice-exam')}<div class="meta">Wie im echten Test: 33 Fragen, 60 Minuten, Auswertung am Ende.</div><span class="arrow">›</span></a>
      <a class="tile" href="#lernen--fehler"><h3>Meine Fehler</h3>${ru('ui.my-mistakes')}<div class="meta">${wrong} Fragen zuletzt falsch beantwortet.</div><span class="arrow">›</span></a>
      <a class="tile" href="#audio"><h3>Audio-Modus</h3>${ru('ui.audio-mode')}<div class="meta">Fragen und Antworten vorlesen lassen – für unterwegs.</div><span class="arrow">›</span></a>
      <a class="tile" href="#glossar"><h3>Wörterbuch</h3>${ru('ui.dictionary')}<div class="meta">${D.glossar.length} schwierige Begriffe${hl() ? ` mit ${LANG[hl()].adj}r Erklärung` : ', einfach erklärt'}.</div><span class="arrow">›</span></a>
      <a class="tile" href="#katalog"><h3>Alle 310 Fragen</h3>${ru('ui.all-310-questions')}<div class="meta">Katalog mit Lösungen, Suche und Themenfilter.</div><span class="arrow">›</span></a>
    </div>
    <div class="mt">${statsCard()}</div>
    ${last.length ? `<h2 class="mt-xl">Letzte Simulationen</h2><div class="card"><ul class="list">${last.map(e => `<li class="row"><span>${fmtDate(e.date)}</span><span class="spacer"></span><b>${e.score}/${e.total}</b> <span class="badge ${e.score >= 17 ? 'ok' : 'bad'}">${e.score >= 17 ? 'bestanden' : 'nicht bestanden'}</span></li>`).join('')}</ul></div>` : ''}
  `);
}
export function qCard(q, { idx, total, sel = null, reveal = false, mode = '' } = {}) {
  const ruOpts = q.ruo || [];
  return `
    <div class="card">
      <div class="q-head"><span>${q.id.startsWith('SN') ? 'Sachsen' : 'Frage'} ${q.n}${q.t && q.t !== 'Sachsen' ? ' · ' + esc(q.t) : ''}</span>${idx != null ? `<span>${idx + 1} / ${total}</span>` : ''}</div>
      <div class="q-text">${gloss(esc(q.q))} ${say(q.q + ' … ' + q.o.map((o, i) => ABC[i] + ': ' + o).join('. '))}${tr(q.ru) && hl() ? `<span class="ru" lang="${hl()}"${dirAttr(hl())}>${esc(tr(q.ru))} ${say(tr(q.ru) + ' … ' + (q.ruo || []).map((o, i) => ABC[i] + ': ' + tr(o)).join('. '), 'hl')}</span>` : ''}</div>
      ${q.img ? `<img class="q-img" src="${q.img}" alt="Abbildung zu Frage ${esc(q.n)}" loading="lazy">` : ''}
      <div class="opts">${q.o.map((o, i) => {
        let cls = '';
        if (reveal) { if (i === q.a) cls = 'right'; else if (i === sel) cls = 'wrong'; }
        else if (i === sel) cls = 'sel';
        return `<button class="opt ${cls}" data-act="${mode}" data-i="${i}" ${reveal && mode !== 'exam' ? 'disabled' : ''} ${mode === 'exam' ? `aria-pressed="${i === sel}"` : ''}><span class="k">${ABC[i]}</span><span>${gloss(esc(o))}${ruOpts[i] && tr(ruOpts[i]) !== o ? ru(ruOpts[i]) : ''}</span></button>`;
      }).join('')}</div>
      ${reveal && q.e ? `<div class="why"><b>WARUM?</b>${esc(q.e[0])} ${say(q.e[0])}${ruSay(q.e[1])}</div>` : ''}
    </div>`;
}
export function lernen(filter, arg) {
  let pool;
  const now = Date.now();
  if (filter === 'sachsen') pool = shuffle(D.state);
  else if (filter === 'thema') pool = shuffle(D.q.filter(q => q.t === D.topics[+arg])).sort((a, b) => topicWeak(b) - topicWeak(a)).slice(0, 20);
  else if (filter === 'fehler') pool = shuffle(D.q.filter(q => S.wrong[q.id]));
  else {
    const dueQ = D.q.filter(q => S.srs[q.id] && S.srs[q.id].due <= now).sort((a, b) => S.srs[a.id].due - S.srs[b.id].due);
    const newQ = D.q.filter(q => !S.srs[q.id]);
    pool = [...dueQ, ...newQ].slice(0, 20);
    if (!pool.length) pool = shuffle(D.q.filter(q => (S.srs[q.id]?.l || 0) < 5)).slice(0, 20);
    if (!pool.length) pool = shuffle(D.q).slice(0, 20);
  }
  if (!pool.length) { render(`${back('#test')}<div class="card"><h2>Keine Fragen in dieser Auswahl</h2><p>Super – hier gibt es gerade nichts zu wiederholen.</p></div>`); return; }
  let queue = pool.slice(), i = 0, right = 0, answered = 0;
  const first = {};
  function show(sel = null) {
    const q = queue[i];
    const revealed = sel !== null;
    render(`${back('#test', 'Test')}
      ${queue.length <= 40 ? `<div class="segs" aria-label="Fortschritt ${i + 1} von ${queue.length}">${queue.map((_, k) => `<i class="${k < i ? 'd' : ''}"></i>`).join('')}</div>` : `<div class="mb">${bar(pct(i, queue.length))}</div>`}
      ${qCard(q, { sel, reveal: revealed, mode: 'learn' })}
      <div aria-live="polite">${revealed ? `<div class="feedback ${sel === q.a ? 'ok' : 'bad'}">${sel === q.a ? '✓ Richtig!' : '✗ Leider falsch. Richtig ist ' + ABC[q.a] + '.'}${ruRaw(sel === q.a ? tr('ui.correct') : tr('ui.unfortunately-wrong-the-correct-answ') + ABC[q.a] + '.')}</div>` : ''}</div>
      ${revealed ? `<div class="row end sticky-next"><button class="btn primary" data-act="next">${i + 1 < queue.length ? 'Weiter ›' : 'Runde beenden'}</button></div>` : '<p class="kbd-hint">Tastatur: 1–4 oder A–D wählen, Enter für Weiter</p>'}`);
    if (revealed) $app.querySelector('[data-act="next"]')?.focus({ preventScroll: true });
  }
  const keys = e => {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = '1234abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0) { $app.querySelector(`.opt[data-act="learn"][data-i="${k % 4}"]:not([disabled])`)?.click(); }
    else if (e.key === 'Enter' && !e.target.closest('button, a')) $app.querySelector('[data-act="next"]')?.click();
  };
  document.addEventListener('keydown', keys);
  $app.onclick = e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    if (t.dataset.act === 'learn') {
      const q = queue[i], sel = +t.dataset.i, ok = sel === q.a;
      if (!(q.id in first)) { first[q.id] = ok; answered++; if (ok) right++; statAdd(q.id, ok); srsGrade(S.srs, q.id, ok); S.wrong[q.id] = !ok; activity(); }
      else if (ok && filter === 'fehler') { S.wrong[q.id] = false; save(); }
      if (!ok) queue.push(q); // kommt in derselben Runde wieder
      show(sel);
    } else if (t.dataset.act === 'next') {
      i++;
      if (i >= queue.length) {
        render(`${back('#test', 'Test')}<div class="card"><h2>Runde geschafft!</h2>${ru('ui.round-complete')}<p class="stat">${right} / ${answered}</p><p class="muted">beim ersten Versuch richtig</p>
          <div class="row"><a class="btn primary" href="#test" data-act="again">Noch eine Runde</a><a class="btn" href="#test">Übersicht</a></div></div>`);
        $app.onclick = e2 => { if (e2.target.closest('[data-act="again"]')) { e2.preventDefault(); lernen(filter, arg); } };
      } else show();
    } else if (t.dataset.act === 'speak') speak(t.dataset.t);
  };
  onLeave(() => { document.removeEventListener('keydown', keys); });
  show();
}
export function pruefung() {
  const qs = [...shuffle(D.general).slice(0, 30), ...shuffle(D.state).slice(0, 3)];
  const ans = Array(qs.length).fill(null);
  let i = 0, done = false;
  const end = Date.now() + 60 * 60000;
  const timer = setInterval(tick, 1000);
  function tick() {
    const el = document.getElementById('timer'); if (!el) return;
    const left = Math.max(0, end - Date.now());
    el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (!left && !done) finish();
  }
  function show() {
    render(`
      <div class="exam-bar">
        <div class="row"><button class="back" data-act="quit" style="margin:0;border:0;background:none;cursor:pointer;padding:0">‹ Abbrechen</button><span class="spacer"></span><span class="badge brand">⏱ <span id="timer">60:00</span></span><span class="badge">${ans.filter(a => a !== null).length}/33 beantwortet</span></div>
        <div class="dots" role="navigation" aria-label="Fragen">${qs.map((_, k) => `<button data-act="jump" data-i="${k}" class="${ans[k] !== null ? 'done' : 'open'} ${k === i ? 'cur' : ''}" aria-label="Frage ${k + 1}${ans[k] !== null ? ', beantwortet' : ', offen'}" ${k === i ? 'aria-current="step"' : ''}>${k + 1}</button>`).join('')}</div>
        <div id="quitbox"></div>
      </div>
      ${qCard(qs[i], { idx: i, total: 33, sel: ans[i], mode: 'exam' })}
      <div class="row"><button class="btn" data-act="prev" ${i === 0 ? 'disabled' : ''}>‹ Zurück</button><span class="spacer"></span>
        ${i < 32 ? `<button class="btn primary" data-act="fwd">Weiter ›</button>` : ''}<button class="btn ${i === 32 ? 'primary' : ''}" data-act="finish">Abgeben</button></div>
      <p class="kbd-hint">Tastatur: 1–4 oder A–D wählen, ← → blättern</p>`);
    tick();
  }
  const keys = e => {
    if (done || e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = '1234abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0) { ans[i] = k % 4; show(); }
    else if (e.key === 'ArrowRight' && i < 32) { i++; show(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; show(); }
  };
  document.addEventListener('keydown', keys);
  function finish() {
    if (done) return; done = true; clearInterval(timer);
    const score = qs.filter((q, k) => ans[k] === q.a).length;
    qs.forEach((q, k) => { if (ans[k] !== null) { statAdd(q.id, ans[k] === q.a); S.wrong[q.id] = ans[k] !== q.a; if (ans[k] !== q.a) srsGrade(S.srs, q.id, false); } });
    S.exams.push({ date: Date.now(), score, total: 33 }); activity(ans.filter(a => a !== null).length);
    const ok = score >= 17;
    render(`
      <div class="card center"><div class="stat" style="font-size:3em">${score}/33</div>
        <p><span class="badge ${ok ? 'ok' : 'bad'} fs-1">${ok ? 'Bestanden' : 'Nicht bestanden'}</span></p>
        <p class="muted">${ok ? (score >= 25 ? 'Sehr sicher – so kannst du dich anmelden.' : 'Bestanden, aber übe weiter, bis du sicher über 25 liegst.') : 'Mindestens 17 richtige Antworten sind nötig. Übe deine Fehler!'}</p>
        <div class="row center-x"><a class="btn primary" href="#lernen--fehler">Fehler üben</a><button class="btn" data-act="again">Neue Simulation</button>${ok ? '<button class="btn" data-act="bild">Erfolg teilen</button>' : ''}</div><div id="erfolg" class="mt"></div></div>
      <h2>Auswertung</h2>
      ${qs.map((q, k) => `<details class="card flat"><summary><b>${k + 1}.</b> ${ans[k] === q.a ? '<span class="badge ok">richtig</span>' : '<span class="badge bad">' + (ans[k] === null ? 'leer' : 'falsch') + '</span>'} ${esc(q.q)}</summary><div class="mt">${qCard(q, { sel: ans[k], reveal: true, mode: 'x' })}</div></details>`).join('')}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (done) { if (a === 'again') pruefung(); if (a === 'bild') erfolgsbild(qs.filter((q, k) => ans[k] === q.a).length); return; }
    if (a === 'quit') {
      if (!ans.some(x => x !== null)) { location.hash = '#test'; return; }
      document.getElementById('quitbox').innerHTML = `<div class="notice mt" role="alert"><b>Simulation abbrechen?</b> Deine Antworten werden nicht gewertet.${ru('ui.cancel-the-practice-exam-your-answer')}<div class="row mt-s"><a class="btn small" href="#test">Ja, abbrechen</a><button class="btn small primary" data-act="stay">Weiter üben</button></div></div>`;
      return;
    }
    if (a === 'stay') { document.getElementById('quitbox').innerHTML = ''; return; }
    if (a === 'exam') { ans[i] = +t.dataset.i; show(); }
    else if (a === 'jump') { i = +t.dataset.i; show(); }
    else if (a === 'prev') { i--; show(); }
    else if (a === 'fwd') { i++; show(); }
    else if (a === 'finish') {
      const open = ans.filter(x => x === null).length;
      if (!open || confirmTap(t, `${open} offen – trotzdem abgeben?`)) finish();
    }
  };
  onLeave(() => { clearInterval(timer); document.removeEventListener('keydown', keys); });
  show();
}
export function katalog() {
  const topics = ['Alle', 'Sachsen', ...new Set(D.general.map(q => q.t))];
  let topic = 'Alle', term = '';
  function list() {
    const t = term.toLowerCase();
    return D.q.filter(q => (topic === 'Alle' || q.t === topic) && (!t || (q.q + ' ' + q.o.join(' ') + ' ' + tr(q.ru || '')).toLowerCase().includes(t) || String(q.n) === t));
  }
  function draw() {
    const items = list();
    document.getElementById('kat').innerHTML = items.slice(0, 400).map(q => `
      <div class="card flat"><div class="q-head"><span>${q.id.startsWith('SN') ? 'Sachsen' : 'Frage'} ${q.n} · ${esc(q.t)}</span>${S.srs[q.id] ? `<span class="badge ${S.srs[q.id].l >= 4 ? 'ok' : ''}">Stufe ${S.srs[q.id].l}</span>` : ''}</div>
        <div class="q-text fs-1">${esc(q.q)}${ru(q.ru)}</div>
        ${q.img ? `<img class="q-img" src="${q.img}" alt="" loading="lazy">` : ''}
        <div class="small"><b style="color:var(--ok)">✓ ${esc(q.o[q.a])}</b>${q.ruo && tr(q.ruo[q.a]) !== q.o[q.a] ? ru(q.ruo[q.a]) : ''}</div>${q.e ? `<div class="tip">${esc(q.e[0])}${ru(q.e[1])}</div>` : ''}</div>`).join('') || '<p class="muted">Keine Treffer.</p>';
    document.getElementById('cnt').textContent = `${items.length} Fragen`;
  }
  render(`${back('#test', 'Test')}<h1>Fragenkatalog</h1>
    <input class="text mb" type="search" id="such" placeholder="Suchen (Wort oder Nummer) …" aria-label="Fragen durchsuchen">
    <div class="chips">${topics.map(x => `<button class="chip ${x === topic ? 'on' : ''}" data-topic="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <p class="small muted" id="cnt"></p><div id="kat"></div>
    <p class="small muted">Quelle: ${esc(D.qmeta.source)}. ${esc(D.qmeta.translation_ru)}. ${esc(D.qmeta.images)}.</p>`);
  document.getElementById('such').oninput = e => { term = e.target.value.trim(); draw(); };
  $app.onclick = e => { const c = e.target.closest('[data-topic]'); if (c) { topic = c.dataset.topic; document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); draw(); } };
  draw();
}
export function topicStats() {
  return D.topics.map((t, k) => {
    const qs = D.q.filter(q => q.t === t); let r = 0, w = 0;
    qs.forEach(q => { const s = S.stat[q.id]; if (s) { r += s.r; w += s.w; } });
    return { t, k, n: qs.length, r, w, rate: r + w ? w / (r + w) : 0 };
  });
}
export function topicWeak(q) { const s = S.stat[q.id]; return s ? (s.w + 1) / (s.r + s.w + 2) : 0.5; }
export function statsCard() {
  const ts = topicStats().filter(x => x.r + x.w >= 5);
  if (!ts.length) return `<div class="card flat"><h3 style="margin:0 0 4px">Deine Themen-Statistik</h3><p class="small muted m-0">Erscheint, sobald du ein paar Fragen beantwortet hast.</p></div>`;
  const worst = ts.sort((a, b) => b.rate - a.rate).slice(0, 4);
  return `<div class="card"><h3>Hier passieren die meisten Fehler</h3>${ru('ui.this-is-where-most-mistakes-happen')}
    <div class="mt">${worst.map(x => `<div class="barrow"><span>${esc(x.t)} <span class="small muted">· ${x.w} von ${x.r + x.w} falsch</span></span><a class="btn small" href="#lernen--thema--${x.k}">Üben</a>${bar(Math.round(x.rate * 100))}</div>`).join('')}</div></div>`;
}
export function audio() {
  const modes = [['due', 'Fällige & neue'], ['fehler', 'Meine Fehler'], ['alle', 'Alle (zufällig)']];
  let mode = 'due', pool = [], i = 0, playing = false, token = 0, ruEx = false, wake = null;
  const build = () => {
    const now = Date.now();
    if (mode === 'fehler') pool = shuffle(D.q.filter(q => S.wrong[q.id]));
    else if (mode === 'alle') pool = shuffle(D.q);
    else pool = [...D.q.filter(q => S.srs[q.id] && S.srs[q.id].due <= now), ...D.q.filter(q => !S.srs[q.id])].slice(0, 30);
    if (!pool.length) pool = shuffle(D.q).slice(0, 30);
    i = 0;
  };
  const one = (text, lang) => new Promise(res => {
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = lang === 'de-DE' ? 0.92 : 1; const v = voiceFor(lang.slice(0, 2)); if (v) u.voice = v;
    u.onend = res; u.onerror = res; speechSynthesis.speak(u);
  });
  // in Sätzen vorlesen – Chrome bricht lange Ausgaben sonst ab
  const say = async (text, lang = 'de-DE') => { const my = token; for (const part of chunks(text)) { if (my !== token) return; await one(part, lang); } };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function playFrom() {
    const my = ++token; playing = true; draw();
    try { wake = await navigator.wakeLock?.request('screen'); } catch {}
    while (playing && my === token && i < pool.length) {
      const q = pool[i]; draw();
      const clean = s => s.replace(/…/g, ' ').replace(/\//g, ' oder ');
      await say(clean(q.q)); if (my !== token) return;
      await wait(500);
      for (let k = 0; k < 4; k++) { await say(`${ABC[k]}: ${clean(q.o[k])}`); if (my !== token) return; await wait(250); }
      await wait(3500); if (my !== token) return;
      await say(`Richtig ist ${ABC[q.a]}: ${clean(q.o[q.a])}.`); if (my !== token) return;
      if (q.e) { await wait(300); await say(q.e[0]); if (my !== token) return; }
      if (ruEx && hl() && q.e && tr(q.e[1])) { await wait(300); await say(tr(q.e[1]), LANG[hl()].bcp); if (my !== token) return; }
      await wait(1200);
      i++;
    }
    if (my === token) { playing = false; wake?.release?.().catch(() => {}); draw(); }
  }
  function stop() { token++; playing = false; speechSynthesis.cancel(); wake?.release?.().catch(() => {}); }
  function draw() {
    const q = pool[i];
    render(`${back('#test', 'Test')}<h1>Audio-Modus</h1><p class="muted">Fragen, Antworten und Erklärungen werden nacheinander vorgelesen – zum Lernen unterwegs. Nach den Antworten bleiben 3 Sekunden zum Nachdenken.${ru('ui.questions-answers-and-explanations-a')}</p>
      <div class="chips">${modes.map(([k, n]) => `<button class="chip ${mode === k ? 'on' : ''}" data-mode="${k}">${n}</button>`).join('')}</div>
      ${hl() ? `<label class="check mb"><input type="checkbox" id="ruex" ${ruEx ? 'checked' : ''}><div>Erklärung zusätzlich auf ${hlName()} vorlesen${ru('ui.also-read-the-explanation-aloud-in-e')}</div></label>` : ''}
      ${q ? `<div class="card"><div class="q-head"><span>Frage ${q.n} · ${esc(q.t)}</span><span>${i + 1} / ${pool.length}</span></div><div class="q-text">${esc(q.q)}</div>
        <ol class="small" style="margin:0;padding-left:1.2em">${q.o.map((o, k) => `<li style="${playing ? '' : ''}">${esc(o)}</li>`).join('')}</ol></div>` : ''}
      <div class="player"><button class="btn round" data-act="prev" aria-label="Vorherige Frage">‹</button><button class="btn primary round" data-act="toggle" aria-label="${playing ? 'Pause' : 'Abspielen'}">${playing ? '❚❚' : '▶'}</button><button class="btn round" data-act="next" aria-label="Nächste Frage">›</button></div>
      <p class="small muted mt-l center">Tipp: Bildschirm anlassen – bei gesperrtem Handy stoppen viele Browser das Vorlesen.</p>`);
  }
  if (!('speechSynthesis' in window)) { render(`${back('#test', 'Test')}<h1>Audio-Modus</h1><div class="notice">Dein Browser unterstützt keine Sprachausgabe.</div>`); return; }
  build();
  $app.onclick = e => {
    const t = e.target.closest('[data-act],[data-mode]'); if (!t) return;
    if (t.dataset.mode) { stop(); mode = t.dataset.mode; build(); draw(); return; }
    const a = t.dataset.act;
    if (a === 'toggle') { if (playing) { stop(); draw(); } else playFrom(); }
    else if (a === 'next' || a === 'prev') { const was = playing; stop(); i = Math.max(0, Math.min(pool.length - 1, i + (a === 'next' ? 1 : -1))); was ? playFrom() : draw(); }
  };
  $app.onchange = e => { if (e.target.id === 'ruex') ruEx = e.target.checked; };
  onLeave(() => { stop(); });
  draw();
}
export function gloss(html) {
  if (!D.gRe) return html;
  return html.replace(D.gRe, m => { const k = D.gIndex[m.toLowerCase()]; return k == null ? m : `<span class="term" role="button" tabindex="0" data-g="${k}">${m}</span>`; });
}
export function closePop() { document.getElementById('pop')?.remove(); }
export function showPop(k) {
  closePop(); const g = D.glossar[k]; if (!g) return;
  const el = document.createElement('div'); el.id = 'pop'; el.className = 'pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', g.w);
  el.innerHTML = `<div class="row"><h3>${esc(g.w)}</h3><span class="spacer"></span>${speakBtn(g.w)}<button class="btn small ghost" data-close aria-label="Schließen">✕</button></div><p class="m-0">${esc(g.de)}</p>${ruSay(g.ru)}`;
  el.onclick = e => { if (e.target.closest('[data-close]')) closePop(); const s = e.target.closest('[data-act="speak"]'); if (s) speak(s.dataset.t); };
  document.body.appendChild(el);
}
// Begriffe abfangen, bevor die Antwort ausgewählt wird
document.addEventListener('click', e => {
  const t = e.target.closest('.term');
  if (t) { e.preventDefault(); e.stopPropagation(); showPop(+t.dataset.g); return; }
  if (!e.target.closest('#pop')) closePop();
}, true);
document.addEventListener('keydown', e => { const t = e.target.closest?.('.term'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); showPop(+t.dataset.g); } if (e.key === 'Escape') closePop(); }, true);
export function glossar() {
  let term = '';
  render(`${back('#test', 'Test')}<h1>Wörterbuch</h1><p class="muted">Schwierige Begriffe aus dem Einbürgerungstest. In den Testfragen sind sie gepunktet unterstrichen – einfach antippen.${ru('ui.difficult-terms-from-the-test-in-the')}</p>
    <input class="text mb" type="search" id="gs" placeholder="Begriff suchen …" aria-label="Begriff suchen"><div id="gl"></div>`);
  const draw = () => {
    const t = term.toLowerCase();
    document.getElementById('gl').innerHTML = `<div class="card"><ul class="list">${D.glossar.filter(g => !t || (g.w + g.de + tr(g.ru)).toLowerCase().includes(t)).sort((a, b) => a.w.localeCompare(b.w, 'de')).map(g => `<li class="vok"><div><b>${esc(g.w)}</b><div class="small">${esc(g.de)}</div>${ru(g.ru)}</div>${speakBtn(g.w)}</li>`).join('')}</ul></div>`;
  };
  document.getElementById('gs').oninput = e => { term = e.target.value.trim(); draw(); };
  $app.onclick = e => { const s = e.target.closest('[data-act="speak"]'); if (s) speak(s.dataset.t); };
  draw();
}
export async function erfolgsbild(score) {
  try { await document.fonts.load('600 80px Lora'); } catch {}
  const c = document.createElement('canvas'), W = 1080; c.width = W; c.height = W;
  const g = c.getContext('2d');
  const green = '#145c3f', gold = '#a87c14', ink = '#14231c', paper = '#f3f5f1';
  g.fillStyle = paper; g.fillRect(0, 0, W, W);
  // Linienmuster
  g.strokeStyle = 'rgba(20,92,63,.08)'; g.lineWidth = 2;
  for (let r = 20; r < 1500; r += 18) { g.beginPath(); g.arc(W * 1.1, -W * 0.25, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(168,124,20,.09)';
  for (let r = 20; r < 1300; r += 22) { g.beginPath(); g.arc(-W * 0.1, W * 0.45, r, 0, Math.PI * 2); g.stroke(); }
  // Karte
  g.fillStyle = '#fff'; g.strokeStyle = '#cfd8d1'; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(90, 230, W - 180, 640, 14) : g.rect(90, 230, W - 180, 640); g.fill(); g.stroke();
  g.fillStyle = gold; g.fillRect(90, 230, W - 180, 10);
  g.fillStyle = green; g.font = '500 30px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
  g.fillText('EINBÜRGERUNGSTEST · PRÜFUNGSSIMULATION', W / 2, 160);
  // Stempel
  g.save(); g.translate(W / 2, 520); g.rotate(-0.12);
  g.strokeStyle = green; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, 210, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.setLineDash([10, 10]); g.beginPath(); g.arc(0, 0, 182, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.fillStyle = green; let fs = 150; do { g.font = `600 ${fs}px Lora, Georgia, serif`; fs -= 6; } while (g.measureText(`${score}/33`).width > 300 && fs > 60); g.fillText(`${score}/33`, 0, 50);
  g.font = '600 34px ui-monospace, Menlo, monospace'; g.fillText(score >= 17 ? 'BESTANDEN' : 'GEÜBT', 0, 120);
  g.restore();
  g.fillStyle = ink; g.font = '600 52px Lora, Georgia, serif';
  const name = profileName();
  g.fillText(name ? `${name} ist bereit!` : 'Bereit für den Test!', W / 2, 820);
  g.fillStyle = '#44544c'; g.font = '400 30px system-ui, sans-serif';
  g.fillText(new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 960);
  g.fillStyle = green; g.font = '500 30px ui-monospace, Menlo, monospace';
  g.fillText('einbuergerung.micana.de · kostenlos üben', W / 2, 1010);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `einbuergerungstest-${score}-von-33.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: `Ich habe ${score} von 33 Fragen richtig! Üben kannst du hier: ${APP_URL}` }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob);
  const box = document.getElementById('erfolg');
  if (box) box.innerHTML = `<img src="${url}" alt="Erfolgsbild ${score} von 33" style="width:100%;border-radius:var(--radius);border:1px solid var(--line)"><p class="small muted">Bild lange gedrückt halten, um es zu speichern oder zu teilen.</p>`;
  if (!EMBED) download(file.name, blob, 'image/png');
}
