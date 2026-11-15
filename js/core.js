// Grundlagen: Seitencontainer, kleine Helfer, Datum, Download, Kalenderdatei

// Einbürgerung Sachsen – Lern-App (PWA). Vanilla JS, keine Abhängigkeiten.
export const VERSION = '1.6.0';
export const $app = document.getElementById('app');
export const DAY = 86400000;
/* Lernaktivität: Tagesziel und Lerntage am Stück */
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const fmtDate = t => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
export const bar = p => `<div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
export const back = (href, label = 'Zurück') => `<a class="back no-print" href="${href}">‹ ${label}</a>`;
export const ABC = ['A', 'B', 'C', 'D'];
export const EMBED = (() => { try { return window.self !== window.top; } catch { return true; } })();
 // in eingebetteter Vorschau kein Drucken/Download
export function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), msg.length > 60 ? 4500 : 2200); }
export const APP_URL = 'https://einbuergerung.micana.de/';
export const icsDate = d => dayKey(d.getTime()).replace(/-/g, '');
 // lokales Datum, nicht UTC
export const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
export function icsFile(events) {
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
export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const daysUntil = s => Math.round((new Date(s + 'T00:00') - today()) / DAY);
 // round: Zeitumstellung
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
