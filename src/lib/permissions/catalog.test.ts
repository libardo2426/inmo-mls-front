import { describe, expect, it } from 'vitest';
import backendDoc from '../../../docs/backend/contexto-para-frontend.md?raw';
import { PERMISSIONS } from './catalog';

/** Nombres de la tabla «Permisos» de la documentación del backend. */
function backendPermissions(): string[] {
  const lines = backendDoc.split('\n');
  const start = lines.findIndex((line) => line.startsWith('| Permiso | Alcances'));
  expect(start).toBeGreaterThanOrEqual(0);
  const names: string[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    for (const match of line.matchAll(/`([a-z_]+\.[a-z_]+)`/g)) names.push(match[1] as string);
  }
  return names;
}

describe('catálogo de permisos', () => {
  it('coincide exactamente con la tabla de permisos del backend', () => {
    expect([...PERMISSIONS].sort()).toEqual(backendPermissions().sort());
  });

  it('no tiene duplicados', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('no incluye permisos de sistema', () => {
    const system = ['media.process', 'upload.cleanup', 'audit.verify_chain', 'user_index.write'];
    for (const name of system) expect(PERMISSIONS).not.toContain(name);
  });
});
