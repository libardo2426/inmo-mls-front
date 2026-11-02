export type ThemeTokens = Record<string, string>;

/** Extrae `--nombre: oklch(...)` de los bloques `:root` (claro) y `.dark` (oscuro) de un CSS. */
export function parseTokens(css: string): { light: ThemeTokens; dark: ThemeTokens } {
  const block = (selector: RegExp): ThemeTokens => {
    const match = selector.exec(css);
    const tokens: ThemeTokens = {};
    if (!match) return tokens;
    for (const [, name, value] of (match[1] ?? '').matchAll(
      /--([\w-]+):\s*(oklch\([^)]*\))\s*;/g,
    )) {
      if (name && value) tokens[name] = value;
    }
    return tokens;
  };
  return {
    light: block(/:root\s*\{([^}]*)\}/),
    dark: block(/\.dark\s*\{([^}]*)\}/),
  };
}

type Rgb = [number, number, number];

function oklchToLinearRgb(color: string): { rgb: Rgb; alpha: number } {
  const body = /oklch\(\s*([^)]*)\)/.exec(color)?.[1];
  if (!body) throw new Error(`Color no soportado: ${color}`);
  const [main = '', alphaPart] = body.split('/');
  const [l, c, h] = main.trim().split(/\s+/).map(Number) as [number, number, number];
  const alpha =
    alphaPart === undefined ? 1 : parseFloat(alphaPart) / (alphaPart.includes('%') ? 100 : 1);
  const hue = ((h ?? 0) * Math.PI) / 180;
  const a = (c ?? 0) * Math.cos(hue);
  const b = (c ?? 0) * Math.sin(hue);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    rgb: [
      clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
      clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
      clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    ],
    alpha,
  };
}

function luminance(color: string, over: Rgb = [1, 1, 1]): number {
  const { rgb, alpha } = oklchToLinearRgb(color);
  const [r, g, b] = rgb.map((v, i) => v * alpha + (over[i] ?? 1) * (1 - alpha)) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores `oklch(...)`; el alfa se compone sobre blanco. */
export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
