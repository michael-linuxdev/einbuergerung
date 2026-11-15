# Einbürgerung Sachsen – Lern-App

Kostenlose, offline-fähige Web-App (PWA) für Smartphone und Tablet, die auf die Einbürgerung in Sachsen vorbereitet. Deutsch steht immer an erster Stelle; alle Erklärungen gibt es zusätzlich auf Russisch, Englisch, Türkisch, Arabisch, Polnisch oder Rumänisch – oder man lernt „Nur Deutsch“.

**Live:** https://einbuergerung.micana.de

## Funktionen
**Hauptbereiche** (untere Leiste bzw. Seitenleiste):
- **Start:** Tagesziel und Lerntage am Stück, Fragen-Fortschritt, „Nächster Schritt“ und der ganze Weg „Schritt für Schritt“ (Antrag und Urkunde selbst abhaken)
- **Test:** alle 310 Fragen (300 allgemein + 10 Sachsen) mit Erklärung zu jeder Antwort, Lernmodus (Wiederholung nach Leitner), Prüfungssimulation (33 Fragen, 60 Min., Abbrechen mit Rückfrage), Fehlertraining, Themen-Statistik, Katalog, Audio-Modus, Wörterbuch zum Antippen, Erfolgsbild. Bedienbar mit Tastatur (1–4 bzw. A–D, Enter, ← →)
- **Deutsch:** 30 Lektionen A1–B1 mit Grammatik, ~400 Wörtern, Dialogen, 150+ Übungen und Sprachausgabe; Vokabeltrainer; B1-Prüfung (DTZ) mit Hören, Lesen, Schreiben, Sprechen
- **Unterlagen** mit Reitern: Checkliste nach Lebenssituation (druckbar) · Mitbringen (Test, B1-Prüfung, Behörde, Urkunde) · Kostenrechner für die Familie · Briefvorlagen
- **Behörden:** Suche nach Ort/PLZ, alle 13 sächsischen Einbürgerungsbehörden, Beratung, Tests, Kurse

**Mehr:** Lernplan mit Kalender-Erinnerung (.ics) · Gespräch bei der Behörde üben · Voraussetzungen & Fristen (Mindestaufenthalt, Ampel-Check nach § 10 StAG, Ablaufdaten von Pass und Aufenthaltstitel mit Kalender-Erinnerung) · Lebenslauf-Generator mit Lückenprüfung · Mein erstes Mal wählen · Einstellungen & Sprache · Familienmodus · Einführung · Installieren · Weiterempfehlen

**Sprachen:** Deutsch steht immer an erster Stelle, dazu eine Hilfssprache (Русский, English, Türkçe, العربية, Polski, Română) oder „Nur Deutsch“. Arabisch wird von rechts nach links gesetzt. Türkisch, Arabisch, Polnisch und Rumänisch sind KI-Übersetzungen und in der App so gekennzeichnet. Vorlese-Knöpfe an Fragen und ganzen Absätzen, dazu unten rechts „Seite vorlesen“ auf Deutsch oder in der Hilfssprache; Nachsprechen mit Mikrofon (Spracherkennung in Chrome/Edge/Safari).

**Erststart:** Sprachauswahl, Einführung in 8 Schritten. Auf Handy und Tablet im Browser einmal eine Vollbild-Anleitung „Zuerst die App installieren“ (passend zu Gerät und Browser, auch für WhatsApp-/Telegram-Browser); danach nur noch ein Balken „App nicht installiert“.

**Speichern:** automatisch in localStorage und IndexedDB, dauerhafter Speicher angefragt, tägliche Sicherungspunkte (7 Tage), Sicherungsdatei (wird beim Laden geprüft, mit Rückfrage und Sicherungspunkt davor). Update-Hinweis „Neue Version verfügbar – jetzt laden“.

**Barrierefreiheit:** Kontraste ≥ 4,5:1, große Tippflächen, Sprung-Link „Zum Inhalt“, Seitentitel, Screenreader-Texte, drei Schriftgrößen, Hell/Dunkel.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten. Fortschritt nur auf dem Gerät (Export/Import möglich). Kein Tracking.

Lokal starten: `python3 -m http.server` und `http://localhost:8000` öffnen.

