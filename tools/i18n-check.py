#!/usr/bin/env python3
"""Prüft die Hilfssprachen: Jede ID aus den Daten und aus js/ muss in jeder Datei data/i18n/<code>.json stehen.
Meldet auch IDs, die nirgends mehr benutzt werden, und russischen Text, der versehentlich direkt im Code oder in den Daten steht.
Aufruf im Projektordner: python3 tools/i18n-check.py   (kein Build-Schritt, nur eine Kontrolle)

So funktionieren die Übersetzungen:
- In den Daten stehen an den Stellen der Hilfssprache IDs (z. B. "ru": "q.g1", "dru": "info.steps.s1.dru").
- Im Code (js/) stehen IDs in ru('ui.…'), ruSay('ui.…') bzw. tr('ui.…').
- data/i18n/ru.json, en.json, tr.json, ar.json, pl.json, ro.json ordnen jeder ID den Text zu.
Einen Text verbessern: nur den Wert in der jeweiligen Sprachdatei ändern. Neuen Text anlegen: neue ID + Eintrag in allen sechs Dateien."""
import json, re, glob, sys
LANGS = ['ru', 'en', 'tr', 'ar', 'pl', 'ro']
ID = re.compile(r'^(q|info|amt|k|dtz|g)\.[\w.-]+$')
cyr = re.compile('[Ѐ-ӿ]')
used, stray = set(), []
def walk(x, f):
    if isinstance(x, str):
        if ID.match(x): used.add(x)
        elif cyr.search(x): stray.append(f'{f}: {x[:80]}')
    elif isinstance(x, list): [walk(v, f) for v in x]
    elif isinstance(x, dict): [walk(v, f) for v in x.values()]
for f in glob.glob('data/*.json'): walk(json.load(open(f, encoding='utf-8')), f)
for f in glob.glob('js/**/*.js', recursive=True):
    src = open(f, encoding='utf-8').read()
    used |= set(re.findall(r"'(ui\.[\w-]+)'", src))
    # Sprachnamen und Begrüßung stehen absichtlich in der jeweiligen Sprache (LANG, WELCOME)
    for line in src.split('\n'):
        if cyr.search(line) and not re.search(r"^\s*ru: \{|^(export )?const WELCOME", line): stray.append(f'{f}: {line.strip()[:80]}')
bad = len(stray)
for s in stray: print('Russischer Text direkt im Code/in den Daten (bitte als ID anlegen):', s)
for l in LANGS:
    d = json.load(open(f'data/i18n/{l}.json', encoding='utf-8'))
    missing, unused = sorted(used - set(d)), sorted(set(d) - used)
    empty = sorted(k for k, v in d.items() if k in used and not str(v).strip())
    bad += len(missing) + len(empty)
    print(f'{l}: {len(used)} IDs benutzt, {len(missing)} fehlen, {len(empty)} leer, {len(unused)} unbenutzt')
    for k in missing[:15]: print('   fehlt:', k)
    for k in unused[:15]: print('   unbenutzt:', k)
sys.exit(1 if bad else 0)
