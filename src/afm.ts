// Minimal parser for Adobe Font Metrics (AFM) files: a plain-text format
// that ships with Type 1 fonts and some PDF/print tooling. We only care
// about the global header keys and a count of the glyphs described in
// StartCharMetrics/EndCharMetrics; per-glyph widths and kerning pairs are
// out of scope for now.

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

export interface ParsedAfm {
  header: AfmHeader
  glyphCount: number
}

export function parseAfm(source: string): ParsedAfm {
  const header: AfmHeader = {}
  let glyphCount = 0
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
      // Each glyph is one semicolon-separated line starting with "C <code> ;".
      if (line.startsWith('C ')) glyphCount++
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

  return { header, glyphCount }
}