| Datei | Inhalt |
|---|---|
| `js/main.js` | Start: Daten laden, erste Seite, Update-Hinweis |
| `js/router.js` | Adresse → Seite (`#test`, `#lektion--a1-1--vok` …), Ereignisse je Seite, Hilfen `confirmTap`, `keepScroll`, `onLeave` |
| `js/store.js` | Zustand, Speichern, Profile, Sicherungen, Lernaktivität |
| `js/i18n.js` | Hilfssprachen: `ru(id)`, `ruSay(id)`, `tr(id)` |
| `js/speech.js` | Vorlesen, Spracherkennung, Vorlese-Leiste |
| `js/install.js` | Installationshinweise |
| `js/core.js`, `js/data.js` | Helfer (Datum, Download, Kalenderdatei), geladene Daten |
| `js/views/*.js` | eine Datei je Bereich: `start`, `test`, `kurs`, `docs`, `amt`, `check`, `plan`, `app` |
| `sw.js` | Service Worker (offline) |

**Prüfen vor jedem Release:**
- `python3 tools/i18n-check.py` – fehlt in einer Sprache eine Übersetzung?
- `node tools/e2e.js` – Browser-Test (Erststart, Lernen, Prüfung, Sicherung, Kalender, alle Seiten in allen Sprachen). Braucht Playwright mit Chromium (`npm i -D playwright && npx playwright install chromium`).

## Daten pflegen
| Datei | Inhalt |
|---|---|
| `data/questions.json` | Fragenkatalog (unverändert, BAMF Stand 07.05.2025) + Erklärungen (`e`) |
| `data/behoerden-sn.json` | Einbürgerungsbehörden Sachsen (`stand: "geprüft …"` = einzeln verifiziert) |
| `data/info.json` | Schritte, Voraussetzungs-Check, Unterlagen, Kontakte, Briefe, Mitbring-Listen, Gespräch, Wählen |
| `data/kurs-a1/a2/b1.json` | Deutschkurs |
| `data/dtz.json` | B1-Prüfungsaufgaben (Hören, Lesen, Schreiben, Sprechen) |
| `data/glossar.json` | Wörterbuch: Begriff, Wortformen (`f`), Erklärung |
| `data/i18n/<code>.json` | Hilfssprachen `ru`, `en`, `tr`, `ar`, `pl`, `ro`: feste ID → Text |

**Hilfssprachen:** In den Daten und im Code stehen an den Stellen der Hilfssprache feste IDs, z. B. `"ru": "q.g1"` in einer Frage oder `ru('ui.learn')` im Code. Die Texte dazu stehen in `data/i18n/<code>.json`; eine Sprachdatei wird erst geladen, wenn jemand die Sprache wählt.
- *Text verbessern:* nur den Wert in der Sprachdatei ändern – die anderen Sprachen bleiben unberührt.
- *Neuen Text anlegen:* neue ID im Code bzw. in den Daten + Eintrag in allen sechs Dateien. `python3 tools/i18n-check.py` zeigt, was fehlt.
- *Neue Sprache:* Eintrag in `LANG` und `HL` (`js/i18n.js`), `WELCOME` (`js/views/app.js`), Datei `data/i18n/<code>.json`.

**Weitere Bundesländer:** je Land eine Datei `data/behoerden-<kürzel>.json` im gleichen Schema anlegen und die 10 Landesfragen aus dem BAMF-Katalog ergänzen.

**Nach jeder Änderung** (Code oder Daten) in `sw.js` die Konstante `CACHE` hochzählen und neue Dateien in `ASSETS` eintragen. Code und Daten kommen immer aus demselben Cache, neue Daten also erst nach „Jetzt laden“.

## Quellen & Rechtliches
- Fragen: BAMF – Gesamtfragenkatalog „Leben in Deutschland“/„Einbürgerungstest“ (Anlage 1 EinbTestV), amtliches Werk nach § 5 UrhG, unverändert. Lösungen aus dem BAMF-Online-Testcenter, abgeglichen mit zwei unabhängigen Datensätzen.
- Russische Fragen-Übersetzung: [lezeroq/lebenindeutschland](https://github.com/lezeroq/lebenindeutschland) (MIT).
- Bilder: [JadRizk/einbuergerungstest-trainer](https://github.com/JadRizk/einbuergerungstest-trainer).
- Behördendaten: Websites der Landratsämter und des Freistaates Sachsen (Stand Oktober 2026).
- Schrift: Lora (SIL Open Font License 1.1), unverändert in `fonts/`.

Keine Rechtsberatung. Kein Angebot des BAMF oder einer Behörde.
