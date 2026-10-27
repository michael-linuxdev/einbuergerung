// Einbürgerung Sachsen – Lern-App (PWA). Vanilla JS, keine Abhängigkeiten.
const VERSION = '1.0.0';
const $app = document.getElementById('app');
const DAY = 86400000;

/* ---------- Zustand (lokal im Browser) ---------- */
const KEY = 'eb.v1';
const defaults = { ru: true, theme: 'auto', size: 'm', srs: {}, wrong: {}, exams: [], kurs: {}, vok: {}, docs: {}, persona: ['angestellt'], check: {}, amt: null, einreise: '', ehe: false, testdate: '' };
let S = load();
function load() {
  try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return Object.assign({}, defaults); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

/* ---------- Daten ---------- */
const D = {};
async function boot() {
  const files = ['questions', 'info', 'behoerden-sn', 'kurs-a1', 'kurs-a2', 'kurs-b1', 'dtz'];
  const res = await Promise.all(files.map(f => fetch(`data/${f}.json`).then(r => r.json())));
  D.q = res[0].questions; D.qmeta = res[0].meta; D.info = res[1]; D.amt = res[2];
  D.kurs = [...res[3], ...res[4], ...res[5]]; D.dtz = res[6];
  D.qById = Object.fromEntries(D.q.map(q => [q.id, q]));
  D.general = D.q.filter(q => q.id.startsWith('g'));
  D.state = D.q.filter(q => q.id.startsWith('SN'));
  D.vok = D.kurs.flatMap(l => l.vok.map(v => ({ id: l.id + ':' + v[0], de: v[0], ru: v[1], lv: l.lv, lesson: l.id })));
  applyPrefs();
  window.addEventListener('hashchange', route);
  route();
}

/* ---------- Helfer ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ru = t => t ? `<span class="ru" lang="ru">${esc(t)}</span>` : '';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtDate = t => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const bar = p => `<div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
const back = (href, label = 'Zurück') => `<a class="back no-print" href="${href}">‹ ${label}</a>`;
const ABC = ['A', 'B', 'C', 'D'];
const EMBED = (() => { try { return window.self !== window.top; } catch { return true; } })(); // in eingebetteter Vorschau kein Drucken/Download
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
function applyPrefs() {
  document.body.classList.toggle('no-ru', !S.ru);
  const r = document.documentElement;
  if (S.theme !== 'auto') { r.dataset.theme = S.theme; applyPrefs.set = true; }
  else if (applyPrefs.set) { r.removeAttribute('data-theme'); applyPrefs.set = false; }
  r.dataset.size = S.size;
}
const speakIcon = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>';
function speakBtn(text) { return `<button class="speak" data-act="speak" data-t="${esc(text)}" aria-label="Vorlesen">${speakIcon}</button>`; }
let deVoice = null;
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Sprachausgabe wird auf diesem Gerät nicht unterstützt.');
  speechSynthesis.cancel();
  if (!deVoice) deVoice = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('de'));
  const u = new SpeechSynthesisUtterance(text.replace(/–.*$/, '').replace(/\s*\/\s*/g, ', '));
  u.lang = 'de-DE'; u.rate = 0.9; if (deVoice) u.voice = deVoice;
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { deVoice = null; };

/* ---------- Spaced Repetition (Leitner) ---------- */
const INTERVAL = [0, 1, 2, 4, 7, 14]; // Tage je Stufe
function srsGrade(store, id, correct) {
  const c = store[id] || { l: 0, due: 0 };
  if (correct) c.l = Math.min(5, c.l + 1); else c.l = 1;
  c.due = today() + INTERVAL[c.l] * DAY;
  store[id] = c; save();
}
const learned = (store, ids) => ids.filter(id => (store[id]?.l || 0) >= 4).length;

/* ---------- Router ---------- */
let cleanup = null;
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const parts = (decodeURIComponent(location.hash).replace(/^#\/?/, '') || 'start').split(/--|\//);
  const [p, a, b] = parts;
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.toggle('active', n.dataset.nav === p || (p === 'lernen' && n.dataset.nav === 'test') || (['pruefung', 'katalog'].includes(p) && n.dataset.nav === 'test') || (p === 'lektion' && n.dataset.nav === 'kurs')));
  const views = { start, test, lernen, pruefung, katalog, kurs, lektion, vokabeln, dtz, docs, amt, check, briefe, einstellungen, mehr };
  (views[p] || start)(a, b);
  window.scrollTo(0, 0);
  $app.focus({ preventScroll: true });
}
const render = html => { $app.innerHTML = `<div class="wrap">${html}</div>`; };

/* ---------- Start ---------- */
function stepDone(id) {
  const docsItems = D.info.docs.flatMap(g => g.items);
  switch (id) {
    case 's1': return Object.keys(S.check).length >= D.info.check.length;
    case 's2': return D.kurs.filter(l => S.kurs[l.id]?.done).length === D.kurs.length;
    case 's3': return S.exams.some(e => e.score >= 17 && e.total === 33) && learned(S.srs, D.q.map(q => q.id)) >= 250;
    case 's4': return docsItems.length && docsItems.filter(i => S.docs[i.id]).length >= docsItems.length * 0.8;
    case 's5': return !!S.amt;
    default: return false;
  }
}
function start() {
  const qL = learned(S.srs, D.q.map(q => q.id));
  const kD = D.kurs.filter(l => S.kurs[l.id]?.done).length;
  const docsItems = visibleDocs().flatMap(g => g.items);
  const dD = docsItems.filter(i => S.docs[i.id]).length;
  const best = S.exams.length ? Math.max(...S.exams.map(e => e.score)) : null;
  const next = D.kurs.find(l => !S.kurs[l.id]?.done);
  const due = D.q.filter(q => S.srs[q.id] && S.srs[q.id].due <= Date.now()).length;
  let frist = '';
  if (S.einreise) {
    const d = new Date(S.einreise); d.setFullYear(d.getFullYear() + (S.ehe ? 3 : 5));
    const days = Math.ceil((d - Date.now()) / DAY);
    frist = days <= 0 ? `<span class="badge ok">Aufenthaltsdauer erfüllt</span>` : `<span class="badge warn">Frühestens ab ${fmtDate(d)} (noch ${days} Tage)</span>`;
  }
  render(`
    <h1>Dein Weg zur Einbürgerung</h1>
    <p class="muted">Freistaat Sachsen · alles kostenlos und offline nutzbar${ru('Свободное государство Саксония · всё бесплатно и доступно офлайн')}</p>
    <div class="grid three">
      <a class="tile" href="#test"><div class="meta">Einbürgerungstest</div><div class="stat">${qL}<span class="small muted"> / 310</span></div>${bar(pct(qL, 310))}<div class="meta" style="margin-top:6px">${due ? `${due} Fragen fällig` : 'Fragen gelernt'}${best !== null ? ` · Bestwert ${best}/33` : ''}</div></a>
      <a class="tile" href="#kurs"><div class="meta">Deutschkurs A1–B1</div><div class="stat">${kD}<span class="small muted"> / ${D.kurs.length}</span></div>${bar(pct(kD, D.kurs.length))}<div class="meta" style="margin-top:6px">${next ? 'Weiter: ' + esc(next.id.toUpperCase().replace('-', '.')) + ' ' + esc(next.t) : 'Alle Lektionen fertig!'}</div></a>
      <a class="tile" href="#docs"><div class="meta">Unterlagen</div><div class="stat">${dD}<span class="small muted"> / ${docsItems.length}</span></div>${bar(pct(dD, docsItems.length))}<div class="meta" style="margin-top:6px">abgehakt</div></a>
    </div>
    ${frist ? `<div class="card flat" style="margin-top:14px"><b>Aufenthaltsdauer:</b> ${frist}</div>` : `<a class="card flat" style="display:block;margin-top:14px;text-decoration:none;color:inherit" href="#check"><b>Wann darfst du den Antrag stellen?</b> Datum eingeben im Voraussetzungs-Check ›${ru('Когда можно подавать заявление? Введите дату в проверке условий')}</a>`}
    <h2 style="margin-top:22px">Schritt für Schritt</h2>
    <div class="card"><ol class="steps">
      ${D.info.steps.map(s => `<li class="${stepDone(s.id) ? 'done' : ''}"><b>${esc(s.t)}</b>${ru(s.ru)}<div class="small" style="margin-top:4px">${esc(s.d)}</div>${ru(s.dru)}${s.go ? `<a class="btn small" style="margin-top:8px" href="#${s.go}">Öffnen</a>` : ''}</li>`).join('')}
    </ol></div>
    <p class="small muted">Inhalte: Stand ${esc(D.info.stand)}. Keine Rechtsberatung – verbindlich ist die Auskunft deiner Einbürgerungsbehörde.</p>
  `);
}

