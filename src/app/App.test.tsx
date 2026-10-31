import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';

describe('App', () => {
  it('muestra el nombre del producto como encabezado principal', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Innmo MLS' })).toBeInTheDocument();
  });
});
