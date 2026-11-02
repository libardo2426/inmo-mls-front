/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseTokens } from './contrast';

// Vitest vacía los `.css` importados (incluso con `?raw`), por eso se lee del disco.
const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8');
const tokens = parseTokens(css);
const TONES = ['success', 'warning', 'danger', 'info'] as const;

type Pair = [fg: string, bg: string, min: number];
const pairs: Pair[] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['text-muted', 'surface', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['border', 'background', 1.2],
  ...TONES.flatMap((tone): Pair[] => [
    [`${tone}-foreground`, `${tone}-subtle`, 4.5],
    [tone, 'background', 3],
  ]),
];

describe('helper de contraste', () => {
  it('blanco sobre negro es ≈ 21:1', () => {
    expect(contrastRatio('oklch(1 0 0)', 'oklch(0 0 0)')).toBeCloseTo(21, 0);
  });
  it('un color consigo mismo es 1:1', () => {
    expect(contrastRatio('oklch(0.5 0.1 255)', 'oklch(0.5 0.1 255)')).toBeCloseTo(1, 5);
  });
});

describe.each(['light', 'dark'] as const)('contraste del tema %s', (theme) => {
  it.each(pairs)('%s sobre %s ≥ %f', (fg, bg, min) => {
    const colors = tokens[theme];
    expect(colors[fg], `falta --${fg}`).toBeDefined();
    expect(colors[bg], `falta --${bg}`).toBeDefined();
    expect(contrastRatio(colors[fg] ?? '', colors[bg] ?? '')).toBeGreaterThanOrEqual(min);
  });
});
