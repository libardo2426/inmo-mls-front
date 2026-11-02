import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AgencyStatus } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { AgencyStatusBadge } from './AgencyStatusBadge';

const TONE_BY_STATUS: Record<AgencyStatus, string> = {
  pending: 'warning',
  active: 'success',
  rejected: 'danger',
  changes_requested: 'info',
  suspended: 'danger',
  terminated: 'neutral',
};

describe('AgencyStatusBadge', () => {
  it.each(Object.entries(TONE_BY_STATUS) as [AgencyStatus, string][])(
    'el estado %s se muestra con tono %s y su texto',
    (status, tone) => {
      render(<AgencyStatusBadge status={status} />);
      const badge = screen.getByText(es.agencies.status[status]).closest('[data-slot="badge"]');
      expect(badge).toHaveAttribute('data-variant', tone);
    },
  );

  it('un estado desconocido no rompe: tono neutral y valor crudo', () => {
    render(<AgencyStatusBadge status={'algo_nuevo' as never} />);
    const badge = screen.getByText('algo_nuevo').closest('[data-slot="badge"]');
    expect(badge).toHaveAttribute('data-variant', 'neutral');
  });
});
