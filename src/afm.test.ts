import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAfm } from './afm.js'

test('parses header keys and a basic glyph', () => {
  const source = [
    'StartFontMetrics 4.1',
    'FontName Helvetica',
    'FullName Helvetica',
    'FamilyName Helvetica',
    'Weight Medium',
    'ItalicAngle 0',
    'IsFixedPitch false',
    'FontBBox -166 -225 1000 931',
    'UnderlinePosition -100',
    'UnderlineThickness 50',
    'CapHeight 718',
    'XHeight 523',
    'Ascender 718',
    'Descender -207',
    'StartCharMetrics 1',
    'C 32 ; WX 278 ; N space ;',
    'EndCharMetrics',
    'EndFontMetrics',
  ].join('\n')

  const { header, glyphs } = parseAfm(source)

  assert.equal(header.fontName, 'Helvetica')
  assert.equal(header.familyName, 'Helvetica')
  assert.equal(header.weight, 'Medium')
  assert.equal(header.italicAngle, 0)
  assert.equal(header.isFixedPitch, false)
  assert.deepEqual(header.fontBBox, [-166, -225, 1000, 931])
  assert.equal(header.underlinePosition, -100)
  assert.equal(header.underlineThickness, 50)
  assert.equal(header.capHeight, 718)
  assert.equal(header.xHeight, 523)
  assert.equal(header.ascender, 718)
  assert.equal(header.descender, -207)

  assert.deepEqual(glyphs, [{ code: 32, name: 'space', width: 278 }])
})

test('handles fields in non-standard order', () => {
  const source = ['StartCharMetrics 1', 'N A ; WX 667 ; C 65 ;', 'EndCharMetrics'].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [{ code: 65, name: 'A', width: 667 }])
})

test('maps C -1 (no standard encoding slot) to code -1', () => {
  const source = ['StartCharMetrics 1', 'C -1 ; WX 556 ; N eacute ;', 'EndCharMetrics'].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [{ code: -1, name: 'eacute', width: 556 }])
})

test('drops a CharMetrics line missing WX or N instead of throwing', () => {
  const source = [
    'StartCharMetrics 2',
    'C 32 ; N space ;',
    'C 33 ; WX 333 ;',
    'EndCharMetrics',
  ].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [])
})

test('ignores lines starting with C outside StartCharMetrics/EndCharMetrics', () => {
  const source = [
    'Comment C 1 ; WX 999 ; N bogus ;',
    'C 1 ; WX 999 ; N bogus ;',
    'StartCharMetrics 1',
    'C 32 ; WX 278 ; N space ;',
    'EndCharMetrics',
    'C 2 ; WX 999 ; N alsobogus ;',
  ].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [{ code: 32, name: 'space', width: 278 }])
})

test('accepts CRLF and CR line endings', () => {
  const source = 'FamilyName Helvetica\r\nStartCharMetrics 1\rC 32 ; WX 278 ; N space ;\r\nEndCharMetrics'
  const { header, glyphs } = parseAfm(source)
  assert.equal(header.familyName, 'Helvetica')
  assert.deepEqual(glyphs, [{ code: 32, name: 'space', width: 278 }])
})

test('returns empty header and glyphs for an empty file', () => {
  const { header, glyphs } = parseAfm('')
  assert.deepEqual(header, {})
  assert.deepEqual(glyphs, [])
})

test('an unterminated StartCharMetrics still yields the glyphs seen so far', () => {
  const source = ['StartCharMetrics 1', 'C 32 ; WX 278 ; N space ;'].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [{ code: 32, name: 'space', width: 278 }])
})

test('a glyph name that legitimately contains a space is kept whole', () => {
  const source = ['StartCharMetrics 1', 'C 32 ; WX 278 ; N Delta small ;', 'EndCharMetrics'].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [{ code: 32, name: 'Delta small', width: 278 }])
})

test('a non-numeric WX drops the glyph rather than producing NaN', () => {
  const source = ['StartCharMetrics 1', 'C 32 ; WX four ; N space ;', 'EndCharMetrics'].join('\n')
  const { glyphs } = parseAfm(source)
  assert.deepEqual(glyphs, [])
})

test('malformed FontBBox (wrong field count) is left unset', () => {
  const source = 'FontBBox 0 0 1000'
  const { header } = parseAfm(source)
  assert.equal(header.fontBBox, undefined)
})
