#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, readdirSync, mkdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseAfm } from './afm.js'
import { afmToFontMetrics, assertFontMetrics, fontMetricsToAfm, type FontMetrics } from './metrics.js'

interface CliOptions {
  inputPath: string
  json: boolean
  compact: boolean
  toAfm: boolean
  outputPath?: string
}

function printUsage(): void {
  console.log(`usage: afm-capsize <input.afm> [--json] [--compact] [-o <output>]
       afm-capsize <input.json> --to-afm [-o <output>]
       afm-capsize <input-dir> [--json] [--compact] -o <output-dir>
       afm-capsize <input-dir> --to-afm -o <output-dir>

Converts Adobe Font Metrics (AFM) files into the flat JSON metrics
schema used by web line-height / fallback-font-matching tools
(capsize and similar), and back again.

If <input> is a directory, every *.afm file in it (or every *.json
file, with --to-afm) is converted the same way and written into the
required output directory, one file per input.

  --json          print the converted metrics as JSON instead of a table
  --compact       with --json, print it as a single line
  --to-afm        read a metrics JSON file and write it out as an AFM file
  -o, --out FILE  write output to FILE instead of stdout
  -h, --help      show this message
`)
}

export function parseArgs(argv: string[]): CliOptions | null {
  let inputPath: string | undefined
  let json = false
  let compact = false
  let toAfm = false
  let outputPath: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      return null
    }
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--compact') {
      compact = true
      continue
    }
    if (arg === '--to-afm') {
      toAfm = true
      continue
    }
    if (arg === '-o' || arg === '--out') {
      outputPath = argv[++i]
      continue
    }
    if (!inputPath && !arg.startsWith('-')) {
      inputPath = arg
      continue
    }
    throw new Error(`unrecognized argument: ${arg}`)
  }

  if (!inputPath) {
    throw new Error('missing input file')
  }
  if (json && toAfm) {
    throw new Error('--json and --to-afm are mutually exclusive')
  }
  if (compact && !json) {
    throw new Error('--compact requires --json')
  }
  if (compact && toAfm) {
    throw new Error('--compact and --to-afm are mutually exclusive')
  }

  return { inputPath, json, compact, toAfm, outputPath }
}

function formatTable(metrics: FontMetrics): string {
  const rows: Array<[string, string]> = [
    ['family', metrics.familyName],
    ['full name', metrics.fullName],
    ['subfamily', metrics.subfamilyName],
    ['units per em', String(metrics.unitsPerEm)],
    ['ascent', String(metrics.ascent)],
    ['descent', String(metrics.descent)],
    ['line gap', String(metrics.lineGap)],
    ['cap height', String(metrics.capHeight)],
    ['x-height', String(metrics.xHeight)],
    ['italic angle', String(metrics.italicAngle)],
    ['fixed pitch', metrics.isFixedPitch ? 'yes' : 'no'],
    ['underline position', String(metrics.underlinePosition)],
    ['underline thickness', String(metrics.underlineThickness)],
    ['glyphs', String(metrics.glyphCount)],
  ]

  const labelWidth = Math.max(...rows.map(([label]) => label.length))
  return rows.map(([label, value]) => `  ${label.padEnd(labelWidth)}  ${value}`).join('\n')
}

function convertAfmSource(source: string, json: boolean, compact: boolean): string {
  const parsed = parseAfm(source)
  const metrics = afmToFontMetrics(parsed)
  if (!json) return formatTable(metrics)
  return compact ? JSON.stringify(metrics) : JSON.stringify(metrics, null, 2)
}

function convertJsonSource(source: string): string {
  let metrics: unknown
  try {
    metrics = JSON.parse(source)
  } catch (err) {
    throw new Error(`could not parse as JSON: ${(err as Error).message}`)
  }
  try {
    assertFontMetrics(metrics)
  } catch (err) {
    throw new Error(`not a valid metrics file: ${(err as Error).message}`)
  }
  return fontMetricsToAfm(metrics)
}

// Converts every matching file in a directory and writes each result into
// outputPath under a name derived from the source file, mirroring what
// running the single-file conversion in a loop over the shell would do.
function convertDirectory(options: CliOptions): void {
  if (!options.outputPath) {
    console.error('afm-capsize: -o <dir> is required when converting a directory of files')
    process.exitCode = 1
    return
  }

  const sourceExt = options.toAfm ? '.json' : '.afm'
  const targetExt = options.toAfm ? '.afm' : options.json ? '.json' : '.txt'

  let entries: string[]
  try {
    entries = readdirSync(options.inputPath)
      .filter((name) => extname(name).toLowerCase() === sourceExt)
      .sort()
  } catch (err) {
    console.error(`afm-capsize: could not read ${options.inputPath}: ${(err as Error).message}`)
    process.exitCode = 1
    return
  }

  if (entries.length === 0) {
    console.error(`afm-capsize: no ${sourceExt} files found in ${options.inputPath}`)
    process.exitCode = 1
    return
  }

  try {
    mkdirSync(options.outputPath, { recursive: true })
  } catch (err) {
    console.error(`afm-capsize: could not create ${options.outputPath}: ${(err as Error).message}`)
    process.exitCode = 1
    return
  }

  for (const entry of entries) {
    const inputFile = join(options.inputPath, entry)
    const stem = basename(entry, extname(entry))
    const outputFile = join(options.outputPath, stem + targetExt)

    let source: string
    try {
      source = readFileSync(inputFile, 'utf8')
    } catch (err) {
      console.error(`afm-capsize: could not read ${inputFile}: ${(err as Error).message}`)
      process.exitCode = 1
      continue
    }

    let output: string
    try {
      output = options.toAfm
        ? convertJsonSource(source)
        : convertAfmSource(source, options.json, options.compact)
    } catch (err) {
      console.error(`afm-capsize: ${inputFile}: ${(err as Error).message}`)
      process.exitCode = 1
      continue
    }

    writeFileSync(outputFile, output + '\n')
  }
}

function main(): void {
  const argv = process.argv.slice(2)
  let options: CliOptions | null

  try {
    options = parseArgs(argv)
  } catch (err) {
    console.error(`afm-capsize: ${(err as Error).message}`)
    printUsage()
    process.exitCode = 1
    return
  }

  if (!options) {
    printUsage()
    return
  }

  let inputStat: ReturnType<typeof statSync>
  try {
    inputStat = statSync(options.inputPath)
  } catch (err) {
    console.error(`afm-capsize: could not read ${options.inputPath}: ${(err as Error).message}`)
    process.exitCode = 1
    return
  }

  if (inputStat.isDirectory()) {
    convertDirectory(options)
    return
  }

  let source: string
  try {
    source = readFileSync(options.inputPath, 'utf8')
  } catch (err) {
    console.error(`afm-capsize: could not read ${options.inputPath}: ${(err as Error).message}`)
    process.exitCode = 1
    return
  }

  let output: string
  try {
    output = options.toAfm
      ? convertJsonSource(source)
      : convertAfmSource(source, options.json, options.compact)
  } catch (err) {
    console.error(`afm-capsize: ${options.inputPath}: ${(err as Error).message}`)
    process.exitCode = 1
    return
  }

  if (options.outputPath) {
    writeFileSync(options.outputPath, output + '\n')
  } else {
    console.log(output)
  }
}

// Only run when invoked directly (node dist/cli.js ...), not when the test
// suite imports this module to exercise parseArgs.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
