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
}

export function afmToFontMetrics(parsed: ParsedAfm): FontMetrics {
  const { header, glyphCount } = parsed
  const [, bboxBottom, , bboxTop] = header.fontBBox ?? [0, 0, 0, 0]

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
    glyphCount,
  }
}
