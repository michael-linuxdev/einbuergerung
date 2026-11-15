// Browser-Test der Lern-App: Erststart, Fehlerbehebungen, Sprachen, alle Seiten.
// Aufruf im Projektordner:  node tools/e2e.js [Ordner für Screenshots]
// Braucht Playwright mit Chromium (npm i -D playwright && npx playwright install chromium). Startet selbst einen Webserver.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;
const SHOTS = process.argv[2];
let failed = 0;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE', viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (cond, msg) => { if (!cond) failed++; console.log((cond ? 'OK   ' : 'FAIL ') + msg); };

  await p.goto(BASE);
  await p.waitForSelector('[data-lang]');
  ok(await p.locator('.lang').count() === 7, 'Sprachauswahl zeigt 7 Optionen');
  await p.click('[data-lang="de"]'); await p.click('[data-act="weiter"]');
  await p.waitForSelector('[data-act="skip"]'); await p.click('[data-act="skip"]');
  await p.waitForSelector('.hero');
  await p.waitForSelector('[data-sheet="ok"]', { timeout: 3000 }).then(() => p.click('[data-sheet="ok"]')).catch(() => {});
  ok(await p.locator('.next').count() === 1, 'Startseite zeigt „nächster Schritt“');

  const learn = async n => { await p.goto(BASE + '#lernen'); await p.waitForSelector('.opt'); for (let k = 0; k < n; k++) { await p.keyboard.press('1'); await p.waitForSelector('[data-act="next"]'); await p.keyboard.press('Enter'); } };
  const srs = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('eb.v1')).srs || {}).length);
  await learn(5);
  ok(await srs() === 5, 'Tastatur 1 + Enter beantwortet 5 Fragen');

  await p.goto(BASE + '#einstellungen'); await p.waitForSelector('[data-act="reset"]');
  await p.click('[data-act="reset"]'); await p.click('[data-act="reset"]'); await p.waitForTimeout(300);
  ok(await srs() === 0, 'Zurücksetzen löscht Lernstand (vorher Fehler)');

  await learn(3);
  await p.goto(BASE + '#profil'); await p.click('[data-act="add"]'); await p.waitForTimeout(150);
  await p.click('[data-use]'); await p.waitForSelector('.hero');
  ok((await p.textContent('.count')).trim().startsWith('0'), 'Neues Profil startet bei 0 (vorher geerbt)');
  const p2 = await p.evaluate(() => JSON.parse(localStorage.getItem('eb.profiles')).active);
  ok(await p.evaluate(k => Object.keys(JSON.parse(localStorage.getItem('eb.v1.' + k) || '{}').srs || {}).length, p2) === 0, 'Neues Profil speichert keinen fremden Lernstand');

  // ICS lokal
  await p.goto(BASE + '#plan'); await p.waitForSelector('#td');
  await p.fill('#td', '2026-12-10'); await p.dispatchEvent('#td', 'change'); await p.waitForSelector('[data-act="ics"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="ics"]')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  ok(/SUMMARY:Einbürgerungstest/.test(ics) && ics.includes('DTSTART;VALUE=DATE:20261210'), 'Kalender: Testtermin am 10.12. (vorher 09.12.)');

  // Prüfung: Abbrechen mit Rückfrage
  await p.goto(BASE + '#pruefung'); await p.waitForSelector('.opt');
  await p.keyboard.press('2'); await p.click('[data-act="quit"]');
  ok(await p.locator('#quitbox .notice').count() === 1, 'Prüfung abbrechen fragt nach');
  await p.click('[data-act="stay"]');

  // Ungültige Sicherung ablehnen, gültige mit Rückfrage
  await p.goto(BASE + '#einstellungen'); await p.waitForSelector('#imp', { state: 'attached' });
  const tmp = path.join(require('os').tmpdir(), 'eb-bad.json'); fs.writeFileSync(tmp, JSON.stringify({ srs: null, foo: 1 }));
  await p.setInputFiles('#imp', tmp); await p.waitForTimeout(300);
  ok(await p.locator('[data-act="imp-ok"]').count() === 0, 'Ungültige Sicherungsdatei wird abgelehnt');
  const good = await p.evaluate(() => JSON.stringify({ v: 2, created: new Date().toISOString(), profiles: { active: 'p1', list: [{ id: 'p1', name: 'Test' }] }, shared: { lang: 'de', onboarded: true }, own: { p1: { srs: { g1: { l: 4, due: 0 } }, exams: [] } } }));
  fs.writeFileSync(tmp, good); await p.setInputFiles('#imp', tmp); await p.waitForSelector('[data-act="imp-ok"]');
  ok(true, 'Gültige Sicherung zeigt Rückfrage');
  await p.click('[data-act="imp-ok"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('eb.profiles')).list.length) === 1, 'Sicherung geladen, Profile ersetzt');

  // Alle Seiten in jeder Sprache
  const routes = ['start', 'test', 'lernen', 'pruefung', 'katalog', 'kurs', 'lektion--a1-1', 'lektion--a1-1--vok', 'lektion--a1-1--ue', 'vokabeln', 'dtz', 'docs', 'amt', 'check', 'briefe', 'einstellungen', 'mehr', 'plan', 'lebenslauf', 'kosten', 'fristen', 'installieren', 'audio', 'termine', 'glossar', 'profil', 'gespraech', 'waehlen', 'teilen', 'sprache', 'tutorial', 'dtz--schreiben--gibtsnicht', '%E0%A4'];
  for (const l of ['ru', 'en', 'tr', 'ar', 'pl', 'ro', 'de']) {
    await p.goto(BASE + '#sprache'); await p.waitForSelector('[data-lang]');
    await p.click(`[data-lang="${l}"]`); await p.waitForTimeout(250);
    errs.length = 0; let empty = 0;
    for (const r of routes) {
      await p.goto(BASE + '#' + r); await p.waitForTimeout(80);
      if (!(await p.textContent('#app')).trim()) empty++;
    }
    await p.goto(BASE + '#lernen'); await p.waitForSelector('.opt');
    const hlText = l === 'de' ? '' : (await p.locator('.q-text .ru').first().textContent().catch(() => '')).trim();
    ok(!errs.length && !empty && (l === 'de' || hlText.length > 3), `Sprache ${l}: ${routes.length} Seiten ohne Fehler${hlText ? ' · „' + hlText.slice(0, 50) + '“' : ''}${errs.length ? ' · ' + errs.slice(0, 2).join(' ; ') : ''}`);
    if (l === 'ar') ok(await p.locator('.q-text .ru[dir="rtl"]').count() > 0, 'Arabisch wird von rechts nach links gesetzt');
    if (['tr', 'ar'].includes(l) && SHOTS) {
      await p.goto(BASE + '#lernen'); await p.waitForSelector('.opt'); await p.click('.opt[data-i="1"]'); await p.waitForTimeout(200);
      await p.screenshot({ path: `${SHOTS}/lernen-${l}.png`, fullPage: true });
    }
  }
  if (SHOTS) {
    for (const r of ['start', 'mehr', 'sprache']) { await p.goto(BASE + '#' + r); await p.waitForTimeout(250); await p.screenshot({ path: `${SHOTS}/${r}.png`, fullPage: true }); }
  }
  await b.close(); server.close();
  console.log(failed ? `${failed} Prüfung(en) fehlgeschlagen` : 'Alle Prüfungen bestanden');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('FAIL Abbruch: ' + e.message); process.exit(1); });
