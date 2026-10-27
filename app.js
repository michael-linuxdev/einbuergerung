// Einbürgerung Sachsen – Lern-App (PWA). Vanilla JS, keine Abhängigkeiten.
const VERSION = '1.1.0';
const $app = document.getElementById('app');
const DAY = 86400000;

/* ---------- Zustand (lokal im Browser) ---------- */
const KEY = 'eb.v1';
const defaults = { ru: true, theme: 'auto', size: 'm', srs: {}, wrong: {}, exams: [], kurs: {}, vok: {}, docs: {}, persona: ['angestellt'], check: {}, amt: null, einreise: '', ehe: false, testdate: '', b1date: '', planTime: '19:00', cv: null, kosten: null, fristen: [{ id: 'pass', t: 'Reisepass', d: '' }, { id: 'titel', t: 'Aufenthaltstitel', d: '' }], installSeen: false };
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
  maybeInstallSheet();
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
  const views = { start, test, lernen, pruefung, katalog, kurs, lektion, vokabeln, dtz, docs, amt, check, briefe, einstellungen, mehr, plan, lebenslauf, kosten, fristen, installieren };
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
    ${todayCard()}${fristWarnings()}
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
       ['dtz', 'B1-Prüfung (DTZ)', 'Экзамен B1 (DTZ)', 'Hören, Lesen, Schreiben und Sprechen üben'],
       ['plan', 'Mein Lernplan', 'Мой план обучения', 'Tagesziele bis zum Prüfungstermin, mit Erinnerung'],
       ['lebenslauf', 'Lebenslauf-Generator', 'Генератор автобиографии', 'Ausführlicher Lebenslauf als Text für den Antrag'],
       ['kosten', 'Kostenrechner', 'Калькулятор расходов', 'Was die Einbürgerung für deine Familie kostet'],
       ['fristen', 'Ablaufdaten', 'Сроки документов', 'Warnung, bevor Pass oder Aufenthaltstitel ablaufen'],
       ['briefe', 'Briefvorlagen', 'Шаблоны писем', 'An die Behörde schreiben – zum Kopieren'],
       ['installieren', 'Als App installieren', 'Установить как приложение', 'Anleitung für iPhone, iPad und Android'],
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
      ${reveal && q.e ? `<div class="tip" style="margin-top:12px"><b>Warum?</b> ${esc(q.e[0])}${ru(q.e[1])}</div>` : ''}
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
        <div class="small"><b style="color:var(--ok)">✓ ${esc(q.o[q.a])}</b>${q.ruo && q.ruo[q.a] !== q.o[q.a] ? ru(q.ruo[q.a]) : ''}</div>${q.e ? `<div class="tip">${esc(q.e[0])}${ru(q.e[1])}</div>` : ''}</div>`).join('') || '<p class="muted">Keine Treffer.</p>';
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
  const next = D.kurs.find(l => !S.kurs[l.id]?.done);
  render(`<h1>Deutschkurs A1 – B1</h1>
    <p class="muted">30 Lektionen mit Grammatik, Wortschatz (mit Sprachausgabe), Dialogen und Übungen – alle Erklärungen auch auf Russisch. Ziel: das B1-Zertifikat für die Einbürgerung.${ru('30 уроков с грамматикой, словами (с озвучкой), диалогами и упражнениями — все объяснения также на русском. Цель: сертификат B1 для натурализации.')}</p>
    <div class="grid two" style="margin-bottom:8px">
      <a class="tile" href="#vokabeln"><h3>Vokabeltrainer</h3><div class="meta">${D.vok.length} Wörter · ${vokDue} heute fällig</div><span class="arrow">›</span></a>
      <a class="tile" href="#dtz"><h3>B1-Prüfung (DTZ) üben</h3><div class="meta">Hören, Lesen, Schreiben, Sprechen</div><span class="arrow">›</span></a>
    </div>
    ${next ? `<a class="btn primary block" style="margin:6px 0 4px" href="#lektion--${next.id}">Weiter mit ${next.lv}.${D.kurs.filter(l => l.lv === next.lv).indexOf(next) + 1}: ${esc(next.t)}</a>` : ''}
    ${lvls.map(lv => {
      const ls = D.kurs.filter(l => l.lv === lv); const d = ls.filter(l => S.kurs[l.id]?.done).length;
      return `<details class="level"><summary><span class="lv">Niveau ${lv}</span><span class="badge ${d === ls.length ? 'ok' : ''}">${d}/${ls.length}</span><span class="spacer"></span><span class="chev" aria-hidden="true">›</span></summary>
      <div class="grid two" style="margin-top:12px">${ls.map((l, k) => {
        const st = S.kurs[l.id];
        return `<a class="tile" href="#lektion--${l.id}"><div class="meta">${lv}.${k + 1}</div><h3>${esc(l.t)}</h3>${ru(l.ru)}<div class="meta" style="margin-top:6px">${st?.done ? `<span class="badge ok">✓ geschafft · ${st.best}%</span>` : st ? `<span class="badge warn">${st.best}% – nochmal üben</span>` : esc(l.gr.t)}</div></a>`;
      }).join('')}</div></details>`;
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
  if ((part === 'hoeren' || part === 'lesen') && id) return dtzAufgabe(part, id);
  const done = S.dtzDone || {};
  const tiles = (arr, part, meta) => arr.map(x => `<a class="tile" href="#dtz--${part}--${x.id}"><h3>${esc(x.t)}</h3>${ru(x.ru)}<div class="meta">${done[x.id] != null ? `<span class="badge ${done[x.id] === x.q.length ? 'ok' : 'warn'}">${done[x.id]}/${x.q.length} richtig</span>` : meta}</div><span class="arrow">›</span></a>`).join('');
  render(`${back('#kurs', 'Kurs')}<h1>B1-Prüfung (DTZ)</h1><p>${esc(D.dtz.info.de)}</p><p class="ru" lang="ru">${esc(D.dtz.info.ru)}</p>
    <h2 style="margin-top:20px">Hören</h2>${ru('Аудирование')}<div class="grid two" style="margin-top:8px">${tiles(D.dtz.hoeren, 'hoeren', 'Anhören und Fragen beantworten')}</div>
    <h2 style="margin-top:20px">Lesen</h2>${ru('Чтение')}<div class="grid two" style="margin-top:8px">${tiles(D.dtz.lesen, 'lesen', 'Text lesen und Fragen beantworten')}</div>
    <h2 style="margin-top:20px">Schreiben</h2><div class="grid two">${D.dtz.schreiben.map(w => `<a class="tile" href="#dtz--schreiben--${w.id}"><h3>${esc(w.t)}</h3>${ru(w.ru)}<div class="meta">4 Leitpunkte · mit Musterlösung</div><span class="arrow">›</span></a>`).join('')}</div>
    <h2 style="margin-top:20px">Sprechen</h2>
    ${D.dtz.sprechen.map(s => `<div class="card"><h3>${esc(s.t)}</h3>${ru(s.ru)}<ul class="list" style="margin-top:8px">${s.fragen.map(f => `<li class="vok"><span>${esc(f)}</span>${speakBtn(f)}</li>`).join('')}</ul></div>`).join('')}
    <div class="notice">Tipp: Nimm deine Antworten mit dem Handy auf und hör sie dir an. Sprich in ganzen Sätzen und benutze weil, deshalb, außerdem.</div>`);
  $app.onclick = e => { const t = e.target.closest('[data-act="speak"]'); if (t) speak(t.dataset.t); };
  cleanup = () => { $app.onclick = null; };
}

function dtzAufgabe(part, id) {
  const x = D.dtz[part].find(y => y.id === id); if (!x) return dtz();
  const ans = Array(x.q.length).fill(null);
  let showText = part === 'lesen', plays = 0;
  function draw() {
    const checked = ans.every(a => a !== null);
    render(`${back('#dtz', 'B1-Prüfung')}<div class="muted small">${part === 'hoeren' ? 'Hören' : 'Lesen'}</div><h1>${esc(x.t)}</h1>${ru(x.ru)}
      <div class="card">
        ${part === 'hoeren' ? `<div class="row"><button class="btn primary" data-act="play">${speakIcon.replace('<svg', '<svg width="20" height="20" style="fill:none;stroke:currentColor;stroke-width:2"')} ${plays ? 'Nochmal hören' : 'Anhören'}</button><button class="btn small ghost" data-act="text">${showText ? 'Text ausblenden' : 'Text anzeigen'}</button></div><p class="small muted" style="margin-top:8px">In der Prüfung hörst du jeden Text einmal oder zweimal. Versuche es erst ohne Text.</p>` : ''}
        ${showText ? `<pre class="letter" style="margin-top:12px">${esc(x.text)}</pre>` : ''}
      </div>
      ${x.q.map((q, k) => `<div class="card"><div class="q-text" style="font-size:1em">${k + 1}. ${esc(q.q)}</div><div class="opts">${q.o.map((o, i) => {
        let cls = ''; if (ans[k] !== null) { if (i === q.a) cls = 'right'; else if (i === ans[k]) cls = 'wrong'; }
        return `<button class="opt ${cls}" data-q="${k}" data-i="${i}" ${ans[k] !== null ? 'disabled' : ''}><span class="k">${ABC[i]}</span><span>${esc(o)}</span></button>`; }).join('')}</div></div>`).join('')}
      ${checked ? `<div class="feedback ${ans.every((a, k) => a === x.q[k].a) ? 'ok' : 'bad'}">${ans.filter((a, k) => a === x.q[k].a).length} von ${x.q.length} richtig</div><div class="row end" style="margin-top:12px"><a class="btn primary" href="#dtz">Zur Übersicht</a></div>` : ''}`);
  }
  $app.onclick = e => {
    const t = e.target.closest('[data-act],[data-q]'); if (!t) return;
    if (t.dataset.act === 'play') { plays++; speak(x.text); draw(); }
    else if (t.dataset.act === 'text') { showText = !showText; draw(); }
    else if (t.dataset.q != null) {
      ans[+t.dataset.q] = +t.dataset.i;
      if (ans.every(a => a !== null)) { S.dtzDone = S.dtzDone || {}; S.dtzDone[x.id] = ans.filter((a, k) => a === x.q[k].a).length; save(); }
      const y = window.scrollY; draw(); window.scrollTo(0, y);
    }
  };
  cleanup = () => { $app.onclick = null; };
  draw();
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
    <div class="card"><h2>App installieren</h2><p class="small">Installiert funktioniert alles auch ohne Internet.</p><a class="btn small" href="#installieren">Anleitung für dein Gerät</a></div>
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

/* ---------- Kalenderdatei (.ics) ---------- */
const icsDate = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
function icsFile(events) {
  const esc2 = s => String(s).replace(/[,;\\]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//einbuergerung.micana.de//DE', 'CALSCALE:GREGORIAN'];
  events.forEach((e, k) => {
    lines.push('BEGIN:VEVENT', `UID:eb-${Date.now()}-${k}@einbuergerung.micana.de`, `DTSTAMP:${icsStamp()}`);
    if (e.time) lines.push(`DTSTART:${icsDate(e.start)}T${e.time.replace(':', '')}00`, `DURATION:PT${e.min || 20}M`);
    else lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start)}`);
    if (e.until) lines.push(`RRULE:FREQ=DAILY;UNTIL=${icsDate(e.until)}T235959`);
    lines.push(`SUMMARY:${esc2(e.title)}`);
    if (e.desc) lines.push(`DESCRIPTION:${esc2(e.desc)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(e.title)}`, `TRIGGER:${e.alarm || '-PT0M'}`, 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const daysUntil = s => Math.ceil((new Date(s + 'T00:00') - today()) / DAY);
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/* ---------- Lernplan ---------- */
function planData() {
  const openQ = D.q.filter(q => (S.srs[q.id]?.l || 0) < 4).length;
  const openL = D.kurs.filter(l => !S.kurs[l.id]?.done);
  const r = { openQ, openL: openL.length, nextL: openL[0] };
  if (S.testdate) { r.tDays = daysUntil(S.testdate); r.qPerDay = r.tDays > 0 ? Math.ceil(openQ / Math.max(1, r.tDays - 3)) : openQ; }
  if (S.b1date) { r.bDays = daysUntil(S.b1date); r.lPerWeek = r.bDays > 0 ? Math.ceil(openL.length / Math.max(1, (r.bDays - 14) / 7)) : openL.length; }
  return r;
}
function todayCard() {
  const p = planData();
  if (!S.testdate && !S.b1date) return `<a class="card flat" style="display:block;margin-top:14px;text-decoration:none;color:inherit" href="#plan"><b>Hast du schon einen Prüfungstermin?</b> Dann erstelle deinen Lernplan ›${ru('Есть дата экзамена? Составьте план обучения')}</a>`;
  const parts = [];
  if (S.testdate && p.tDays >= 0) parts.push(p.tDays <= 7 && p.tDays >= 0 ? `Einbürgerungstest in <b>${p.tDays} Tagen</b>: heute eine Prüfungssimulation` : `<b>${Math.min(p.qPerDay, 40)} Testfragen</b> lernen (noch ${p.openQ} offen, Test in ${p.tDays} Tagen)`);
  if (S.b1date && p.bDays >= 0 && p.nextL) parts.push(`Deutsch: diese Woche <b>${p.lPerWeek} Lektion${p.lPerWeek > 1 ? 'en' : ''}</b>, als Nächstes „${esc(p.nextL.t)}“ (Prüfung in ${p.bDays} Tagen)`);
  if (!parts.length) return '';
  return `<div class="card" style="margin-top:14px"><div class="row"><h3 style="margin:0">Heute</h3>${ru('Сегодня')}<span class="spacer"></span><a class="small" href="#plan">Plan ändern</a></div><ul class="list">${parts.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="row">${S.testdate ? `<a class="btn small primary" href="${p.tDays <= 7 ? '#pruefung' : '#lernen'}">${p.tDays <= 7 ? 'Simulation starten' : 'Fragen lernen'}</a>` : ''}${S.b1date && p.nextL ? `<a class="btn small" href="#lektion--${p.nextL.id}">Lektion öffnen</a>` : ''}</div></div>`;
}
function plan() {
  const p = planData();
  render(`<h1>Mein Lernplan</h1><p class="muted">Trage deine Termine ein. Die App rechnet aus, wie viel du pro Tag bzw. Woche schaffen musst.${ru('Введите даты экзаменов. Приложение рассчитает, сколько нужно проходить в день или в неделю.')}</p>
    <div class="card grid two">
      <div><label class="lbl" for="td">Termin Einbürgerungstest</label><input class="text" type="date" id="td" value="${esc(S.testdate)}"></div>
      <div><label class="lbl" for="bd">Termin B1-Sprachprüfung</label><input class="text" type="date" id="bd" value="${esc(S.b1date)}"></div>
    </div>
    ${S.testdate ? `<div class="card"><h2>Einbürgerungstest</h2>${p.tDays < 0 ? '<p>Der Termin liegt in der Vergangenheit.</p>' : `<dl class="kv"><dt>Noch</dt><dd><b>${p.tDays} Tage</b></dd><dt>Offene Fragen</dt><dd>${p.openQ} von 310</dd><dt>Pro Tag</dt><dd><b>${p.qPerDay} Fragen</b> (die letzten 3 Tage nur Wiederholung)</dd><dt>Letzte Woche</dt><dd>täglich eine Prüfungssimulation, Ziel: sicher über 25 Punkte</dd></dl>`}</div>` : ''}
    ${S.b1date ? `<div class="card"><h2>B1-Prüfung</h2>${p.bDays < 0 ? '<p>Der Termin liegt in der Vergangenheit.</p>' : `<dl class="kv"><dt>Noch</dt><dd><b>${p.bDays} Tage</b></dd><dt>Offene Lektionen</dt><dd>${p.openL} von ${D.kurs.length}</dd><dt>Pro Woche</dt><dd><b>${p.lPerWeek} Lektion${p.lPerWeek > 1 ? 'en' : ''}</b></dd><dt>Letzte 2 Wochen</dt><dd>Hören, Lesen, Schreiben und Sprechen im B1-Bereich üben</dd></dl>${p.bDays < 60 && p.openL > 10 ? '<div class="notice" style="margin:12px 0 0">Das wird knapp. Ein Integrationskurs oder ein späterer Termin kann helfen.</div>' : ''}`}</div>` : ''}
    ${(S.testdate || S.b1date) && !EMBED ? `<div class="card"><h2>Erinnerung im Kalender</h2><p class="small">Lädt einen täglichen Lerntermin in deinen Kalender (iPhone, Android, Outlook). Dein Handy erinnert dich dann jeden Tag.${ru('Добавляет в календарь ежедневное напоминание об учёбе.')}</p>
      <div class="row"><label class="lbl" for="pt" style="margin:0">Uhrzeit</label><input class="text" type="time" id="pt" value="${esc(S.planTime)}" style="width:auto"><button class="btn primary" data-act="ics">Erinnerung hinzufügen</button></div></div>` : ''}`);
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
  cleanup = () => { $app.onclick = null; $app.onchange = null; };
}

/* ---------- Lebenslauf-Generator ---------- */
const CV_TYPES = [
  ['schule', 'Schule'], ['ausbildung', 'Ausbildung'], ['studium', 'Studium'], ['arbeit', 'Arbeit'], ['wehrdienst', 'Wehrdienst'],
  ['ohne', 'Ohne Arbeit / Elternzeit / Pflege'], ['wohnort', 'Wohnort / Umzug'], ['einreise', 'Einreise nach Deutschland'],
  ['heirat', 'Heirat'], ['kind', 'Geburt eines Kindes'], ['kurs', 'Sprach- oder Integrationskurs'], ['sonst', 'Sonstiges']];
const CV_HINT = { schule: ['Schule (z. B. Mittelschule Nr. 5)', 'Ort, Land'], ausbildung: ['Beruf (z. B. Elektriker)', 'Betrieb / Ort'], studium: ['Fach und Hochschule', 'Ort, Land'], arbeit: ['Tätigkeit (z. B. Lagerarbeiter)', 'Firma, Ort'], wehrdienst: ['–', 'Ort, Land'], ohne: ['Grund (z. B. Elternzeit, Arbeitssuche)', 'Ort'], wohnort: ['–', 'Ort'], einreise: ['Grund (z. B. Familiennachzug)', 'erster Wohnort'], heirat: ['Name der Ehepartnerin / des Ehepartners', 'Ort'], kind: ['Name des Kindes', 'Ort'], kurs: ['Kurs (z. B. Integrationskurs)', 'Träger, Ort'], sonst: ['Was? (ganzer Satz möglich)', 'Ort'] };
const ONCE = ['einreise', 'heirat', 'kind'];
function mon(v) { if (!v) return ''; const [y, m] = v.split('-'); return `${MONATE[+m - 1]} ${y}`; }
function cvDefault() { return { name: '', geb: '', ort: '', eltern: '', geschwister: '', entries: [{ typ: 'schule', von: '', bis: '', was: '', wo: '' }], schluss: '' }; }
function cvText(cv) {
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
function cvGaps(cv) {
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
function lebenslauf() {
  if (!S.cv) { S.cv = cvDefault(); save(); }
  const cv = S.cv;
  const field = (k, label, ph, type = 'text') => `<div><label class="lbl" for="cv-${k}">${label}</label><input class="text" id="cv-${k}" data-f="${k}" type="${type}" value="${esc(cv[k])}" placeholder="${esc(ph)}"></div>`;
  render(`<h1>Lebenslauf-Generator</h1>
    <p class="muted">Viele Behörden – z. B. das Landratsamt Pirna, auch für Freital – verlangen einen ausführlichen Lebenslauf als Fließtext auf Deutsch, lückenlos ab der Geburt. Trage deine Stationen ein, die App schreibt den Text.${ru('Многие ведомства — например, Ландратсамт Пирны (и для Фрайталя) — требуют подробную автобиографию на немецком связным текстом, без пробелов с рождения. Введите этапы жизни — приложение напишет текст.')}</p>
    <div class="card grid two">
      ${field('name', 'Vor- und Nachname', 'z. B. Olga Ivanova')}
      ${field('geb', 'Geburtsdatum', '', 'date')}
      ${field('ort', 'Geburtsort und Land', 'z. B. Omsk, Russland')}
      <div style="grid-column:1/-1"><label class="lbl" for="cv-eltern">Eltern (ganzer Satz)</label><input class="text" id="cv-eltern" data-f="eltern" value="${esc(cv.eltern)}" placeholder="z. B. Mein Vater Igor Ivanov war Ingenieur, meine Mutter Elena Ivanova ist Lehrerin."></div>
      <div style="grid-column:1/-1"><label class="lbl" for="cv-geschwister">Geschwister (ganzer Satz, optional)</label><input class="text" id="cv-geschwister" data-f="geschwister" value="${esc(cv.geschwister)}" placeholder="z. B. Ich habe einen älteren Bruder, Pavel, er lebt in Moskau."></div>
    </div>
    <h2>Stationen</h2><p class="small muted">Monat und Jahr genügen. „Bis“ leer lassen, wenn es heute noch so ist.</p>
    <div id="entries">${cv.entries.map((e, k) => `<div class="card flat">
      <div class="row"><select class="text" data-e="${k}" data-k="typ" aria-label="Art der Station" style="flex:1;min-width:0">${CV_TYPES.map(([v, n]) => `<option value="${v}" ${e.typ === v ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn small ghost" data-del="${k}" aria-label="Station löschen">Löschen</button></div>
      <div class="grid two" style="margin-top:10px">
        <div><label class="lbl small" for="e${k}von">${ONCE.includes(e.typ) ? 'Wann' : 'Von'}</label><input class="text" id="e${k}von" type="month" data-e="${k}" data-k="von" value="${esc(e.von)}"></div>
        ${ONCE.includes(e.typ) ? '<div></div>' : `<div><label class="lbl small" for="e${k}bis">Bis</label><input class="text" id="e${k}bis" type="month" data-e="${k}" data-k="bis" value="${esc(e.bis)}"></div>`}
        ${CV_HINT[e.typ][0] !== '–' ? `<div><label class="lbl small" for="e${k}was">Was</label><input class="text" id="e${k}was" data-e="${k}" data-k="was" value="${esc(e.was)}" placeholder="${esc(CV_HINT[e.typ][0])}"></div>` : ''}
        <div><label class="lbl small" for="e${k}wo">Wo</label><input class="text" id="e${k}wo" data-e="${k}" data-k="wo" value="${esc(e.wo)}" placeholder="${esc(CV_HINT[e.typ][1])}"></div>
      </div></div>`).join('')}</div>
    <button class="btn block" data-act="add" style="margin-bottom:16px">+ Station hinzufügen</button>
    <div class="card"><label class="lbl" for="cv-schluss">Abschluss (optional)</label><textarea class="text" id="cv-schluss" data-f="schluss" style="min-height:90px" placeholder="z. B. Ich fühle mich in Deutschland zu Hause und möchte deshalb die deutsche Staatsangehörigkeit annehmen.">${esc(cv.schluss)}</textarea></div>
    <button class="btn primary block" data-act="gen">Lebenslauf erstellen</button>
    <div id="out" style="margin-top:16px"></div>`);
  const rerenderKeep = () => { const y = window.scrollY; lebenslauf(); window.scrollTo(0, y); };
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
        <div class="row" style="margin-top:10px"><button class="btn primary" data-act="copy">Text kopieren</button></div>
        <p class="small muted">Tipp: In ein Textdokument einfügen, Ort, Datum und Unterschrift ergänzen und ausdrucken. Lass den Text am besten noch einmal von jemandem mit gutem Deutsch lesen.</p>`;
      document.getElementById('out').scrollIntoView({ behavior: 'smooth' });
    } else if (t.dataset.act === 'copy') {
      const ta = document.getElementById('cvout');
      try { await navigator.clipboard.writeText(ta.value); toast('Kopiert'); } catch { ta.select(); toast('Text markiert – jetzt kopieren'); }
    }
  };
  cleanup = () => { $app.onclick = null; $app.onchange = null; $app.oninput = null; };
}

/* ---------- Kostenrechner ---------- */
function kosten() {
  const K = S.kosten || (S.kosten = { erw: 1, kind: 0, kindAllein: 0, testPers: 1, testPreis: 25, b1Pers: 1, b1Preis: 150, uebers: 3, uebersPreis: 50, apost: 0, apostPreis: 0, sonst: 0 });
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
  const num = (k, label, step = 1) => `<div><label class="lbl small" for="k-${k}">${label}</label><input class="text" type="number" inputmode="decimal" min="0" step="${step}" id="k-${k}" data-k="${k}" value="${K[k]}"></div>`;
  render(`<h1>Kostenrechner</h1><p class="muted">Was kostet die Einbürgerung für deine Familie? Die Gebühren der Behörde sind gesetzlich festgelegt, alles andere sind Schätzwerte – trage deine echten Preise ein.${ru('Сколько стоит натурализация для вашей семьи? Сборы ведомства установлены законом, остальное — оценки: впишите реальные цены.')}</p>
    <div class="card"><h2>Personen</h2><div class="grid three">${num('erw', 'Erwachsene (ab 16)')}${num('kind', 'Kinder mit Eltern')}${num('kindAllein', 'Kinder allein')}</div></div>
    <div class="card"><h2>Prüfungen</h2><div class="grid two">${num('testPers', 'Personen Einbürgerungstest')}${num('testPreis', 'Preis Test (€)')}${num('b1Pers', 'Personen B1-Prüfung')}${num('b1Preis', 'Preis B1-Prüfung (€)', 5)}</div>
      <p class="small muted">Wer einen deutschen Schulabschluss hat, braucht weder Test noch Sprachprüfung. Im Integrationskurs ist die Prüfung oft schon enthalten.</p></div>
    <div class="card"><h2>Unterlagen</h2><div class="grid two">${num('uebers', 'Anzahl Übersetzungen')}${num('uebersPreis', 'Preis pro Übersetzung (€)', 5)}${num('apost', 'Anzahl Apostillen')}${num('apostPreis', 'Preis pro Apostille (€)', 5)}${num('sonst', 'Sonstiges gesamt (€)', 5)}</div></div>
    <div class="card" id="sum"></div>
    <p class="small muted">Bei geringem Einkommen kann die Behörde die Gebühr ermäßigen oder Ratenzahlung erlauben. Die Gebühr für die Einbürgerung wird meist erst mit dem Gebührenbescheid fällig. Nach der Einbürgerung kommen noch Personalausweis und Reisepass dazu (Gebühren beim Bürgerbüro).</p>`);
  const drawSum = () => {
    document.getElementById('sum').innerHTML = `<h2>Übersicht</h2><div style="overflow-x:auto"><table class="tbl"><tbody>${rows().filter(r => r[1] * r[2] > 0).map(r => `<tr><td>${esc(r[0])}<div class="small muted">${r[0].startsWith('Sonstiges') ? '' : `${r[1]} × ${r[2]} € · `}${esc(r[3])}</div></td><td class="num">${(r[1] * r[2]).toLocaleString('de-DE')} €</td></tr>`).join('')}</tbody><tfoot><tr><td><b>Gesamt</b></td><td class="num"><b>${sum().toLocaleString('de-DE')} €</b></td></tr></tfoot></table></div>`;
  };
  $app.oninput = e => { const k = e.target.dataset.k; if (k) { K[k] = Math.max(0, parseFloat(e.target.value) || 0); if (k === 'erw') { K.testPers = K.erw; K.b1Pers = K.erw; document.getElementById('k-testPers').value = K.erw; document.getElementById('k-b1Pers').value = K.erw; } save(); drawSum(); } };
  cleanup = () => { $app.oninput = null; };
  drawSum();
}

/* ---------- Ablaufdaten ---------- */
function fristStatus(d) { if (!d) return null; const n = daysUntil(d); return n < 0 ? 'r' : n < 180 ? 'y' : 'g'; }
function fristWarnings() {
  const w = (S.fristen || []).filter(f => ['r', 'y'].includes(fristStatus(f.d)));
  if (!w.length) return '';
  return `<a class="notice" href="#fristen" style="display:block;margin-top:14px;text-decoration:none;color:inherit">${w.map(f => { const n = daysUntil(f.d); return `<div><b>${esc(f.t)}</b> ${n < 0 ? 'ist abgelaufen!' : `läuft in ${n} Tagen ab (${fmtDate(new Date(f.d + 'T00:00'))}).`}</div>`; }).join('')}<div class="small" style="margin-top:4px">Rechtzeitig verlängern – sonst kann sich das Verfahren verzögern. ›</div></a>`;
}
function fristen() {
  const F = S.fristen;
  render(`<h1>Ablaufdaten</h1><p class="muted">Pass und Aufenthaltstitel müssen während des ganzen Verfahrens gültig sein. Trage die Daten ein – die App warnt dich 6 Monate vorher.${ru('Паспорт и вид на жительство должны быть действительны всё время процедуры. Введите даты — приложение предупредит за 6 месяцев.')}</p>
    <div class="card"><ul class="list">${F.map((f, k) => { const st = fristStatus(f.d); const n = f.d ? daysUntil(f.d) : null;
      return `<li><div class="row"><span class="ampel ${st || ''}" style="${st ? '' : 'background:var(--line)'}"></span><input class="text" data-t="${k}" value="${esc(f.t)}" aria-label="Bezeichnung" style="flex:1;min-width:0">${k > 1 ? `<button class="btn small ghost" data-del="${k}">Löschen</button>` : ''}</div>
        <div class="row" style="margin-top:8px"><label class="lbl small" for="fd${k}" style="margin:0">gültig bis</label><input class="text" type="date" id="fd${k}" data-d="${k}" value="${esc(f.d)}" style="flex:1;min-width:0"></div>
        ${n != null ? `<div class="small" style="margin-top:6px">${n < 0 ? `<b style="color:var(--bad)">Abgelaufen seit ${-n} Tagen – sofort verlängern!</b>` : n < 180 ? `<b style="color:var(--warn)">Noch ${n} Tage – jetzt Verlängerung beantragen.</b>` : `Noch ${n} Tage gültig.`}</div>` : ''}</li>`; }).join('')}</ul>
      <button class="btn small" data-act="add">+ Weiteres Dokument</button></div>
    ${(() => { const ab = S.amt && D.amt.behoerden.find(b => b.id === S.amt)?.extra?.find(x => x.name.startsWith('Ausländerbehörde')); return `<div class="notice">Den Aufenthaltstitel verlängert die Ausländerbehörde${ab ? ` (${esc(ab.adresse)}, Tel. ${esc(ab.tel)})` : ' deines Landkreises bzw. deiner Stadt'}. Den Pass verlängert die Botschaft oder das Konsulat deines Herkunftslands – das dauert oft Monate.</div>`; })()}
    ${!EMBED && F.some(f => f.d) ? `<div class="card"><h2>Erinnerung im Kalender</h2><p class="small">Legt für jedes Dokument eine Erinnerung 6 Monate und 1 Monat vor Ablauf an.</p><button class="btn primary" data-act="ics">Erinnerungen hinzufügen</button></div>` : ''}`);
  $app.onchange = e => {
    const t = e.target;
    if (t.dataset.d != null) { F[+t.dataset.d].d = t.value; save(); fristen(); }
    if (t.dataset.t != null) { F[+t.dataset.t].t = t.value; save(); }
  };
  $app.onclick = e => {
    const t = e.target.closest('[data-act],[data-del]'); if (!t) return;
    if (t.dataset.del != null) { F.splice(+t.dataset.del, 1); save(); fristen(); }
    else if (t.dataset.act === 'add') { F.push({ id: 'x' + Date.now(), t: 'Neues Dokument', d: '' }); save(); fristen(); }
    else if (t.dataset.act === 'ics') {
      const ev = [];
      F.filter(f => f.d).forEach(f => {
        const end = new Date(f.d + 'T00:00');
        [[180, '6 Monate'], [30, '1 Monat']].forEach(([d, l]) => { const s = new Date(end - d * DAY); if (s > new Date()) ev.push({ title: `${f.t} läuft in ${l} ab`, desc: `Gültig bis ${fmtDate(end)}. Jetzt Verlängerung beantragen.`, start: s, alarm: 'PT9H' }); });
      });
      if (!ev.length) return toast('Alle Termine liegen schon in der Vergangenheit.');
      download('ablaufdaten.ics', icsFile(ev), 'text/calendar'); toast('Kalenderdatei erstellt – bitte öffnen und hinzufügen');
    }
  };
  cleanup = () => { $app.onclick = null; $app.onchange = null; };
}

/* ---------- Als App installieren ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; document.querySelectorAll('[data-act="native-install"]').forEach(b => b.hidden = false); });
window.addEventListener('appinstalled', () => { S.installSeen = true; save(); toast('App installiert'); closeSheet(); });
function platform() {
  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inapp = /Instagram|FBAN|FBAV|Line\/|Telegram|WhatsApp|TikTok|; wv\)/i.test(ua);
  let browser = 'other';
  if (inapp) browser = 'inapp';
  else if (ios) browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /Safari/.test(ua) ? 'safari' : 'other';
  else if (android) browser = /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox' : /EdgA/.test(ua) ? 'edge' : /OPR|Opera/.test(ua) ? 'opera' : /Chrome/.test(ua) ? 'chrome' : 'other';
  else browser = /Edg\//.test(ua) ? 'edge' : /Chrome/.test(ua) ? 'chrome' : /Firefox/.test(ua) ? 'firefox' : /Safari/.test(ua) ? 'safari' : 'other';
  return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, standalone };
}
const SHARE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:-3px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/></svg>';
function installSteps(os, browser) {
  const I = {
    'ios-safari': ['Unten (iPhone) bzw. oben (iPad) auf das Teilen-Symbol ' + SHARE_ICON + ' tippen.', 'Nach unten scrollen und „Zum Home-Bildschirm“ wählen.', 'Oben rechts auf „Hinzufügen“ tippen.'],
    'ios-chrome': ['Oben rechts in der Adresszeile auf das Teilen-Symbol ' + SHARE_ICON + ' tippen.', '„Zum Home-Bildschirm“ wählen (eventuell erst „Mehr“ antippen).', 'Auf „Hinzufügen“ tippen.'],
    'ios-firefox': ['Unten rechts auf das Menü ☰ tippen.', '„Teilen“ wählen, dann „Zum Home-Bildschirm“.', 'Auf „Hinzufügen“ tippen.'],
    'ios-edge': ['Unten auf das Menü ⋯ tippen, dann auf „Teilen“ ' + SHARE_ICON + '.', '„Zum Home-Bildschirm“ wählen.', 'Auf „Hinzufügen“ tippen.'],
    'ios-other': ['Öffne diese Seite in Safari (Adresse kopieren und in Safari einfügen).', 'Dann Teilen ' + SHARE_ICON + ' → „Zum Home-Bildschirm“ → „Hinzufügen“.'],
    'android-chrome': ['Oben rechts auf das Menü ⋮ tippen.', '„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.', 'Mit „Installieren“ bestätigen.'],
    'android-samsung': ['Unten rechts auf das Menü ☰ tippen.', '„Seite hinzufügen zu“ wählen, dann „Startbildschirm“.', 'Mit „Hinzufügen“ bestätigen.'],
    'android-firefox': ['Auf das Menü ⋮ tippen.', '„Installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.', 'Mit „Hinzufügen“ bestätigen.'],
    'android-edge': ['Unten auf das Menü ⋯ tippen.', '„Zum Telefon hinzufügen“ bzw. „App installieren“ wählen.', 'Bestätigen.'],
    'android-opera': ['Auf das Menü ⋮ tippen.', '„Zum Startbildschirm hinzufügen“ wählen.', 'Bestätigen.'],
    'android-other': ['Öffne diese Seite am besten in Chrome.', 'Menü ⋮ → „App installieren“.'],
    'inapp': ['Du hast die Seite aus einer App (z. B. Instagram oder WhatsApp) geöffnet. Von dort kann man nichts installieren.', 'Tippe oben rechts auf ⋯ bzw. ⋮ und wähle „Im Browser öffnen“.', 'Dann erscheint die passende Anleitung.'],
    'desktop-chrome': ['Rechts in der Adresszeile auf das Installieren-Symbol (Bildschirm mit Pfeil) klicken.', '„Installieren“ bestätigen.', 'Noch praktischer: diese Seite am Handy öffnen.'],
    'desktop-edge': ['Rechts in der Adresszeile auf „App verfügbar“ klicken.', '„Installieren“ bestätigen.'],
    'desktop-safari': ['Im Menü „Ablage“ → „Zum Dock hinzufügen“ wählen.'],
    'desktop-other': ['Am besten öffnest du die Seite auf deinem Smartphone: einbuergerung.micana.de']
  };
  return I[browser === 'inapp' ? 'inapp' : `${os}-${browser}`] || I[`${os}-other`] || I['desktop-other'];
}
const OS_NAME = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Computer' };
const BR_NAME = { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', samsung: 'Samsung Internet', opera: 'Opera', inapp: 'In-App-Browser', other: 'Browser' };
function installGuide(os, browser, compact) {
  return `<p class="small muted">Erkannt: ${OS_NAME[os]} · ${BR_NAME[browser]}</p>
    <button class="btn primary block" data-act="native-install" ${deferredPrompt ? '' : 'hidden'} style="margin-bottom:12px">Jetzt installieren</button>
    <ol class="steps">${installSteps(os, browser).map(s => `<li>${s}</li>`).join('')}</ol>
    ${compact ? '' : '<p class="small">Danach findest du „Einbürgerung“ als Symbol auf dem Startbildschirm. Die App startet ohne Adresszeile und funktioniert auch offline.</p>'}`;
}
async function nativeInstall() { if (!deferredPrompt) return; deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; if (r.outcome === 'accepted') { S.installSeen = true; save(); closeSheet(); } }
function installieren() {
  const p = platform();
  render(`<h1>Als App installieren</h1>${ru('Установить как приложение')}
    ${p.standalone ? '<div class="notice ok" style="margin-top:12px">Die App ist bereits installiert. 👍</div>' : ''}
    <div class="card" style="margin-top:14px"><h2>Dein Gerät</h2>${installGuide(p.os, p.browser)}</div>
    <h2>Andere Geräte</h2>
    ${[['ios', 'safari'], ['ios', 'chrome'], ['android', 'chrome'], ['android', 'samsung'], ['android', 'firefox']].filter(([o, b]) => !(o === p.os && b === p.browser)).map(([o, b]) => `<details class="level"><summary><span>${OS_NAME[o]} · ${BR_NAME[b]}</span><span class="spacer"></span><span class="chev">›</span></summary><ol class="steps" style="margin-top:12px">${installSteps(o, b).map(s => `<li>${s}</li>`).join('')}</ol></details>`).join('')}`);
  $app.onclick = e => { if (e.target.closest('[data-act="native-install"]')) nativeInstall(); };
  cleanup = () => { $app.onclick = null; };
}
function closeSheet() { document.getElementById('sheet')?.remove(); }
function maybeInstallSheet() {
  const p = platform();
  let later = false; try { later = !!sessionStorage.getItem('eb.sheetLater'); } catch {}
  if (p.standalone || EMBED || S.installSeen || later) return;
  const el = document.createElement('div');
  el.id = 'sheet'; el.className = 'sheet-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'sheet-h');
  el.innerHTML = `<div class="sheet"><h2 id="sheet-h">Als App speichern</h2><p class="small">So hast du die App immer auf dem Startbildschirm – auch ohne Internet.${ru('Так приложение всегда будет на главном экране — даже без интернета.')}</p>${installGuide(p.os, p.browser, true)}
    <div class="row" style="margin-top:6px"><button class="btn ghost" data-sheet="later">Später</button><span class="spacer"></span><button class="btn primary" data-sheet="ok">Verstanden</button></div></div>`;
  document.body.appendChild(el);
  el.onclick = e => {
    const t = e.target;
    if (t.closest('[data-act="native-install"]')) return nativeInstall();
    const a = t.closest('[data-sheet]')?.dataset.sheet;
    if (a === 'ok') { S.installSeen = true; save(); closeSheet(); }
    else if (a === 'later' || t === el) { try { sessionStorage.setItem('eb.sheetLater', '1'); } catch {} closeSheet(); }
  };
  el.querySelector('[data-sheet="ok"]').focus();
}

/* ---------- Start ---------- */
boot().catch(err => { console.error(err); $app.innerHTML = '<div class="wrap"><div class="card"><h2>Die Daten konnten nicht geladen werden.</h2><p>Bitte Seite neu laden. Beim ersten Öffnen ist eine Internetverbindung nötig.</p></div></div>'; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
