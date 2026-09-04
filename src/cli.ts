#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { parseAfm } from './afm.js'
import { afmToFontMetrics, assertFontMetrics, fontMetricsToAfm, type FontMetrics } from './metrics.js'

interface CliOptions {
  inputPath: string
  json: boolean
  toAfm: boolean
  outputPath?: string
}

function printUsage(): void {
  console.log(`usage: afm-capsize <input.afm> [--json] [-o <output>]
       afm-capsize <input.json> --to-afm [-o <output>]

Converts Adobe Font Metrics (AFM) files into the flat JSON metrics
schema used by web line-height / fallback-font-matching tools
(capsize and similar), and back again.

  --json          print the converted metrics as JSON instead of a table
  --to-afm        read a metrics JSON file and write it out as an AFM file
  -o, --out FILE  write output to FILE instead of stdout
  -h, --help      show this message
`)
}

function parseArgs(argv: string[]): CliOptions | null {
  let inputPath: string | undefined
  let json = false
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

  return { inputPath, json, toAfm, outputPath }
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

  let source: string
  try {
    source = readFileSync(options.inputPath, 'utf8')
  } catch (err) {
    console.error(`afm-capsize: could not read ${options.inputPath}: ${(err as Error).message}`)
    process.exitCode = 1
    return
  }

  let output: string
  if (options.toAfm) {
    let metrics: unknown
    try {
      metrics = JSON.parse(source)
    } catch (err) {
      console.error(`afm-capsize: could not parse ${options.inputPath} as JSON: ${(err as Error).message}`)
      process.exitCode = 1
      return
    }
    try {
      assertFontMetrics(metrics)
    } catch (err) {
      console.error(`afm-capsize: ${options.inputPath} is not a valid metrics file: ${(err as Error).message}`)
      process.exitCode = 1
      return
    }
    output = fontMetricsToAfm(metrics)
  } else {
    const parsed = parseAfm(source)
    const metrics = afmToFontMetrics(parsed)
    output = options.json ? JSON.stringify(metrics, null, 2) : formatTable(metrics)
  }

  if (options.outputPath) {
    writeFileSync(options.outputPath, output + '\n')
  } else {
    console.log(output)
  }
}

main()
