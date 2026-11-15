// Als App installieren: Hinweise je Gerät, einmaliger Vollbild-Hinweis, Balken „App nicht installiert“
import { $app, APP_URL, EMBED, esc, toast } from './core.js';
import { HL, LANG, dirAttr, hl, ru, setLang, tr } from './i18n.js';
import { render, route } from './router.js';
import { S, save } from './store.js';

/* Als App installieren
   Handy/Tablet im Browser: beim ersten Mal ein Vollbild-Hinweis „Zuerst installieren“, danach nur ein Balken oben. */
export let deferredPrompt = null, appInstalled = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; document.querySelectorAll('[data-act="native-install"]').forEach(b => b.hidden = false); });
window.addEventListener('appinstalled', () => { appInstalled = true; S.installSeen = true; save(); toast('App installiert'); closeSheet(); if (document.getElementById('gate')) installGate(true); });
export function platform() {
  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
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
export const SHARE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:-3px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/></svg>';
// Schritte je Gerät: [Deutsch, Hilfssprache]; {S} = Teilen-Symbol
export function installSteps(os, browser) {
  const add = ['Auf „Hinzufügen“ tippen.', 'ui.tap-add'];
  const menu = ['Auf das Menü ⋮ tippen.', 'ui.tap-the-menu'];
  const ok = ['Bestätigen.', 'ui.confirm'];
  const I = {
    'ios-safari': [['Unten (iPhone) bzw. oben (iPad) auf das Teilen-Symbol {S} tippen.', 'ui.tap-the-share-icon-s-at-the-bottom-i'], ['Nach unten scrollen und „Zum Home-Bildschirm“ wählen.', 'ui.scroll-down-and-choose-add-to-home-s'], ['Oben rechts auf „Hinzufügen“ tippen.', 'ui.tap-add-at-the-top-right']],
    'ios-chrome': [['Oben rechts in der Adresszeile auf das Teilen-Symbol {S} tippen.', 'ui.tap-the-share-icon-s-on-the-right-of'], ['„Zum Home-Bildschirm“ wählen (eventuell erst „Mehr“ antippen).', 'ui.choose-add-to-home-screen-you-may-ne'], add],
    'ios-firefox': [['Unten rechts auf das Menü ☰ tippen.', 'ui.tap-the-menu-at-the-bottom-right'], ['„Teilen“ wählen, dann „Zum Home-Bildschirm“.', 'ui.choose-share-then-add-to-home-screen'], add],
    'ios-edge': [['Unten auf das Menü ⋯ tippen, dann auf „Teilen“ {S}.', 'ui.tap-the-menu-at-the-bottom-then-shar'], ['„Zum Home-Bildschirm“ wählen.', 'ui.choose-add-to-home-screen-2'], add],
    'ios-other': [['Öffne diese Seite in Safari (Adresse kopieren und in Safari einfügen).', 'ui.open-this-page-in-safari-copy-the-ad'], ['Dann Teilen {S} → „Zum Home-Bildschirm“ → „Hinzufügen“.', 'ui.then-share-s-add-to-home-screen-add']],
    'android-chrome': [['Oben rechts auf das Menü ⋮ tippen.', 'ui.tap-the-menu-at-the-top-right'], ['„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.', 'ui.choose-install-app-or-add-to-home-sc'], ['Mit „Installieren“ bestätigen.', 'ui.confirm-with-install']],
    'android-samsung': [['Unten rechts auf das Menü ☰ tippen.', 'ui.tap-the-menu-at-the-bottom-right'], ['„Seite hinzufügen zu“ wählen, dann „Startbildschirm“.', 'ui.choose-add-page-to-then-home-screen'], ['Mit „Hinzufügen“ bestätigen.', 'ui.confirm-with-add']],
    'android-firefox': [menu, ['„Installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.', 'ui.choose-install-or-add-to-home-screen'], ['Mit „Hinzufügen“ bestätigen.', 'ui.confirm-with-add']],
    'android-edge': [['Unten auf das Menü ⋯ tippen.', 'ui.tap-the-menu-at-the-bottom'], ['„Zum Telefon hinzufügen“ bzw. „App installieren“ wählen.', 'ui.choose-add-to-phone-or-install-app'], ok],
    'android-opera': [menu, ['„Zum Startbildschirm hinzufügen“ wählen.', 'ui.choose-add-to-home-screen'], ok],
    'android-other': [['Öffne diese Seite am besten in Chrome.', 'ui.better-to-open-this-page-in-chrome'], ['Menü ⋮ → „App installieren“.', 'ui.menu-install-app']],
    'inapp': [['Du hast die Seite aus einer App (z. B. WhatsApp oder Telegram) geöffnet. Von dort kann man nichts installieren.', 'ui.you-opened-this-page-from-an-app-e-g'], ['Tippe oben rechts auf ⋯ bzw. ⋮ und wähle „Im Browser öffnen“.', 'ui.tap-or-at-the-top-right-and-choose-o'], ['Dann erscheint die passende Anleitung.', 'ui.then-the-right-instructions-will-app']],
    'desktop-chrome': [['Rechts in der Adresszeile auf das Installieren-Symbol (Bildschirm mit Pfeil) klicken.', 'ui.click-the-install-icon-screen-with-a'], ['„Installieren“ bestätigen.', 'ui.confirm-install'], ['Noch praktischer: diese Seite am Handy öffnen.', 'ui.even-better-open-this-page-on-your-p']],
    'desktop-edge': [['Rechts in der Adresszeile auf „App verfügbar“ klicken.', 'ui.click-app-available-on-the-right-of'], ['„Installieren“ bestätigen.', 'ui.confirm-install']],
    'desktop-safari': [['Im Menü „Ablage“ → „Zum Dock hinzufügen“ wählen.', 'ui.in-the-file-menu-choose-add-to-dock']],
    'desktop-other': [['Am besten öffnest du die Seite auf deinem Smartphone: einbuergerung.micana.de', 'ui.it-is-best-to-open-the-page-on-your']]
  };
  return I[browser === 'inapp' ? 'inapp' : `${os}-${browser}`] || I[`${os}-other`] || I['desktop-other'];
}
export const withIcon = h => h.replace(/\{S\}/g, SHARE_ICON);
export const ruStep = r => { const x = tr(r); return x && hl() ? `<span class="ru" lang="${hl()}"${dirAttr(hl())}>${withIcon(esc(x))}</span>` : ''; };
export const stepList = steps => `<ol class="steps">${steps.map(([d, r]) => `<li>${withIcon(esc(d))}${ruStep(r)}</li>`).join('')}</ol>`;
export const OS_NAME = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Computer' };
export const BR_NAME = { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', samsung: 'Samsung Internet', opera: 'Opera', inapp: 'In-App-Browser', other: 'Browser' };
export function installGuide(os, browser, compact) {
  return `<p class="small muted">Erkannt: ${OS_NAME[os]} · ${BR_NAME[browser]}</p>
    <button class="btn primary block mb" data-act="native-install" ${deferredPrompt ? '' : 'hidden'}>Jetzt installieren</button>
    ${stepList(installSteps(os, browser))}
    ${compact ? '' : `<p class="small">Danach findest du „Einbürgerung“ als Symbol auf dem Startbildschirm. Die App startet ohne Adresszeile und funktioniert auch offline.${ru('ui.afterwards-you-will-find-the-einb-rg')}</p>`}`;
}
export async function nativeInstall() { if (!deferredPrompt) return; deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; if (r.outcome === 'accepted') { appInstalled = true; S.installSeen = true; save(); closeSheet(); if (document.getElementById('gate')) installGate(true); } }
export function installieren() {
  const p = platform();
  render(`<h1>Als App installieren</h1>${ru('ui.install-as-an-app')}
    ${p.standalone ? '<div class="notice ok mt">Die App ist bereits installiert. 👍</div>' : ''}
    <div class="card mt"><h2>Dein Gerät</h2>${installGuide(p.os, p.browser)}</div>
    <h2>Andere Geräte</h2>
    ${[['ios', 'safari'], ['ios', 'chrome'], ['android', 'chrome'], ['android', 'samsung'], ['android', 'firefox']].filter(([o, b]) => !(o === p.os && b === p.browser)).map(([o, b]) => `<details class="level"><summary><span>${OS_NAME[o]} · ${BR_NAME[b]}</span><span class="spacer"></span><span class="chev">›</span></summary><div class="mt">${stepList(installSteps(o, b))}</div></details>`).join('')}`);
  $app.onclick = e => { if (e.target.closest('[data-act="native-install"]')) nativeInstall(); };
}
export function closeSheet() { document.getElementById('sheet')?.remove(); }
// Einmal „im Browser weiter“ gewählt → kein Vollbild-Hinweis mehr, nur noch der Balken oben
export const GATE_KEY = 'eb.gateSkip';
export const gateSkipped = () => { try { return !!localStorage.getItem(GATE_KEY); } catch { return false; } };
// Prüft (Chrome/Android), ob die App schon installiert ist – dann soll man sie öffnen statt im Browser weiterzumachen
export async function detectInstalled() {
  try { const apps = await navigator.getInstalledRelatedApps?.(); if (apps && apps.length) appInstalled = true; } catch {}
  return appInstalled;
}
export function installGate(force) {
  const p = platform();
  const mobile = p.os !== 'desktop';
  document.getElementById('nag')?.remove(); document.body.classList.remove('nagged');
  if (p.standalone || EMBED) { document.getElementById('gate')?.remove(); return; }
  if (!mobile) return desktopSheet(p);
  if (!force && gateSkipped()) { document.getElementById('gate')?.remove(); return nag(p); }
  const draw = () => {
    let el = document.getElementById('gate');
    if (!el) { el = document.createElement('div'); el.id = 'gate'; el.className = 'gate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'gate-h'); document.body.appendChild(el); }
    const H = hl() || 'de';
    el.innerHTML = `<div class="gate-in">
      <div class="gate-top"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor"/><path d="M10 16.5l4 4 8-9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Einbürgerung <small>Sachsen</small></b><span class="spacer"></span>
        <label class="gate-lang"><span class="sr">Sprache · Language</span><select data-glang aria-label="Sprache · Language">${[...HL, 'de'].map(l => `<option value="${l}" ${H === l ? 'selected' : ''} lang="${l}">${l === 'de' ? 'Deutsch' : LANG[l].name}</option>`).join('')}</select></label></div>
      ${appInstalled ? `<h1 id="gate-h">Die App ist installiert</h1>${ru('ui.the-app-is-installed')}
        <div class="notice ok mt">Öffne sie jetzt über das Symbol „Einbürgerung“ auf deinem Startbildschirm. Dieses Browserfenster kannst du schließen.${ru('ui.open-it-now-using-the-einb-rgerung-i')}</div>`
      : `<h1 id="gate-h">Zuerst die App installieren</h1>${ru('ui.install-the-app-first')}
        <div class="card gate-card"><h2>So geht's</h2>${ru('ui.how-it-works')}<div class="mt">${installGuide(p.os, p.browser, true)}</div>
          ${p.browser === 'inapp' || p.browser === 'other' ? `<button class="btn small mt-xs" data-act="copy-url">Adresse kopieren</button>` : ''}</div>
        <ul class="gate-why">
          <li><b>Immer auf dem Startbildschirm</b> – wie eine richtige App.${ru('ui.always-on-your-home-screen-like-a-re')}</li>
          <li><b>Funktioniert ohne Internet</b> – auch unterwegs.${ru('ui.works-without-internet-even-on-the-g')}</li>
          <li><b>Dein Lernstand ist sicherer</b> – der Browser löscht ihn nicht so leicht.${ru('ui.your-progress-is-safer-the-browser-w')}</li>
        </ul>
        ${p.os === 'ios' && p.browser !== 'inapp' ? `<div class="notice">Wichtig auf iPhone und iPad: Was du hier im Browser lernst, wird <b>nicht</b> in die installierte App übernommen. Installiere deshalb jetzt zuerst.${ru('ui.important-on-iphone-and-ipad-what-yo')}</div>` : ''}`}
      <button class="gate-skip" data-act="gate-skip">${appInstalled ? 'Trotzdem im Browser weiter' : 'Ohne Installation im Browser weiter'}${ru(appInstalled ? 'ui.continue-in-the-browser-anyway' : 'ui.continue-in-the-browser-without-inst')}</button>
    </div>`;
  };
  draw();
  document.body.classList.add('gated');
  const el = document.getElementById('gate');
  el.onclick = async e => {
    const t = e.target;
    if (t.closest('[data-act="native-install"]')) return nativeInstall();
    if (t.closest('[data-glang]')) return;
    if (t.closest('[data-act="copy-url"]')) { try { await navigator.clipboard.writeText(APP_URL); toast('Adresse kopiert – im Browser einfügen'); } catch { toast(APP_URL); } return; }
    if (t.closest('[data-act="gate-skip"]')) {
      try { localStorage.setItem(GATE_KEY, String(Date.now())); } catch {}
      el.remove(); document.body.classList.remove('gated'); nag(p); route();
    }
  };
  el.onchange = async e => { const g = e.target.closest('[data-glang]'); if (g && await setLang(g.value)) { draw(); if (!S.onboarded) route(); } };
  if (!force && !appInstalled) detectInstalled().then(x => { if (x && document.getElementById('gate')) draw(); });
  el.querySelector('h1')?.focus?.();
}
// Balken oben, solange die App im Browser läuft
export function nag(p) {
  if (document.getElementById('nag')) return;
  const el = document.createElement('button'); el.id = 'nag'; el.className = 'nag no-print';
  const h = hl() ? tr('ui.app-not-installed') : '';
  el.innerHTML = `<span><b>App nicht installiert</b>${h ? `<span class="ru" lang="${hl()}"${dirAttr(hl())}>${esc(h)}</span>` : ''}</span><span class="go">Installieren ›</span>`;
  el.onclick = () => installGate(true);
  document.body.appendChild(el); document.body.classList.add('nagged');
  document.documentElement.style.setProperty('--nag-h', el.offsetHeight + 'px');
}
// Computer: nur ein Hinweis, einmal
export function desktopSheet(p) {
  let later = false; try { later = !!sessionStorage.getItem('eb.sheetLater'); } catch {}
  if (S.installSeen || later || !S.onboarded || document.getElementById('sheet')) return;
  const el = document.createElement('div');
  el.id = 'sheet'; el.className = 'sheet-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'sheet-h');
  el.innerHTML = `<div class="sheet"><h2 id="sheet-h">Als App speichern</h2><p class="small">So hast du die App immer griffbereit – auch ohne Internet. Am bequemsten lernst du am Handy.${ru('ui.this-way-the-app-is-always-at-hand-e')}</p>${installGuide(p.os, p.browser, true)}
    <div class="row mt-xs"><button class="btn ghost" data-sheet="later">Später</button><span class="spacer"></span><button class="btn primary" data-sheet="ok">Verstanden</button></div></div>`;
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
