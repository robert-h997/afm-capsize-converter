// Minimal parser for Adobe Font Metrics (AFM) files: a plain-text format
// that ships with Type 1 fonts and some PDF/print tooling. We read the
// global header keys and, from StartCharMetrics/EndCharMetrics, each
// glyph's code, name and advance width. Kerning pairs are out of scope.

export interface AfmHeader {
  fontName?: string
  fullName?: string
  familyName?: string
  weight?: string
  italicAngle?: number
  isFixedPitch?: boolean
  fontBBox?: [number, number, number, number]
  underlinePosition?: number
  underlineThickness?: number
  capHeight?: number
  xHeight?: number
  ascender?: number
  descender?: number
}

export interface AfmGlyphMetric {
  code: number
  name: string
  width: number
}

export interface ParsedAfm {
  header: AfmHeader
  glyphs: AfmGlyphMetric[]
}

// A CharMetrics line looks like: "C 32 ; WX 278 ; N space ;" - a fixed
// set of semicolon-separated "KEY value" fields, order not guaranteed.
function parseCharMetricsLine(line: string): AfmGlyphMetric | null {
  let code: number | undefined
  let width: number | undefined
  let name: string | undefined

  for (const field of line.split(';')) {
    const trimmed = field.trim()
    if (trimmed.length === 0) continue
    const spaceIndex = trimmed.indexOf(' ')
    if (spaceIndex === -1) continue
    const key = trimmed.slice(0, spaceIndex)
    const value = trimmed.slice(spaceIndex + 1).trim()

    if (key === 'C') code = Number(value)
    else if (key === 'WX') width = Number(value)
    else if (key === 'N') name = value
  }

  // WX and N are the only fields the flat schema needs; C is -1 for
  // glyphs with no standard encoding slot, which AFM represents as "C -1".
  if (name === undefined || width === undefined || Number.isNaN(width)) return null
  return { code: code ?? -1, name, width }
}

export function parseAfm(source: string): ParsedAfm {
  const header: AfmHeader = {}
  const glyphs: AfmGlyphMetric[] = []
  let inCharMetrics = false

  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    if (line.startsWith('StartCharMetrics')) {
      inCharMetrics = true
      continue
    }
    if (line.startsWith('EndCharMetrics')) {
      inCharMetrics = false
      continue
    }
    if (inCharMetrics) {
      if (line.startsWith('C ')) {
        const glyph = parseCharMetricsLine(line)
        if (glyph) glyphs.push(glyph)
      }
      continue
    }

    const spaceIndex = line.indexOf(' ')
    if (spaceIndex === -1) continue
    const key = line.slice(0, spaceIndex)
    const value = line.slice(spaceIndex + 1).trim()

    switch (key) {
      case 'FontName':
        header.fontName = value
        break
      case 'FullName':
        header.fullName = value
        break
      case 'FamilyName':
        header.familyName = value
        break
      case 'Weight':
        header.weight = value
        break
      case 'ItalicAngle':
        header.italicAngle = Number(value)
        break
      case 'IsFixedPitch':
        header.isFixedPitch = value.toLowerCase() === 'true'
        break
      case 'FontBBox': {
        const parts = value.split(/\s+/).map(Number)
        if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
          header.fontBBox = [parts[0], parts[1], parts[2], parts[3]]
        }
        break
      }
      case 'UnderlinePosition':
        header.underlinePosition = Number(value)
        break
      case 'UnderlineThickness':
        header.underlineThickness = Number(value)
        break
      case 'CapHeight':
        header.capHeight = Number(value)
        break
      case 'XHeight':
        header.xHeight = Number(value)
        break
      case 'Ascender':
        header.ascender = Number(value)
        break
      case 'Descender':
        header.descender = Number(value)
        break
      default:
        // Comment, Notice, EncodingScheme, Version, StartFontMetrics, etc.
        // are not needed for the metrics conversion.
        break
    }
  }

  return { header, glyphs }
}
