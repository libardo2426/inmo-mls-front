import { describe, expect, it } from 'vitest';
import { propertyListItemFixture } from '@/test/fixtures';
import { propertyPageSchema } from './property-list-schema';

describe('propertyPageSchema (B-11)', () => {
  it('acepta una página válida', () => {
    const page = propertyPageSchema.parse({ items: [propertyListItemFixture()], nextCursor: 'c2' });
    expect(page.items[0]?.uniqueIdentifier).toBe('50C-1557984');
  });

  it('acepta editorAgencyId nulo y nextCursor nulo', () => {
    const page = propertyPageSchema.parse({
      items: [propertyListItemFixture({ editorAgencyId: null })],
      nextCursor: null,
    });
    expect(page.items[0]?.editorAgencyId).toBeNull();
  });

  it('rechaza un ítem sin id', () => {
    const sinId: Record<string, unknown> = propertyListItemFixture();
    delete sinId.id;
    expect(propertyPageSchema.safeParse({ items: [sinId], nextCursor: null }).success).toBe(false);
  });

  it('tolera un estado y un tipo desconocidos', () => {
    const item = propertyListItemFixture({ status: 'raro', propertyType: 'castillo' });
    expect(propertyPageSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(true);
  });
});
