import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

describe('HomePage', () => {
  it('muestra Inicio con el correo y el país dentro del shell', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    mountApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: es.nav.home })).toBeInTheDocument();
    expect(screen.getByText('admin@innmo.test')).toBeInTheDocument();
    expect(screen.getByText('Colombia')).toBeInTheDocument();
  });
});
