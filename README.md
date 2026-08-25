# afm-capsize-converter

Adobe Font Metrics (AFM) files still ship with a lot of Type 1 font
packages and print/PDF tooling, and they carry the numbers you need to
do accurate web typography: ascent, descent, cap height, x-height. But
web tools that compute line-height or match a fallback font's metrics
against a webfont (capsize and similar) want that data as a flat JSON
object, not as an AFM text file. This is a small CLI that reads an AFM
file and converts it to that JSON shape.

## Usage

```
afm-capsize Helvetica.afm
```

```
  family                Helvetica
  full name             Helvetica
  subfamily             Medium
  units per em          1000
  ascent                718
  descent               -207
  line gap               0
  cap height             718
  x-height               523
  italic angle            0
  fixed pitch           no
  underline position    -100
  underline thickness    50
  glyphs                315
```

Pass `--json` to get the same data as the target schema instead of a
table, which is what you actually want to feed into another tool or
save to a file:

```
afm-capsize Helvetica.afm --json
```

```json
{
  "unitsPerEm": 1000,
  "ascent": 718,
  "descent": -207,
  "lineGap": 0,
  "capHeight": 718,
  "xHeight": 523,
  "familyName": "Helvetica",
  "fullName": "Helvetica",
  "subfamilyName": "Medium",
  "italicAngle": 0,
  "isFixedPitch": false,
  "underlinePosition": -100,
  "underlineThickness": 50,
  "glyphCount": 315
}
```

Write straight to a file with `-o`:

```
afm-capsize Helvetica.afm --json -o Helvetica.metrics.json
```

## Building

No dependencies, just the TypeScript compiler:

```
npm run build
node dist/cli.js Helvetica.afm
```

## Notes on the conversion

- AFM files describe Type 1 fonts, which are always on a 1000-unit em
  square, so `unitsPerEm` is fixed rather than read from the file.
- `ascent`/`descent` fall back to the font's bounding box when the
  optional `Ascender`/`Descender` keys are missing, per the AFM spec.
- AFM has no equivalent of hhea's line gap, so `lineGap` is always 0.
- Per-glyph advance widths and kerning pairs are parsed only far enough
  to count glyphs; they aren't part of the output schema yet.

## License

MIT, see LICENSE.
