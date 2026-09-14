import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from './cli.js'

test('parses a bare input path with no flags', () => {
  const options = parseArgs(['Helvetica.afm'])
  assert.deepEqual(options, {
    inputPath: 'Helvetica.afm',
    json: false,
    compact: false,
    toAfm: false,
    outputPath: undefined,
  })
})

test('parses --json, --compact, -o together', () => {
  const options = parseArgs(['Helvetica.afm', '--json', '--compact', '-o', 'out.json'])
  assert.deepEqual(options, {
    inputPath: 'Helvetica.afm',
    json: true,
    compact: true,
    toAfm: false,
    outputPath: 'out.json',
  })
})

test('--out is an alias for -o', () => {
  const options = parseArgs(['Helvetica.afm', '--out', 'out.txt'])
  assert.equal(options?.outputPath, 'out.txt')
})

test('--to-afm is accepted on its own', () => {
  const options = parseArgs(['Helvetica.json', '--to-afm'])
  assert.deepEqual(options, {
    inputPath: 'Helvetica.json',
    json: false,
    compact: false,
    toAfm: true,
    outputPath: undefined,
  })
})

test('flag order relative to the input path does not matter', () => {
  const options = parseArgs(['--json', 'Helvetica.afm'])
  assert.equal(options?.inputPath, 'Helvetica.afm')
  assert.equal(options?.json, true)
})

test('-h returns null to signal usage should be printed', () => {
  assert.equal(parseArgs(['-h']), null)
})

test('--help returns null even alongside other flags', () => {
  assert.equal(parseArgs(['Helvetica.afm', '--help']), null)
})

test('missing input path is an error', () => {
  assert.throws(() => parseArgs(['--json']), /missing input file/)
})

test('a second bare argument is rejected as unrecognized', () => {
  assert.throws(() => parseArgs(['a.afm', 'b.afm']), /unrecognized argument: b\.afm/)
})

test('an unknown flag is rejected as unrecognized', () => {
  assert.throws(() => parseArgs(['a.afm', '--bogus']), /unrecognized argument: --bogus/)
})

test('--json and --to-afm are mutually exclusive', () => {
  assert.throws(
    () => parseArgs(['a.afm', '--json', '--to-afm']),
    /--json and --to-afm are mutually exclusive/,
  )
})

test('--compact requires --json', () => {
  assert.throws(() => parseArgs(['a.afm', '--compact']), /--compact requires --json/)
})

test('--compact with --to-afm and no --json is rejected (compact still needs --json)', () => {
  assert.throws(() => parseArgs(['a.json', '--compact', '--to-afm']), /--compact requires --json/)
})
