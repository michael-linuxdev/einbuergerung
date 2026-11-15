#!/usr/bin/env python3
"""Prüft, ob jeder russische Text (Daten und app.js) eine Fassung in jeder Hilfssprache hat (data/en.json, tr, ar, pl, ro).
Aufruf im Projektordner: python3 tools/i18n-check.py   (kein Build-Schritt, nur eine Kontrolle)"""
import json, re, glob, sys
LANGS = ['en', 'tr', 'ar', 'pl', 'ro']
cyr = re.compile('[Ѐ-ӿ]')
found = set()
def walk(x):
    if isinstance(x, str):
        if cyr.search(x): found.add(x)
    elif isinstance(x, list): [walk(v) for v in x]
    elif isinstance(x, dict): [walk(v) for v in x.values()]
for f in glob.glob('data/*.json'):
    if f.split('/')[-1][:-5] not in LANGS: walk(json.load(open(f, encoding='utf-8')))
src = open('app.js', encoding='utf-8').read()
# Texte in ru('…'), tr('…') und in Listen (Tutorial, Mehr, Installationsschritte)
for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", src):
    if cyr.search(m.group(1)): found.add(m.group(1))
# Sprachnamen, Begrüßung und Vorlese-Beschriftungen stehen schon in der jeweiligen Sprache (LANG, WELCOME)
skip = {'Русский', 'Прочитать по-русски', 'Прочитать страницу по-русски', 'Пояснения дополнительно на русском', 'Добро пожаловать!', 'Какой язык добавить к немецкому?'}
bad = 0
for l in LANGS:
    d = json.load(open(f'data/{l}.json', encoding='utf-8'))
    missing = sorted(s for s in found - set(d) - skip)
    bad += len(missing)
    print(f'{l}: {len(found)} russische Texte, {len(missing)} ohne Übersetzung')
    for s in missing[:20]: print('   -', s[:120])
sys.exit(1 if bad else 0)
