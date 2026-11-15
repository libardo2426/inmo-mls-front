import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('es un SVG decorativo con la proporción del símbolo', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 100 76');
  });

  it('el tirador usa el tono leaf, sin colores sueltos', () => {
    const { container } = render(<BrandMark />);
    expect(container.querySelector('circle')).toHaveClass('fill-leaf');
  });
});
