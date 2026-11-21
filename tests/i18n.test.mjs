// Tests de traducciones. Correr con: node --test 'tests/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, STRINGS, t } from '../js/i18n.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('cada idioma de LANGS tiene diccionario', () => {
  for (const lang of Object.keys(LANGS)) assert.ok(STRINGS[lang], `falta STRINGS.${lang}`);
});

test('todos los idiomas tienen las mismas claves que el español', () => {
  const base = Object.keys(STRINGS.es).sort();
  for (const lang of Object.keys(LANGS)) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), base, `claves distintas en ${lang}`);
  }
});

test('las traducciones usan los mismos {parámetros}', () => {
  for (const [key, es] of Object.entries(STRINGS.es)) {
    for (const lang of Object.keys(LANGS)) {
      assert.deepEqual(placeholders(STRINGS[lang][key]), placeholders(es), `${lang}.${key}`);
    }
  }
});

test('t() reemplaza parámetros (idioma por defecto: español)', () => {
  assert.equal(t('segment', { i: 2, n: 4, from: 'A', to: 'B' }), 'Tramo 2/4: A → B');
});
