import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, createHttpClient, ValidationError } from '@/lib/http';
import { memberFixture } from '@/test/fixtures';
import { server } from '@/test/server';
import { createMembersApi } from './members-api';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
const api = createMembersApi(createHttpClient({ config, origin }));

describe('list', () => {
  it('pide los miembros de la agencia y los devuelve parseados', async () => {
    server.use(
      http.get(`${origin}/v1/agencies/AID/members`, () => HttpResponse.json([memberFixture()])),
    );
    const members = await api.list('AID');
    expect(members).toHaveLength(1);
    expect(members[0]?.fullName).toBe('Luis Demo');
  });

  it('lanza ValidationError si un miembro trae un estado fuera del contrato', async () => {
    server.use(
      http.get(`${origin}/v1/agencies/AID/members`, () =>
        HttpResponse.json([memberFixture({ status: 'x' })]),
      ),
    );
    await expect(api.list('AID')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('terminate', () => {
  it('hace POST con el motivo y resuelve sin cuerpo con 204', async () => {
    let body = '';
    server.use(
      http.post(`${origin}/v1/members/M1/terminate`, async ({ request }) => {
        body = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(api.terminate('M1', 'Incumple')).resolves.toBeUndefined();
    expect(JSON.parse(body)).toEqual({ reason: 'Incumple' });
  });

  it('propaga el code de un 409 last_broker en un ApiError', async () => {
    server.use(
      http.post(`${origin}/v1/members/M1/terminate`, () =>
        HttpResponse.json(
          { title: 'x', status: 409, code: 'last_broker' },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const error = await api.terminate('M1', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('last_broker');
  });
});