function mehr() {
  render(`<h1>Mehr</h1><div class="grid">
    ${[['check', 'Voraussetzungs-Check', 'Проверка условий', 'Erfülle ich die Bedingungen? Ab wann darf ich?'],
       ['vokabeln', 'Vokabeltrainer', 'Тренажёр слов', 'Alle Wörter aus dem Kurs mit Sprachausgabe'],
       ['dtz', 'B1-Prüfung (DTZ)', 'Экзамен B1 (DTZ)', 'Schreiben und Sprechen üben, Musterbriefe'],
       ['briefe', 'Briefvorlagen', 'Шаблоны писем', 'An die Behörde schreiben – zum Kopieren'],
       ['einstellungen', 'Einstellungen & Infos', 'Настройки и информация', 'Russisch, Schriftgröße, Sicherung, Quellen']]
      .map(([h, t, r, d]) => `<a class="tile" href="#${h}"><h3>${t}</h3>${ru(r)}<div class="meta">${d}</div><span class="arrow">›</span></a>`).join('')}
  </div>`);
}

/* ---------- Einbürgerungstest ---------- */
function test() {
  const ids = D.q.map(q => q.id);
  const now = Date.now();
  const due = D.q.filter(q => S.srs[q.id] && S.srs[q.id].due <= now).length;
  const neu = D.q.filter(q => !S.srs[q.id]).length;
  const L = learned(S.srs, ids);
  const wrong = Object.keys(S.wrong).filter(k => S.wrong[k]).length;
  const last = S.exams.slice(-5).reverse();
  render(`
    <h1>Einbürgerungstest</h1>
    <p class="muted">33 Fragen in 60 Minuten: 30 aus 300 allgemeinen + 3 aus 10 Sachsen-Fragen. Bestanden ab 17 richtigen. Gebühr 25 € bei der Volkshochschule.${ru('33 вопроса за 60 минут: 30 из 300 общих + 3 из 10 вопросов по Саксонии. Сдан от 17 правильных ответов. Сбор 25 € в народном университете (VHS).')}</p>
    <div class="card"><div class="row"><div><div class="stat">${L} / 310</div><div class="muted small">sicher gelernt (Stufe 4+)</div></div><div class="spacer"></div><span class="badge brand">${due} fällig</span><span class="badge">${neu} neu</span></div><div style="margin-top:10px">${bar(pct(L, 310))}</div></div>
    <div class="grid two">
      <a class="tile" href="#lernen"><h3>Lernen</h3>${ru('Учить')}<div class="meta">Bis zu 20 Fragen: erst fällige Wiederholungen, dann neue. Falsche kommen wieder.</div><span class="arrow">›</span></a>
      <a class="tile" href="#pruefung"><h3>Prüfung simulieren</h3>${ru('Пробный экзамен')}<div class="meta">Wie im echten Test: 33 Fragen, 60 Minuten, Auswertung am Ende.</div><span class="arrow">›</span></a>
      <a class="tile" href="#lernen--sachsen"><h3>Nur Sachsen-Fragen</h3>${ru('Только вопросы по Саксонии')}<div class="meta">Die 10 Landesfragen gezielt üben.</div><span class="arrow">›</span></a>
      <a class="tile" href="#lernen--fehler"><h3>Meine Fehler</h3>${ru('Мои ошибки')}<div class="meta">${wrong} Fragen zuletzt falsch beantwortet.</div><span class="arrow">›</span></a>
      <a class="tile" href="#katalog"><h3>Alle 310 Fragen</h3>${ru('Все 310 вопросов')}<div class="meta">Katalog mit Lösungen, Suche und Themenfilter.</div><span class="arrow">›</span></a>
    </div>
    ${last.length ? `<h2 style="margin-top:20px">Letzte Simulationen</h2><div class="card"><ul class="list">${last.map(e => `<li class="row"><span>${fmtDate(e.date)}</span><span class="spacer"></span><b>${e.score}/${e.total}</b> <span class="badge ${e.score >= 17 ? 'ok' : 'bad'}">${e.score >= 17 ? 'bestanden' : 'nicht bestanden'}</span></li>`).join('')}</ul></div>` : ''}
  `);
}

function qCard(q, { idx, total, sel = null, reveal = false, mode = '' } = {}) {
  const ruOpts = q.ruo || [];
  return `
    <div class="card">
      <div class="q-head"><span>${q.id.startsWith('SN') ? 'Sachsen' : 'Frage'} ${q.n}${q.t && q.t !== 'Sachsen' ? ' · ' + esc(q.t) : ''}</span>${idx != null ? `<span>${idx + 1} / ${total}</span>` : ''}</div>
      <div class="q-text">${esc(q.q)}${ru(q.ru)}</div>
      ${q.img ? `<img class="q-img" src="${q.img}" alt="Abbildung zu Frage ${esc(q.n)}" loading="lazy">` : ''}
      <div class="opts">${q.o.map((o, i) => {
        let cls = '';
        if (reveal) { if (i === q.a) cls = 'right'; else if (i === sel) cls = 'wrong'; }
        else if (i === sel) cls = 'sel';
        return `<button class="opt ${cls}" data-act="${mode}" data-i="${i}" ${reveal && mode !== 'exam' ? 'disabled' : ''}><span class="k">${ABC[i]}</span><span>${esc(o)}${ruOpts[i] && ruOpts[i] !== o ? ru(ruOpts[i]) : ''}</span></button>`;
      }).join('')}</div>
    </div>`;
}

