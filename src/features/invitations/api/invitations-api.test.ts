import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, createHttpClient, ValidationError } from '@/lib/http';
import { invitationFixture } from '@/test/fixtures';
import { server } from '@/test/server';
import { createInvitationsApi } from './invitations-api';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
const api = createInvitationsApi(createHttpClient({ config, origin }));

const problem = (status: number, code: string) =>
  HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

describe('list', () => {
  it('sin estado no envía status; con estado y límite los envía', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${origin}/v1/agencies/A1/invitations`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json({ items: [invitationFixture()], nextCursor: 'c2' });
      }),
    );
    const page = await api.list('A1');
    expect(page.nextCursor).toBe('c2');
    expect(seen[0]?.searchParams.has('status')).toBe(false);
    await api.list('A1', { status: 'expired', limit: 20, cursor: 'c2' });
    expect(seen[1]?.searchParams.get('status')).toBe('expired');
    expect(seen[1]?.searchParams.get('limit')).toBe('20');
    expect(seen[1]?.searchParams.get('cursor')).toBe('c2');
  });

  it('lanza ValidationError si una invitación trae un estado fuera del contrato', async () => {
    server.use(
      http.get(`${origin}/v1/agencies/A1/invitations`, () =>
        HttpResponse.json({ items: [invitationFixture({ status: 'x' })], nextCursor: null }),
      ),
    );
    await expect(api.list('A1')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('invite', () => {
  it('hace POST con el cuerpo y devuelve la invitación con sus avisos', async () => {
    let body = '';
    server.use(
      http.post(`${origin}/v1/agencies/A1/invitations`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(
          { invitation: invitationFixture(), warnings: [{ code: 'email_not_sent' }] },
          { status: 201 },
        );
      }),
    );
    const result = await api.invite('A1', {
      email: 'nuevo@demo.test',
      fullName: 'Nuevo Demo',
      role: 'agent',
    });
    expect(JSON.parse(body)).toEqual({
      email: 'nuevo@demo.test',
      fullName: 'Nuevo Demo',
      role: 'agent',
    });
    expect(result.warnings).toEqual([{ code: 'email_not_sent' }]);
  });

  it('propaga el code de un 409 invitation_already_pending', async () => {
    server.use(
      http.post(`${origin}/v1/agencies/A1/invitations`, () =>
        problem(409, 'invitation_already_pending'),
      ),
    );
    const error = await api
      .invite('A1', { email: 'a@b.co', fullName: 'A', role: 'agent' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('invitation_already_pending');
  });
});

describe('resend y cancel', () => {
  it('resend hace POST a .../resend y devuelve la invitación', async () => {
    server.use(
      http.post(`${origin}/v1/agencies/A1/invitations/I1/resend`, () =>
        HttpResponse.json({ invitation: invitationFixture(), warnings: [] }),
      ),
    );
    const result = await api.resend('A1', 'I1');
    expect(result.invitation.status).toBe('pending');
  });

  it('cancel hace POST a .../cancel y resuelve sin cuerpo con 204', async () => {
    server.use(
      http.post(
        `${origin}/v1/agencies/A1/invitations/I1/cancel`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(api.cancel('A1', 'I1')).resolves.toBeUndefined();
  });
});

describe('preview y accept', () => {
  it('preview envía el token en el cuerpo y parsea la vista previa', async () => {
    let body = '';
    server.use(
      http.post(`${origin}/v1/invitations/preview`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json({
          agencyName: 'Inmobiliaria Demo',
          officeName: null,
          email: 'nuevo@demo.test',
          fullName: 'Nuevo Demo',
          role: 'agent',
          expiresAt: '2026-11-09T12:00:00.000Z',
        });
      }),
    );
    const preview = await api.preview('tok');
    expect(JSON.parse(body)).toEqual({ token: 'tok' });
    expect(preview.agencyName).toBe('Inmobiliaria Demo');
  });

  it('accept envía el token en el cuerpo y devuelve el rol', async () => {
    let body = '';
    server.use(
      http.post(`${origin}/v1/invitations/accept`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(
          {
            memberId: invitationFixture().id,
            agencyId: invitationFixture().agencyId,
            role: 'agent',
          },
          { status: 201 },
        );
      }),
    );
    const accepted = await api.accept('tok');
    expect(JSON.parse(body)).toEqual({ token: 'tok' });
    expect(accepted.role).toBe('agent');
  });
});
