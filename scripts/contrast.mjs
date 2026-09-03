// oklch → sRGB → relative luminance → WCAG contrast ratio.
const f = (t) => (t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t)
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return [
    f(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    f(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    f(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ]
}
const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

const T = {
  'ink-900':      [0.24, 0.03, 258],
  'ink-700':      [0.42, 0.02, 258],
  'ink-500':      [0.55, 0.015, 258],
  'brand-900':    [0.31, 0.08, 258],
  'brand-700':    [0.44, 0.11, 256],
  'brand-500':    [0.55, 0.13, 254],
  'caution-900':  [0.42, 0.09, 62],
  'hairline':     [0.91, 0.006, 258],
}
const BG = {
  'surface':        [1, 0, 0],
  'surface-muted':  [0.985, 0.003, 258],
  'caution-50':     [0.975, 0.022, 82],
}
console.log('token'.padEnd(14), Object.keys(BG).map((k) => k.padEnd(15)).join(''))
for (const [name, v] of Object.entries(T)) {
  const fg = oklchToRgb(...v)
  const row = Object.values(BG).map((b) => {
    const r = ratio(fg, oklchToRgb(...b))
    const tag = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-lg' : 'FAIL'
    return `${r.toFixed(2)} ${tag}`.padEnd(15)
  })
  console.log(name.padEnd(14), row.join(''))
}