function lernen(filter) {
  let pool;
  const now = Date.now();
  if (filter === 'sachsen') pool = shuffle(D.state);
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
      <div class="row" style="margin-bottom:10px"><div style="flex:1">${bar(pct(i, queue.length))}</div><span class="small muted">${i + 1}/${queue.length}</span></div>
      ${qCard(q, { sel, reveal: revealed, mode: 'learn' })}
      ${revealed ? `<div class="feedback ${sel === q.a ? 'ok' : 'bad'}">${sel === q.a ? 'Richtig!' : 'Leider falsch. Richtig ist ' + ABC[q.a] + '.'}${ru(sel === q.a ? 'Правильно!' : 'К сожалению, неверно. Правильный ответ: ' + ABC[q.a] + '.')}</div>
        <div class="row end" style="margin-top:14px"><button class="btn primary" data-act="next">Weiter</button></div>` : ''}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    if (t.dataset.act === 'learn') {
      const q = queue[i], sel = +t.dataset.i, ok = sel === q.a;
      if (!(q.id in first)) { first[q.id] = ok; answered++; if (ok) right++; srsGrade(S.srs, q.id, ok); S.wrong[q.id] = !ok; save(); }
      else if (ok && filter === 'fehler') { S.wrong[q.id] = false; save(); }
      if (!ok) queue.push(q); // kommt in derselben Runde wieder
      show(sel);
    } else if (t.dataset.act === 'next') {
      i++;
      if (i >= queue.length) {
        render(`${back('#test', 'Test')}<div class="card"><h2>Runde geschafft!</h2>${ru('Раунд пройден!')}<p class="stat">${right} / ${answered}</p><p class="muted">beim ersten Versuch richtig</p>
          <div class="row"><a class="btn primary" href="#lernen${filter ? '--' + filter : ''}" data-act="again">Noch eine Runde</a><a class="btn" href="#test">Übersicht</a></div></div>`);
        $app.onclick = e2 => { if (e2.target.closest('[data-act="again"]')) { e2.preventDefault(); lernen(filter); } };
      } else show();
    } else if (t.dataset.act === 'speak') speak(t.dataset.t);
  };
  cleanup = () => { $app.onclick = null; };
  show();
}

function pruefung() {
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
        <div class="row"><a class="back" href="#test" style="margin:0">‹ Abbrechen</a><span class="spacer"></span><span class="badge brand">⏱ <span id="timer">60:00</span></span><span class="badge">${ans.filter(a => a !== null).length}/33 beantwortet</span></div>
        <div class="dots">${qs.map((_, k) => `<button data-act="jump" data-i="${k}" class="${ans[k] !== null ? 'done' : ''} ${k === i ? 'cur' : ''}" aria-label="Frage ${k + 1}">${k + 1}</button>`).join('')}</div>
      </div>
      ${qCard(qs[i], { idx: i, total: 33, sel: ans[i], mode: 'exam' })}
      <div class="row"><button class="btn" data-act="prev" ${i === 0 ? 'disabled' : ''}>‹ Zurück</button><span class="spacer"></span>
        ${i < 32 ? `<button class="btn primary" data-act="fwd">Weiter ›</button>` : ''}<button class="btn ${i === 32 ? 'primary' : ''}" data-act="finish">Abgeben</button></div>`);
    tick();
  }
  function finish() {
    if (done) return; done = true; clearInterval(timer);
    const score = qs.filter((q, k) => ans[k] === q.a).length;
    qs.forEach((q, k) => { if (ans[k] !== null) { S.wrong[q.id] = ans[k] !== q.a; if (ans[k] !== q.a) srsGrade(S.srs, q.id, false); } });
    S.exams.push({ date: Date.now(), score, total: 33 }); save();
    const ok = score >= 17;
    render(`
      <div class="card" style="text-align:center"><div class="stat" style="font-size:3em">${score}/33</div>
        <p><span class="badge ${ok ? 'ok' : 'bad'}" style="font-size:1em">${ok ? 'Bestanden' : 'Nicht bestanden'}</span></p>
        <p class="muted">${ok ? (score >= 25 ? 'Sehr sicher – so kannst du dich anmelden.' : 'Bestanden, aber übe weiter, bis du sicher über 25 liegst.') : 'Mindestens 17 richtige Antworten sind nötig. Übe deine Fehler!'}</p>
        <div class="row" style="justify-content:center"><a class="btn primary" href="#lernen--fehler">Fehler üben</a><button class="btn" data-act="again">Neue Simulation</button></div></div>
      <h2>Auswertung</h2>
      ${qs.map((q, k) => `<details class="card flat"><summary><b>${k + 1}.</b> ${ans[k] === q.a ? '<span class="badge ok">richtig</span>' : '<span class="badge bad">' + (ans[k] === null ? 'leer' : 'falsch') + '</span>'} ${esc(q.q)}</summary><div style="margin-top:10px">${qCard(q, { sel: ans[k], reveal: true, mode: 'x' })}</div></details>`).join('')}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (done) { if (a === 'again') pruefung(); return; }
    if (a === 'exam') { ans[i] = +t.dataset.i; show(); }
    else if (a === 'jump') { i = +t.dataset.i; show(); }
    else if (a === 'prev') { i--; show(); }
    else if (a === 'fwd') { i++; show(); }
    else if (a === 'finish') {
      const open = ans.filter(x => x === null).length;
      if (!open || t.dataset.sure) finish(); else { t.textContent = `${open} offen – trotzdem abgeben?`; t.dataset.sure = '1'; t.classList.add('primary'); }
    }
  };
  cleanup = () => { clearInterval(timer); $app.onclick = null; };
  show();
}

