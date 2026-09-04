import type { ParsedAfm } from './afm.js'

// Every AFM file describes a Type 1 font on a fixed 1000-unit em square;
// unlike TrueType/OpenType there is no unitsPerEm field to read.
const AFM_UNITS_PER_EM = 1000

// The flat schema used downstream by web line-height / fallback-font
// matching tools (capsize and similar). Field names deliberately mirror
// the hhea/OS2 terms those tools expect, since that's the metrics vocabulary
// most consumers already know.
export interface FontMetrics {
  unitsPerEm: number
  ascent: number
  descent: number
  lineGap: number
  capHeight: number
  xHeight: number
  familyName: string
  fullName: string
  subfamilyName: string
  italicAngle: number
  isFixedPitch: boolean
  underlinePosition: number
  underlineThickness: number
  glyphCount: number
  // Advance width per glyph name, keyed the way AFM/PostScript name glyphs
  // (e.g. "space", "A", "eacute") rather than by character code, since AFM
  // encoding slots vary by font and codepoint isn't always available.
  glyphWidths: Record<string, number>
}

export function afmToFontMetrics(parsed: ParsedAfm): FontMetrics {
  const { header, glyphs } = parsed
  const [, bboxBottom, , bboxTop] = header.fontBBox ?? [0, 0, 0, 0]

  const glyphWidths: Record<string, number> = {}
  for (const glyph of glyphs) {
    glyphWidths[glyph.name] = glyph.width
  }

  return {
    unitsPerEm: AFM_UNITS_PER_EM,
    // Ascender/Descender are optional in the AFM spec; the font bounding
    // box is the documented fallback when they're absent.
    ascent: header.ascender ?? bboxTop,
    descent: header.descender ?? bboxBottom,
    // AFM/Type 1 has no equivalent of hhea's line gap; leave it at zero
    // rather than guessing.
    lineGap: 0,
    capHeight: header.capHeight ?? 0,
    xHeight: header.xHeight ?? 0,
    familyName: header.familyName ?? header.fontName ?? 'Unknown',
    fullName: header.fullName ?? header.fontName ?? 'Unknown',
    subfamilyName: header.weight ?? 'Regular',
    italicAngle: header.italicAngle ?? 0,
    isFixedPitch: header.isFixedPitch ?? false,
    underlinePosition: header.underlinePosition ?? 0,
    underlineThickness: header.underlineThickness ?? 0,
    glyphCount: glyphs.length,
    glyphWidths,
  }
}

const REQUIRED_FONT_METRICS_FIELDS = [
  'unitsPerEm',
  'ascent',
  'descent',
  'familyName',
  'fullName',
  'subfamilyName',
  'glyphWidths',
] as const

// Guards the json-to-afm direction against malformed input files producing
// an AFM file full of "undefined" instead of a clear error up front.
export function assertFontMetrics(value: unknown): asserts value is FontMetrics {
  if (typeof value !== 'object' || value === null) {
    throw new Error('expected a JSON object')
  }
  const record = value as Record<string, unknown>
  for (const key of REQUIRED_FONT_METRICS_FIELDS) {
    if (!(key in record)) throw new Error(`missing required field "${key}"`)
  }
  if (typeof record.glyphWidths !== 'object' || record.glyphWidths === null) {
    throw new Error('"glyphWidths" must be an object')
  }
}

// Reverses afmToFontMetrics. Lossy: the flat schema drops per-glyph
// character codes and the font's horizontal bounding box, so this fills
// those back in with AFM-legal placeholders (C -1 means "no standard
// encoding slot", which is always a valid thing for a CharMetrics line to
// say) rather than trying to recover values that were never kept.
export function fontMetricsToAfm(metrics: FontMetrics): string {
  const glyphNames = Object.keys(metrics.glyphWidths).sort()

  const lines: string[] = [
    'StartFontMetrics 4.1',
    `FontName ${metrics.fullName}`,
    `FullName ${metrics.fullName}`,
    `FamilyName ${metrics.familyName}`,
    `Weight ${metrics.subfamilyName}`,
    `ItalicAngle ${metrics.italicAngle}`,
    `IsFixedPitch ${metrics.isFixedPitch ? 'true' : 'false'}`,
    `FontBBox 0 ${metrics.descent} ${metrics.unitsPerEm} ${metrics.ascent}`,
    `UnderlinePosition ${metrics.underlinePosition}`,
    `UnderlineThickness ${metrics.underlineThickness}`,
    `CapHeight ${metrics.capHeight}`,
    `XHeight ${metrics.xHeight}`,
    `Ascender ${metrics.ascent}`,
    `Descender ${metrics.descent}`,
    `StartCharMetrics ${glyphNames.length}`,
  ]

  for (const name of glyphNames) {
    lines.push(`C -1 ; WX ${metrics.glyphWidths[name]} ; N ${name} ;`)
  }

  lines.push('EndCharMetrics', 'EndFontMetrics')
  return lines.join('\n')
}
