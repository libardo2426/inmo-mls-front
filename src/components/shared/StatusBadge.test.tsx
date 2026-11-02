import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, type Tone } from './StatusBadge';

const TONES: Tone[] = ['success', 'warning', 'danger', 'info', 'neutral'];

describe('StatusBadge', () => {
  it.each(TONES)('con tono %s muestra el texto y expone el tono', (tone) => {
    render(<StatusBadge tone={tone}>Texto</StatusBadge>);
    const badge = screen.getByText('Texto').closest('[data-slot="badge"]');
    expect(badge).toHaveAttribute('data-variant', tone);
  });

  it('el punto de color es decorativo', () => {
    render(<StatusBadge tone="success">Aprobada</StatusBadge>);
    const badge = screen.getByText('Aprobada').closest('[data-slot="badge"]');
    expect(badge?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