function katalog() {
  const topics = ['Alle', 'Sachsen', ...new Set(D.general.map(q => q.t))];
  let topic = 'Alle', term = '';
  function list() {
    const t = term.toLowerCase();
    return D.q.filter(q => (topic === 'Alle' || q.t === topic) && (!t || (q.q + ' ' + q.o.join(' ') + ' ' + (q.ru || '')).toLowerCase().includes(t) || String(q.n) === t));
  }
  function draw() {
    const items = list();
    document.getElementById('kat').innerHTML = items.slice(0, 400).map(q => `
      <div class="card flat"><div class="q-head"><span>${q.id.startsWith('SN') ? 'Sachsen' : 'Frage'} ${q.n} · ${esc(q.t)}</span>${S.srs[q.id] ? `<span class="badge ${S.srs[q.id].l >= 4 ? 'ok' : ''}">Stufe ${S.srs[q.id].l}</span>` : ''}</div>
        <div class="q-text" style="font-size:1em">${esc(q.q)}${ru(q.ru)}</div>
        ${q.img ? `<img class="q-img" src="${q.img}" alt="" loading="lazy">` : ''}
        <div class="small"><b style="color:var(--ok)">✓ ${esc(q.o[q.a])}</b>${q.ruo ? ru(q.ruo[q.a]) : ''}</div></div>`).join('') || '<p class="muted">Keine Treffer.</p>';
    document.getElementById('cnt').textContent = `${items.length} Fragen`;
  }
  render(`${back('#test', 'Test')}<h1>Fragenkatalog</h1>
    <input class="text" type="search" id="such" placeholder="Suchen (Wort oder Nummer) …" aria-label="Fragen durchsuchen" style="margin-bottom:10px">
    <div class="chips">${topics.map(x => `<button class="chip ${x === topic ? 'on' : ''}" data-topic="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <p class="small muted" id="cnt"></p><div id="kat"></div>
    <p class="small muted">Quelle: ${esc(D.qmeta.source)}. ${esc(D.qmeta.translation_ru)}. ${esc(D.qmeta.images)}.</p>`);
  document.getElementById('such').oninput = e => { term = e.target.value.trim(); draw(); };
  $app.onclick = e => { const c = e.target.closest('[data-topic]'); if (c) { topic = c.dataset.topic; document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); draw(); } };
  cleanup = () => { $app.onclick = null; };
  draw();
}

/* ---------- Deutschkurs ---------- */
function kurs() {
  const lvls = ['A1', 'A2', 'B1'];
  const vokDue = D.vok.filter(v => S.vok[v.id] && S.vok[v.id].due <= Date.now()).length;
  render(`<h1>Deutschkurs A1 – B1</h1>
    <p class="muted">30 Lektionen mit Grammatik, Wortschatz (mit Sprachausgabe), Dialogen und Übungen – alle Erklärungen auch auf Russisch. Ziel: das B1-Zertifikat für die Einbürgerung.${ru('30 уроков с грамматикой, словами (с озвучкой), диалогами и упражнениями — все объяснения также на русском. Цель: сертификат B1 для натурализации.')}</p>
    <div class="grid two" style="margin-bottom:8px">
      <a class="tile" href="#vokabeln"><h3>Vokabeltrainer</h3><div class="meta">${D.vok.length} Wörter · ${vokDue} heute fällig</div><span class="arrow">›</span></a>
      <a class="tile" href="#dtz"><h3>B1-Prüfung (DTZ) üben</h3><div class="meta">Schreiben & Sprechen mit Mustern</div><span class="arrow">›</span></a>
    </div>
    ${lvls.map(lv => {
      const ls = D.kurs.filter(l => l.lv === lv); const d = ls.filter(l => S.kurs[l.id]?.done).length;
      return `<h2 style="margin-top:20px">Niveau ${lv} <span class="badge">${d}/${ls.length}</span></h2>
      <div class="grid two">${ls.map((l, k) => {
        const st = S.kurs[l.id];
        return `<a class="tile" href="#lektion--${l.id}"><div class="meta">${lv}.${k + 1}</div><h3>${esc(l.t)}</h3>${ru(l.ru)}<div class="meta" style="margin-top:6px">${st?.done ? `<span class="badge ok">✓ geschafft · ${st.best}%</span>` : st ? `<span class="badge warn">${st.best}% – nochmal üben</span>` : esc(l.gr.t)}</div></a>`;
      }).join('')}</div>`;
    }).join('')}`);
}

function lektion(id, tab = 'gr') {
  const l = D.kurs.find(x => x.id === id); if (!l) return kurs();
  const idx = D.kurs.indexOf(l), nxt = D.kurs[idx + 1];
  const tabs = [['gr', 'Grammatik'], ['vok', 'Wörter'], ['dia', 'Dialog'], ['ue', 'Übungen']];
  let body = '';
  if (tab === 'gr') body = `<div class="card"><h2>${esc(l.gr.t)}</h2>${ru(l.gr.ru)}<p style="margin-top:12px">${esc(l.gr.de)}</p><p class="ru" lang="ru">${esc(l.gr.rde)}</p>
      <h3 style="margin-top:16px">Beispiele</h3><ul class="list">${l.gr.ex.map(e => `<li class="vok"><div>${esc(e[0])}${ru(e[1])}</div>${speakBtn(e[0])}</li>`).join('')}</ul></div>
      <div class="row end"><a class="btn primary" href="#lektion--${id}--vok">Weiter: Wörter ›</a></div>`;
  if (tab === 'vok') body = `<div class="card"><ul class="list">${l.vok.map(v => `<li class="vok"><div><b>${esc(v[0])}</b>${ru(v[1])}</div>${speakBtn(v[0])}</li>`).join('')}</ul></div>
      <div class="row end"><a class="btn" href="#vokabeln--${id}">Als Karteikarten üben</a><a class="btn primary" href="#lektion--${id}--dia">Weiter: Dialog ›</a></div>`;
  if (tab === 'dia') body = `<div class="card dia"><div class="row" style="margin-bottom:12px"><button class="btn small" data-act="speakall">${speakIcon.replace('<svg', '<svg width="18" height="18" style="fill:none;stroke:currentColor;stroke-width:2"')} Ganzen Dialog anhören</button></div>
      ${l.dia.map(d => `<div class="vok" style="margin-bottom:12px"><p><b>${esc(d[0])}:</b> ${esc(d[1])}${ru(d[2])}</p>${speakBtn(d[1])}</div>`).join('')}</div>
      <div class="row end"><a class="btn primary" href="#lektion--${id}--ue">Weiter: Übungen ›</a></div>`;
  if (tab === 'ue') body = `<div id="ue"></div>`;
  render(`${back('#kurs', 'Kurs')}<div class="muted small">${l.lv} · Lektion ${idx + 1} von ${D.kurs.length}</div><h1>${esc(l.t)}</h1>${ru(l.ru)}
    <div class="tabs" style="margin-top:14px" role="tablist">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${n}</button>`).join('')}</div>${body}`);
  $app.onclick = e => {
    const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
    if (t.dataset.tab) location.hash = `#lektion--${id}--${t.dataset.tab}`;
    else if (t.dataset.act === 'speak') speak(t.dataset.t);
    else if (t.dataset.act === 'speakall') speak(l.dia.map(d => d[1]).join(' … '));
  };
  cleanup = () => { $app.onclick = null; };
  if (tab === 'ue') uebungen(l, nxt);
}

