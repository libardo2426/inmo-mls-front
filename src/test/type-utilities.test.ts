import { cn } from 'cn';
import { describe, expect, it } from 'vitest';

describe('utilidades tipográficas con cn', () => {
  it.each(['type-page-title', 'type-section-title', 'type-label', 'type-data'])(
    '%s sobrevive a una clase de color posterior',
    (utility) => {
      const merged = cn(utility, 'text-muted-foreground');
      expect(merged).toContain(utility);
      expect(merged).toContain('text-muted-foreground');
    },
  );
});
