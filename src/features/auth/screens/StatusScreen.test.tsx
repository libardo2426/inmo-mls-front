import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

describe('pantallas de estado', () => {
  it('/mantenimiento muestra su título y un botón Reintentar', async () => {
    mountApp('/mantenimiento');
    expect(
      await screen.findByRole('heading', { name: es.auth.status.maintenanceTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.auth.status.retry })).toBeInTheDocument();
  });

  it('/sin-conexion muestra su título', async () => {
    mountApp('/sin-conexion');
    expect(
      await screen.findByRole('heading', { name: es.auth.status.offlineTitle }),
    ).toBeInTheDocument();
  });

  it('un 503 tenant_unavailable en /me lleva de / a /mantenimiento', async () => {
    server.use(
      http.get('*/v1/me', () =>
        HttpResponse.json(
          { title: 'x', status: 503, code: 'tenant_unavailable' },
          { status: 503, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    mountApp('/');
    expect(
      await screen.findByRole('heading', { name: es.auth.status.maintenanceTitle }),
    ).toBeInTheDocument();
  });

  it('un fallo de red en /me lleva de / a /sin-conexion', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.error()));
    mountApp('/');
    expect(
      await screen.findByRole('heading', { name: es.auth.status.offlineTitle }),
    ).toBeInTheDocument();
  });

  it('Reintentar vuelve a / y entra si el servicio ya responde', async () => {
    server.use(
      http.get('*/v1/me', () => HttpResponse.error(), { once: true }),
      http.get('*/v1/me', () => HttpResponse.json(meFixture())),
    );
    mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.auth.status.retry }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: es.nav.home })).toBeInTheDocument(),
    );
  });
});
