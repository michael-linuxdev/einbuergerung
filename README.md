# Einbürgerung Sachsen – Lern-App

Kostenlose, offline-fähige Web-App (PWA) für Smartphone und Tablet, die auf die Einbürgerung in Sachsen vorbereitet. Alle Erklärungen sind zusätzlich auf Russisch verfügbar.

**Live:** https://einbuergerung.micana.de

## Funktionen
- **Einbürgerungstest:** alle 310 Fragen (300 allgemein + 10 Sachsen) mit Erklärung zu jeder Antwort (DE/RU), Lernmodus (Spaced Repetition), Prüfungssimulation (33 Fragen, 60 Min.), Fehlertraining und durchsuchbarem Katalog
- **Deutschkurs A1–B1:** 30 Lektionen mit Grammatik, ~400 Wörtern, Dialogen, 150+ Übungen und Sprachausgabe; Vokabeltrainer
- **B1-Prüfung (DTZ):** Hör- und Leseaufgaben, Schreibaufgaben mit Musterlösungen, Sprechaufgaben
- **Lernplan:** Tagesziele bis zum Prüfungstermin, tägliche Erinnerung als Kalenderdatei (.ics)
- **Lebenslauf-Generator:** ausführlicher Lebenslauf als Fließtext mit Lückenprüfung
- **Kostenrechner** für die ganze Familie
- **Ablaufdaten:** Warnung, bevor Pass oder Aufenthaltstitel ablaufen, mit Kalendererinnerung
- **Installationsanleitung** beim ersten Aufruf, passend zu Gerät und Browser
- **Tagesziel und Lerntage am Stück**, Fortschritt als Stempel (A1 bis Urkunde)
- **Themen-Statistik:** wo die meisten Fehler passieren, mit gezieltem Training
- **Audio-Modus:** Fragen, Antworten und Erklärungen vorlesen lassen
- **Wörterbuch zum Antippen:** schwierige Begriffe in den Testfragen mit russischer Erklärung
- **Mitbring-Listen** für Test, B1-Prüfung, Behördentermin und Urkundenübergabe
- **Familienmodus:** mehrere Profile, gemeinsame Unterlagenliste
- **Vorlesen überall:** Seite auf Deutsch oder Russisch vorlesen, dazu Vorlese-Knöpfe an Fragen, Erklärungen und allen russischen Texten
- **Aussprache üben:** Mikrofon-Knopf bei Beispielsätzen, Dialogen und Musterantworten (Chrome/Edge/Safari mit Spracherkennung)
- **Gespräch bei der Behörde üben** mit Musterantworten und Erklärung des Bekenntnisses
- **Mein erstes Mal wählen:** Wahlen in Sachsen erklärt, mit Quiz
- **Weiterempfehlen** per Teilen-Menü, WhatsApp, Telegram oder QR-Code; Erfolgsbild nach bestandener Simulation
- **Update-Hinweis:** „Neue Version verfügbar – jetzt laden“
- **Sicheres Speichern:** automatisch in localStorage und IndexedDB, dauerhafter Speicher angefragt, tägliche Sicherungspunkte (7 Tage), Sicherungsdatei
- **Voraussetzungs-Check** mit Fristenrechner (5 Jahre bzw. 3 Jahre bei deutschem Ehepartner)
- **Unterlagen-Checkliste** nach Lebenssituation, druckbar
- **Behörden & Kontakte:** Suche nach Ort/PLZ, alle 13 sächsischen Einbürgerungsbehörden, Beratung, Tests, Kurse
- **Briefvorlagen** für die Behörde

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten. Fortschritt nur im `localStorage` des Geräts (Export/Import möglich). Kein Tracking.

Lokal starten: `python3 -m http.server` und `http://localhost:8000` öffnen.

## Daten pflegen
| Datei | Inhalt |
|---|---|
| `data/questions.json` | Fragenkatalog (unverändert, BAMF Stand 07.05.2025) + russische Übersetzung + Erklärungen (`e`) |
| `data/behoerden-sn.json` | Einbürgerungsbehörden Sachsen (`stand: "geprüft …"` = einzeln verifiziert) |
| `data/info.json` | Schritte, Voraussetzungs-Check, Unterlagen, Kontakte, Briefe |
| `data/kurs-a1/a2/b1.json` | Deutschkurs |
| `data/dtz.json` | B1-Prüfungsaufgaben (Hören, Lesen, Schreiben, Sprechen) |
| `data/glossar.json` | Wörterbuch: Begriff, Wortformen (`f`), Erklärung DE/RU |

**Weitere Bundesländer:** je Land eine Datei `data/behoerden-<kürzel>.json` im gleichen Schema anlegen und die 10 Landesfragen aus dem BAMF-Katalog ergänzen.

**Nach jeder Änderung** in `sw.js` die Konstante `CACHE` hochzählen, damit installierte Apps aktualisieren.

## Quellen & Rechtliches
- Fragen: BAMF – Gesamtfragenkatalog „Leben in Deutschland“/„Einbürgerungstest“ (Anlage 1 EinbTestV), amtliches Werk nach § 5 UrhG, unverändert. Lösungen aus dem BAMF-Online-Testcenter, abgeglichen mit zwei unabhängigen Datensätzen.
- Russische Fragen-Übersetzung: [lezeroq/lebenindeutschland](https://github.com/lezeroq/lebenindeutschland) (MIT).
- Bilder: [JadRizk/einbuergerungstest-trainer](https://github.com/JadRizk/einbuergerungstest-trainer).
- Behördendaten: Websites der Landratsämter und des Freistaates Sachsen (Stand Oktober 2026).
- Schrift: Lora (SIL Open Font License 1.1), unverändert in `fonts/`.

Keine Rechtsberatung. Kein Angebot des BAMF oder einer Behörde.
