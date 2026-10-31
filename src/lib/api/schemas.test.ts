import { describe, expect, it } from 'vitest';
import me from '@/lib/api/__fixtures__/me.json';
import {
  meResponseSchema,
  problemDetailsSchema,
  propertyDetailResponseSchema,
} from '@/lib/api/schemas';

describe('meResponseSchema', () => {
  it('acepta la respuesta de /me del contrato', () => {
    expect(meResponseSchema.parse(me).tenant.code).toBe('co');
  });

  it('rechaza un alcance de permiso fuera de own|agency|network', () => {
    const bad = structuredClone(me);
    (bad.membership.permissions as Record<string, string>)['property.read'] = 'global';
    expect(meResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('acepta membership nulo (sesión sin membresía)', () => {
    expect(meResponseSchema.parse({ ...me, membership: null }).membership).toBeNull();
  });
});

describe('problemDetailsSchema', () => {
  const base = {
    type: 'https://example.test/problems/property_already_registered',
    title: 'El inmueble ya está registrado en el MLS: vincule su encargo',
    status: 409,
    instance: '/v1/properties',
    code: 'property_already_registered',
    requestId: '01JC0000',
    details: { propertyId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b' },
  };

  it('acepta un problem+json con details', () => {
    expect(problemDetailsSchema.parse(base).code).toBe('property_already_registered');
  });

  it('acepta errors[] de validación', () => {
    const parsed = problemDetailsSchema.parse({
      ...base,
      status: 400,
      code: 'validation_failed',
      errors: [{ path: 'mandate.endDate', code: 'too_small', message: 'Fecha inválida' }],
    });
    expect(parsed.errors?.[0]?.path).toBe('mandate.endDate');
  });
});

describe('propertyDetailResponseSchema', () => {
  const prices = propertyDetailResponseSchema.shape.listPrices;

  it('conserva amountMinor de 18 dígitos como string sin perder precisión', () => {
    const parsed = prices.parse([
      { operation: 'sale', price: { amountMinor: '999999999999999999', currency: 'COP' } },
    ]);
    expect(parsed[0]?.price.amountMinor).toBe('999999999999999999');
  });

  it('rechaza amountMinor como number', () => {
    const result = prices.safeParse([
      { operation: 'sale', price: { amountMinor: 250000000000, currency: 'COP' } },
    ]);
    expect(result.success).toBe(false);
  });
});
