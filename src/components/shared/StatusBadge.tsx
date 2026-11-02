import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-text-muted',
};

/** Etiqueta de estado por tono semántico; el texto siempre acompaña al color. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Badge variant={tone}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </Badge>
  );
}
