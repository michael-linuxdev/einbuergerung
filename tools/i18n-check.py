#!/usr/bin/env python3
"""Prüft, ob jeder russische Text (Daten und app.js) eine englische Fassung in data/en.json hat.
Aufruf im Projektordner: python3 tools/i18n-check.py   (kein Build-Schritt, nur eine Kontrolle)"""
import json, re, glob
cyr = re.compile('[Ѐ-ӿ]')
en = json.load(open('data/en.json', encoding='utf-8'))
found = set()
def walk(x):
    if isinstance(x, str):
        if cyr.search(x): found.add(x)
    elif isinstance(x, list): [walk(v) for v in x]
    elif isinstance(x, dict): [walk(v) for v in x.values()]
for f in glob.glob('data/*.json'):
    if not f.endswith('en.json'): walk(json.load(open(f, encoding='utf-8')))
for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", open('app.js', encoding='utf-8').read()):
    if cyr.search(m.group(1)): found.add(m.group(1))
skip = {'Русский', 'Прочитать по-русски', 'Прочитать страницу по-русски', 'Пояснения дополнительно на русском', 'Добро пожаловать!', 'Какой язык добавить к немецкому?', 'Deutsch + Русский'}
missing = sorted(s for s in found - set(en) - skip)
print(f'{len(found)} russische Texte, {len(missing)} ohne englische Fassung')
for s in missing: print(' -', s[:120])