function norm(s) { return String(s).toLowerCase().replace(/[.,!?;:„“"]/g, '').replace(/\s+/g, ' ').trim(); }
function uebungen(l, nxt) {
  const box = document.getElementById('ue');
  const items = l.ue; let i = 0, score = 0;
  function show() {
    const u = items[i];
    let inner = '';
    if (u.k === 'mc') inner = `<div class="opts">${u.o.map((o, k) => `<button class="opt" data-ue="mc" data-i="${k}"><span class="k">${ABC[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    if (u.k === 'gap') inner = `<form data-ue="gap" autocomplete="off"><input class="text" name="a" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Antwort eingeben" aria-label="Antwort"><div class="row end" style="margin-top:10px"><button class="btn primary">Prüfen</button></div></form>`;
    if (u.k === 'order') { u._bank = shuffle(u.w.map((w, k) => ({ w, k }))); u._line = []; inner = `<div class="word-line" id="line" aria-label="Dein Satz"></div><div class="word-bank" id="bank"></div><div class="row end"><button class="btn" data-ue="reset">Zurücksetzen</button><button class="btn primary" data-ue="order">Prüfen</button></div>`; }
    box.innerHTML = `<div class="row" style="margin-bottom:10px"><div style="flex:1">${bar(pct(i, items.length))}</div><span class="small muted">${i + 1}/${items.length}</span></div>
      <div class="card"><div class="muted small" style="margin-bottom:6px">${u.k === 'mc' ? 'Wähle die richtige Antwort.' : u.k === 'gap' ? 'Ergänze die Lücke.' : 'Bilde einen Satz (Wörter antippen).'}${ru(u.k === 'mc' ? 'Выберите правильный ответ.' : u.k === 'gap' ? 'Заполните пропуск.' : 'Составьте предложение (нажимайте на слова).')}</div>
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
    box.querySelectorAll('button.opt, input, [data-ue="order"], [data-ue="reset"], form button').forEach(b => b.disabled = true);
    box.querySelector('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? 'Richtig!' : 'Richtig wäre: ' + esc(solution)}</div><div class="row end" style="margin-top:12px"><button class="btn primary" data-ue="next">Weiter</button></div>`;
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
    box.innerHTML = `<div class="card" style="text-align:center"><div class="stat" style="font-size:2.6em">${score}/${items.length}</div>
      <p>${p >= 70 ? '<span class="badge ok">Lektion geschafft!</span>' : '<span class="badge warn">Ab 70 % gilt die Lektion als geschafft.</span>'}</p>
      <div class="row" style="justify-content:center"><button class="btn" data-ue="again">Nochmal</button>${nxt ? `<a class="btn primary" href="#lektion--${nxt.id}">Nächste Lektion ›</a>` : `<a class="btn primary" href="#dtz">Zur B1-Prüfung ›</a>`}</div></div>`;
    box.onclick = e => { if (e.target.closest('[data-ue="again"]')) uebungen(l, nxt); };
  }
  show();
}

/* ---------- Vokabeltrainer ---------- */
function vokabeln(lessonId) {
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
  function show() {
    const v = pool[i];
    render(`${back(lessonId ? '#lektion--' + lessonId + '--vok' : '#kurs', 'Zurück')}<h1>Vokabeltrainer</h1>
      <div class="chips"><button class="chip ${dir === 'de' ? 'on' : ''}" data-dir="de">Deutsch → Russisch</button><button class="chip ${dir === 'ru' ? 'on' : ''}" data-dir="ru">Russisch → Deutsch</button></div>
      <div class="row" style="margin-bottom:10px"><div style="flex:1">${bar(pct(i, pool.length))}</div><span class="small muted">${i + 1}/${pool.length}</span></div>
      <div class="card flash" data-act="flip" role="button" aria-label="Karte umdrehen">
        <div ${dir === 'ru' ? 'lang="ru"' : ''}>${esc(dir === 'de' ? v.de : v.ru)}</div>
        ${flipped ? `<div class="${dir === 'de' ? 'ru' : ''}" ${dir === 'de' ? 'lang="ru"' : ''} style="${dir === 'ru' ? 'color:var(--brand)' : 'display:block'}">${esc(dir === 'de' ? v.ru : v.de)}</div>` : '<div class="small muted">Antippen zum Umdrehen</div>'}
      </div>
      <div class="row" style="justify-content:center">${speakBtn(v.de)}</div>
      ${flipped ? `<div class="grid two" style="margin-top:14px"><button class="btn" data-act="no">Noch nicht gewusst</button><button class="btn primary" data-act="yes">Gewusst</button></div>` : ''}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act],[data-dir]'); if (!t) return;
    if (t.dataset.dir) { dir = t.dataset.dir; flipped = false; return show(); }
    const a = t.dataset.act;
    if (a === 'flip') { flipped = !flipped; if (flipped && dir === 'ru') speak(pool[i].de); show(); }
    else if (a === 'speak') speak(t.dataset.t);
    else if (a === 'yes' || a === 'no') {
      srsGrade(S.vok, pool[i].id, a === 'yes');
      if (a === 'no') pool.push(pool[i]);
      i++; flipped = false;
      if (i >= pool.length) render(`${back('#kurs', 'Kurs')}<div class="card"><h2>Fertig für jetzt!</h2><p>${learned(S.vok, D.vok.map(v => v.id))} von ${total} Wörtern sicher gelernt.</p><a class="btn primary" href="#kurs">Zum Kurs</a></div>`);
      else show();
    }
  };
  cleanup = () => { $app.onclick = null; };
  show();
}

/* ---------- B1 / DTZ ---------- */
function dtz(part, id) {
  if (part === 'schreiben' && id) {
    const w = D.dtz.schreiben.find(x => x.id === id);
    const key = 'eb.draft.' + id; let draft = ''; try { draft = localStorage.getItem(key) || ''; } catch {}
    render(`${back('#dtz', 'B1-Prüfung')}<h1>${esc(w.t)}</h1>${ru(w.ru)}
      <div class="card"><p>${esc(w.sit)}</p><p class="small muted">Schreiben Sie zu allen vier Punkten (ca. 30 Minuten):</p><ul>${w.p.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <label class="lbl" for="txt">Dein Text</label><textarea id="txt" class="text" spellcheck="true" lang="de">${esc(draft)}</textarea>
      <div class="row" style="margin:10px 0 18px"><span class="small muted" id="wc"></span><span class="spacer"></span><button class="btn" data-act="muster">Musterlösung zeigen</button></div>
      <div id="muster"></div>`);
    const ta = document.getElementById('txt'), wc = document.getElementById('wc');
    const upd = () => { wc.textContent = `${(ta.value.match(/\S+/g) || []).length} Wörter (Ziel: ca. 80–120)`; try { localStorage.setItem(key, ta.value); } catch {} };
    ta.oninput = upd; upd();
    $app.onclick = e => { if (e.target.closest('[data-act="muster"]')) document.getElementById('muster').innerHTML = `<h2>Musterlösung</h2><pre class="letter">${esc(w.muster)}</pre><div class="notice ok">Prüfe deinen Text: Anrede? Alle 4 Punkte? Konnektoren (deshalb, außerdem …)? Schluss und Gruß?</div>`; };
    cleanup = () => { $app.onclick = null; };
    return;
  }
  render(`${back('#kurs', 'Kurs')}<h1>B1-Prüfung (DTZ)</h1><p>${esc(D.dtz.info.de)}</p><p class="ru" lang="ru">${esc(D.dtz.info.ru)}</p>
    <h2 style="margin-top:20px">Schreiben</h2><div class="grid two">${D.dtz.schreiben.map(w => `<a class="tile" href="#dtz--schreiben--${w.id}"><h3>${esc(w.t)}</h3>${ru(w.ru)}<div class="meta">4 Leitpunkte · mit Musterlösung</div><span class="arrow">›</span></a>`).join('')}</div>
    <h2 style="margin-top:20px">Sprechen</h2>
    ${D.dtz.sprechen.map(s => `<div class="card"><h3>${esc(s.t)}</h3>${ru(s.ru)}<ul class="list" style="margin-top:8px">${s.fragen.map(f => `<li class="vok"><span>${esc(f)}</span>${speakBtn(f)}</li>`).join('')}</ul></div>`).join('')}
    <div class="notice">Tipp: Nimm deine Antworten mit dem Handy auf und hör sie dir an. Sprich in ganzen Sätzen und benutze weil, deshalb, außerdem.</div>`);
  $app.onclick = e => { const t = e.target.closest('[data-act="speak"]'); if (t) speak(t.dataset.t); };
  cleanup = () => { $app.onclick = null; };
}

/* ---------- Unterlagen ---------- */
const PERSONAS = [['angestellt', 'Angestellt'], ['selbst', 'Selbständig'], ['studium', 'Studium/Ausbildung'], ['rente', 'Rente'], ['fluechtling', 'Flüchtling/Staatenlos']];
function visibleDocs() { return D.info.docs.filter(g => !g.persona || S.persona.includes(g.persona)); }
function docs() {
  const groups = visibleDocs();
  const all = groups.flatMap(g => g.items), done = all.filter(i => S.docs[i.id]).length;
  const myAmt = S.amt && D.amt.behoerden.find(b => b.id === S.amt);
  render(`<h1>Unterlagen-Checkliste</h1>
    <p class="muted">Welche Unterlagen genau nötig sind, legt deine Behörde fest. Diese Liste zeigt, was typischerweise verlangt wird.${ru('Точный список документов определяет ваше ведомство. Здесь — то, что требуют обычно.')}</p>
    ${myAmt?.downloads ? `<div class="notice ok"><b>${esc(myAmt.name)}:</b> ${myAmt.downloads.map(d => `<a href="${d.url}" target="_blank" rel="noopener">${esc(d.t)}</a>`).join(', ')}${myAmt.hinweis ? `<div class="small" style="margin-top:6px">${esc(myAmt.hinweis)}</div>` : ''}</div>` : `<div class="notice">Wähle unter <a href="#amt">Behörden</a> deinen Wohnort – dann siehst du hier die Hinweise deiner Behörde.</div>`}
    <div class="card no-print"><b>Meine Situation</b>${ru('Моя ситуация')}<div class="chips" style="margin:10px 0 0">${PERSONAS.map(([k, n]) => `<button class="chip ${S.persona.includes(k) ? 'on' : ''}" data-p="${k}">${n}</button>`).join('')}</div></div>
    <div class="card"><div class="row"><b>${done} von ${all.length} erledigt</b><span class="spacer"></span>${EMBED ? '' : '<button class="btn small no-print" data-act="print">Drucken / PDF</button>'}</div><div style="margin-top:8px">${bar(pct(done, all.length))}</div></div>
    ${groups.map(g => `<div class="card"><h2>${esc(g.g)}</h2>${ru(g.gru)}<ul class="list">${g.items.map(it => `<li><label class="check ${S.docs[it.id] ? 'done' : ''}"><input type="checkbox" data-doc="${it.id}" ${S.docs[it.id] ? 'checked' : ''}><div><span class="t">${esc(it.t)}</span>${ru(it.ru)}${it.tip ? `<div class="tip">${esc(it.tip)}${ru(it.tru)}</div>` : ''}</div></label></li>`).join('')}</ul></div>`).join('')}
    <p class="small muted">Tipp: Kopien ins Antragsformular nur, wenn die Behörde es verlangt. Fremdsprachige Urkunden immer mit Übersetzung von beeidigten Übersetzer:innen.</p>`);
  $app.onchange = e => { const c = e.target.closest('[data-doc]'); if (c) { S.docs[c.dataset.doc] = c.checked; save(); c.closest('.check').classList.toggle('done', c.checked); const n = all.filter(i => S.docs[i.id]).length; $app.querySelector('.card .row b').textContent = `${n} von ${all.length} erledigt`; $app.querySelector('.card .progress i').style.width = pct(n, all.length) + '%'; } };
  $app.onclick = e => {
    const p = e.target.closest('[data-p]');
    if (p) { const k = p.dataset.p; S.persona = S.persona.includes(k) ? S.persona.filter(x => x !== k) : [...S.persona, k]; save(); docs(); }
    if (e.target.closest('[data-act="print"]')) window.print();
  };
  cleanup = () => { $app.onclick = null; $app.onchange = null; };
}

/* ---------- Behörden & Kontakte ---------- */
function findAmt(term) {
  const t = term.trim().toLowerCase(); if (!t) return [];
  const plz = /^\d{5}$/.test(t) ? +t : null;
  return D.amt.behoerden.filter(b => (plz && b.plz?.some(([a, z]) => plz >= a && plz <= z)) || b.name.toLowerCase().includes(t) || b.orte.some(o => o.toLowerCase().startsWith(t)));
}
const tel = n => `<a href="tel:${n.replace(/[^\d+]/g, '')}">${esc(n)}</a>`;
function amtCard(b, full = true) {
  const verified = b.stand?.startsWith('geprüft');
  return `<div class="card">
    <div class="row"><h2 style="margin:0">${esc(b.name)}</h2><span class="spacer"></span>${verified ? `<span class="badge ok">${esc(b.stand)}</span>` : '<span class="badge">Kontakt über Amt24 prüfen</span>'}</div>
    <p class="muted small" style="margin-top:4px">${esc(b.art)}</p>
    <dl class="kv">
      ${b.adresse ? `<dt>Adresse</dt><dd>${esc(b.adresse)}</dd>` : `<dt>Sitz</dt><dd>${esc(b.sitz)}</dd>`}
      ${b.post ? `<dt>Post</dt><dd>${esc(b.post)}</dd>` : ''}
      ${b.tel ? `<dt>Telefon</dt><dd>${(Array.isArray(b.tel) ? b.tel : [b.tel]).map(tel).join('<br>')}${b.telZentrale ? `<br><span class="small muted">Zentrale: ${tel(b.telZentrale)}</span>` : ''}</dd>` : ''}
      ${b.mail ? `<dt>E-Mail</dt><dd><a href="mailto:${esc(b.mail)}">${esc(b.mail)}</a></dd>` : ''}
      ${b.zeiten ? `<dt>Zeiten</dt><dd>${esc(b.zeiten)}</dd>` : ''}
      <dt>Web</dt><dd><a href="${esc(b.web)}" target="_blank" rel="noopener">${esc(b.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd>
      ${b.aussen ? `<dt>Außenstellen</dt><dd>${b.aussen.map(esc).join('<br>')}</dd>` : ''}
    </dl>
    ${b.hinweis ? `<div class="notice" style="margin:14px 0 0">${esc(b.hinweis)}${ru(b.hru)}</div>` : ''}
    ${b.downloads ? `<div class="row" style="margin-top:12px">${b.downloads.map(d => `<a class="btn small" href="${esc(d.url)}" target="_blank" rel="noopener">⬇ ${esc(d.t)}</a>`).join('')}</div>` : ''}
    ${!verified ? `<div class="row" style="margin-top:12px"><a class="btn small" href="${esc(D.amt.amt24)}" target="_blank" rel="noopener">Genaue Kontaktdaten auf Amt24</a></div>` : ''}
    ${full && b.extra ? `<h3 style="margin-top:18px">Weitere Kontakte vor Ort</h3><ul class="list">${b.extra.map(x => `<li><b>${esc(x.name)}</b><div class="small">${esc(x.adresse)}${x.tel ? ' · ' + tel(x.tel) : ''}${x.mail ? ` · <a href="mailto:${esc(x.mail)}">${esc(x.mail)}</a>` : ''}${x.zeiten ? '<br>' + esc(x.zeiten) : ''}<br><a href="${esc(x.web)}" target="_blank" rel="noopener">${esc(x.web.replace(/^https?:\/\/(www\.)?/, ''))}</a></div></li>`).join('')}</ul>` : ''}
  </div>`;
}
function amt() {
  const mine = S.amt && D.amt.behoerden.find(b => b.id === S.amt);
  render(`<h1>Behörden & Kontakte</h1>
    <p class="muted">${esc(D.amt.regel)}${ru('В Хемнице, Дрездене и Лейпциге отвечает городская администрация, во всех остальных местах — районная администрация (Landratsamt).')}</p>
    <label class="lbl" for="ort">Wohnort oder Postleitzahl</label>
    <input class="text" id="ort" type="search" placeholder="z. B. Freital, Pirna oder 01705" autocomplete="address-level2">
    <div class="chips" style="margin:10px 0 0">${['Freital', 'Pirna', 'Dresden', 'Leipzig', 'Chemnitz'].map(o => `<button class="chip" data-ort="${o}">${o}</button>`).join('')}</div>
    <div id="treffer" style="margin-top:12px"></div>
    ${mine ? `<h2 style="margin-top:18px">Meine Behörde</h2>${amtCard(mine)}<button class="btn small ghost" data-act="forget">Andere Behörde wählen</button>` : ''}
    <h2 style="margin-top:22px">Beratung, Tests und Kurse</h2>
    ${D.info.kontakte.map(g => `<div class="card"><h3>${esc(g.g)}</h3><ul class="list">${g.items.map(k => `<li><b>${k.web ? `<a href="${esc(k.web)}" target="_blank" rel="noopener">${esc(k.name)}</a>` : `<a href="#${k.go}">${esc(k.name)}</a>`}</b><div class="small">${esc(k.d)}</div>${ru(k.dru)}</li>`).join('')}</ul></div>`).join('')}
    <h2 style="margin-top:22px">Alle Einbürgerungsbehörden in Sachsen</h2>
    <div class="card"><ul class="list">${D.amt.behoerden.map(b => `<li class="row"><div style="flex:1"><b>${esc(b.name)}</b><div class="small muted">${esc(b.sitz)} · u. a. ${b.orte.slice(0, 4).map(esc).join(', ')}</div></div><button class="btn small" data-amt="${b.id}">Wählen</button></li>`).join('')}</ul></div>
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
  cleanup = () => { $app.onclick = null; };
}

/* ---------- Voraussetzungs-Check ---------- */
function check() {
  const C = D.info.check;
  const answered = C.filter(c => S.check[c.id] != null);
  const vals = answered.map(c => c.o[S.check[c.id]].v);
  const overall = answered.length < C.length ? null : vals.includes(0) ? 'r' : vals.includes(1) ? 'y' : 'g';
  let frist = '';
  if (S.einreise) { const d = new Date(S.einreise); d.setFullYear(d.getFullYear() + (S.ehe ? 3 : 5)); frist = d <= new Date() ? `<div class="notice ok">Die Mindestaufenthaltsdauer ist erfüllt (seit ${fmtDate(d)}).</div>` : `<div class="notice">Antrag frühestens ab <b>${fmtDate(d)}</b>. Den Test und Deutsch kannst du schon vorher machen!</div>`; }
  render(`<h1>Voraussetzungs-Check</h1>
    <p class="muted">Unverbindliche Selbsteinschätzung nach § 10 StAG (Stand ${esc(D.info.stand)}). Die Entscheidung trifft die Einbürgerungsbehörde.${ru('Необязательная самооценка по § 10 Закона о гражданстве. Решение принимает ведомство по натурализации.')}</p>
    <div class="card"><h2>Ab wann darf ich?</h2>${ru('С какого момента я могу подать?')}
      <label class="lbl" for="ein" style="margin-top:10px">Beginn des rechtmäßigen Aufenthalts in Deutschland</label>
      <input class="text" type="date" id="ein" value="${esc(S.einreise)}" max="${new Date().toISOString().slice(0, 10)}">
      <label class="check" style="margin-top:12px"><input type="checkbox" id="ehe" ${S.ehe ? 'checked' : ''}><div>Ich bin mit einer/einem Deutschen verheiratet (Ehe besteht seit mind. 2 Jahren)${ru('Я в браке с гражданином(-кой) Германии (не менее 2 лет)')}</div></label>
      <div style="margin-top:12px">${frist}</div>
      <p class="small muted">Zeiten mit Duldung oder Aufenthaltsgestattung zählen meist nicht oder nur teilweise. Unterbrechungen durch Auslandsaufenthalte mit der Behörde klären.</p></div>
    ${overall ? `<div class="card"><h2><span class="ampel ${overall}"></span>${overall === 'g' ? 'Gute Chancen' : overall === 'y' ? 'Fast – es fehlen noch Schritte' : 'Derzeit nicht erfüllt'}</h2><p class="small">${overall === 'g' ? 'Nach deinen Angaben erfüllst du die Voraussetzungen. Nimm Kontakt zu deiner Behörde auf.' : overall === 'y' ? 'Einige Punkte musst du noch erledigen oder klären. Die Hinweise unten zeigen, was zu tun ist.' : 'Mindestens eine Voraussetzung fehlt. Lass dich beraten – oft gibt es einen Weg.'}</p>${overall !== 'r' ? '<a class="btn small" href="#amt">Zu meiner Behörde</a>' : '<a class="btn small" href="#amt">Beratungsstellen</a>'}</div>` : ''}
    ${C.map((c, k) => { const sel = S.check[c.id]; const o = sel != null ? c.o[sel] : null;
      return `<div class="card"><div class="muted small">${k + 1} / ${C.length}</div><h3>${esc(c.q)}</h3>${ru(c.ru)}<div class="opts" style="margin-top:10px">${c.o.map((x, i) => `<button class="opt ${sel === i ? 'sel' : ''}" data-c="${c.id}" data-i="${i}"><span class="ampel ${['r', 'y', 'g'][x.v]}" aria-hidden="true"></span><span>${esc(x.t)}${ru(x.ru)}</span></button>`).join('')}</div>${o?.hint ? `<div class="tip" style="margin-top:10px">${esc(o.hint)}${ru(o.hru)}</div>` : ''}</div>`; }).join('')}`);
  document.getElementById('ein').onchange = e => { S.einreise = e.target.value; save(); check(); };
  document.getElementById('ehe').onchange = e => { S.ehe = e.target.checked; save(); check(); };
  $app.onclick = e => { const t = e.target.closest('[data-c]'); if (t) { const y = window.scrollY; S.check[t.dataset.c] = +t.dataset.i; save(); check(); window.scrollTo(0, y); } };
  cleanup = () => { $app.onclick = null; };
}

/* ---------- Briefvorlagen ---------- */
function briefe() {
  render(`<h1>Briefvorlagen</h1><p class="muted">Für E-Mails und Briefe an die Behörde. Ersetze die Angaben in [eckigen Klammern].${ru('Для писем и e-mail в ведомство. Замените данные в [квадратных скобках].')}</p>
    ${D.info.briefe.map(b => `<div class="card"><h2>${esc(b.t)}</h2>${ru(b.ru)}<pre class="letter" style="margin-top:10px">${esc(b.text)}</pre><div class="row"><button class="btn small" data-copy="${b.id}">Kopieren</button>${S.amt && D.amt.behoerden.find(x => x.id === S.amt)?.mail ? `<a class="btn small" href="mailto:${esc(D.amt.behoerden.find(x => x.id === S.amt).mail)}?subject=${encodeURIComponent(b.t)}&body=${encodeURIComponent(b.text)}">Als E-Mail an meine Behörde</a>` : ''}</div></div>`).join('')}`);
  $app.onclick = async e => {
    const t = e.target.closest('[data-copy]'); if (!t) return;
    const b = D.info.briefe.find(x => x.id === t.dataset.copy);
    try { await navigator.clipboard.writeText(b.text); toast('Kopiert'); } catch { toast('Kopieren nicht möglich – bitte Text markieren.'); }
  };
  cleanup = () => { $app.onclick = null; };
}

/* ---------- Einstellungen ---------- */
function einstellungen() {
  render(`<h1>Einstellungen</h1>
    <div class="card"><label class="check"><input type="checkbox" id="ru" ${S.ru ? 'checked' : ''}><div><b>Russische Erklärungen anzeigen</b><span class="ru" lang="ru" style="display:block">Показывать пояснения на русском</span></div></label></div>
    <div class="card"><b>Schriftgröße</b><div class="chips" style="margin-top:10px">${[['m', 'Normal'], ['l', 'Groß'], ['xl', 'Sehr groß']].map(([k, n]) => `<button class="chip ${S.size === k ? 'on' : ''}" data-size="${k}">${n}</button>`).join('')}</div>
      <b>Darstellung</b><div class="chips" style="margin-top:10px">${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, n]) => `<button class="chip ${S.theme === k ? 'on' : ''}" data-theme="${k}">${n}</button>`).join('')}</div></div>
    <div class="card"><h2>Fortschritt sichern</h2><p class="small">Dein Fortschritt wird nur auf diesem Gerät gespeichert. Mit einer Sicherungsdatei kannst du ihn auf ein anderes Gerät übertragen.</p>
      <div class="row">${EMBED ? '' : '<button class="btn small" data-act="export">Sicherung herunterladen</button>'}<label class="btn small">Sicherung laden<input type="file" accept="application/json" id="imp" hidden></label><button class="btn small ghost" data-act="reset">Alles zurücksetzen</button></div></div>
    <div class="card"><h2>App installieren</h2><p class="small"><b>iPhone/iPad:</b> In Safari auf „Teilen“ tippen → „Zum Home-Bildschirm“. <b>Android:</b> Im Chrome-Menü „App installieren“ wählen. Danach funktioniert alles auch ohne Internet.</p></div>
    <div class="card"><h2>Quellen & Hinweise</h2>
      <p class="small"><b>Fragenkatalog:</b> ${esc(D.qmeta.source)}. Amtliches Werk nach § 5 UrhG, unverändert wiedergegeben. Lösungen: ${esc(D.qmeta.answers)}.</p>
      <p class="small">${esc(D.qmeta.translation_ru)}. ${esc(D.qmeta.images)}.</p>
      <p class="small"><b>Rechtsstand:</b> Staatsangehörigkeitsgesetz in der Fassung nach Abschaffung der 3-Jahres-Einbürgerung (in Kraft seit 30.10.2025). Gebühr 255 € (§ 38 StAG). Behördenangaben: Websites der Landkreise und des Freistaates Sachsen, Stand ${esc(D.info.stand)}.</p>
      <p class="small"><b>Keine Rechtsberatung.</b> Diese App ist ein privates, kostenloses Lernangebot und steht in keiner Verbindung zum BAMF oder zu Behörden. Verbindlich ist allein die Auskunft deiner Einbürgerungsbehörde.</p>
      <p class="small"><b>Datenschutz:</b> keine Anmeldung, keine Cookies, kein Tracking. Alle Eingaben bleiben im Speicher deines Browsers.</p>
      <p class="small muted">Version ${VERSION}</p></div>`);
  $app.onchange = e => {
    if (e.target.id === 'ru') { S.ru = e.target.checked; save(); applyPrefs(); }
    if (e.target.id === 'imp') { const f = e.target.files[0]; if (!f) return; f.text().then(t => { S = Object.assign({}, defaults, JSON.parse(t)); save(); applyPrefs(); toast('Sicherung geladen'); einstellungen(); }).catch(() => toast('Datei ungültig')); }
  };
  $app.onclick = e => {
    const t = e.target.closest('[data-size],[data-theme],[data-act]'); if (!t) return;
    if (t.dataset.size) { S.size = t.dataset.size; save(); applyPrefs(); einstellungen(); }
    else if (t.dataset.theme) { S.theme = t.dataset.theme; save(); applyPrefs(); einstellungen(); }
    else if (t.dataset.act === 'export') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = `einbuergerung-sicherung-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }
    else if (t.dataset.act === 'reset' && !t.dataset.sure) { t.dataset.sure = '1'; t.textContent = 'Wirklich alles löschen? Nochmal tippen'; }
    else if (t.dataset.act === 'reset') { S = Object.assign({}, defaults); save(); applyPrefs(); toast('Zurückgesetzt'); einstellungen(); }
  };
  cleanup = () => { $app.onclick = null; $app.onchange = null; };
}

/* ---------- Start ---------- */
boot().catch(err => { console.error(err); $app.innerHTML = '<div class="wrap"><div class="card"><h2>Die Daten konnten nicht geladen werden.</h2><p>Bitte Seite neu laden. Beim ersten Öffnen ist eine Internetverbindung nötig.</p></div></div>'; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
