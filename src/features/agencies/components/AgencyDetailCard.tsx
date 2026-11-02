import type { ReactNode } from 'react';
import { useTerritoryName } from '@/lib/territory/useTerritoryName';
import type { AgencyApplication } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { formatDate } from '../format';
import { AgencyStatusBadge } from './AgencyStatusBadge';

const f = es.agencies.detail.fields;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">{children}</dl>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

const orNone = (value: string | null) => value ?? es.agencies.detail.none;

/** Datos de una solicitud, solo lectura. */
export function AgencyDetailCard({ agency }: { agency: AgencyApplication }) {
  const location = useTerritoryName(agency.mainOffice.territorialUnitCode);
  return (
    <div className="flex flex-col gap-6">
      <Section title={es.agencies.detail.sections.application}>
        <Field label={f.legalName}>{agency.legalName}</Field>
        <Field label={f.taxId}>{`${agency.taxIdType} ${agency.taxId}`}</Field>
        <Field label={f.email}>{orNone(agency.email)}</Field>
        <Field label={f.phone}>{orNone(agency.phone)}</Field>
        <Field label={f.status}>
          <AgencyStatusBadge status={agency.status} />
        </Field>
        <Field label={f.submittedAt}>{formatDate(agency.submittedAt)}</Field>
      </Section>
      {agency.reviewReason !== null || agency.reviewedAt !== null ? (
        <Section title={es.agencies.detail.sections.review}>
          {agency.reviewReason !== null ? (
            <Field label={f.reviewReason}>{agency.reviewReason}</Field>
          ) : null}
          {agency.reviewedAt !== null ? (
            <Field label={f.reviewedAt}>{formatDate(agency.reviewedAt)}</Field>
          ) : null}
        </Section>
      ) : null}
      <Section title={es.agencies.detail.sections.office}>
        <Field label={f.officeName}>{agency.mainOffice.name}</Field>
        <Field label={f.location}>{location.label}</Field>
        <Field label={f.address}>{orNone(agency.mainOffice.address)}</Field>
        <Field label={f.officePhone}>{orNone(agency.mainOffice.phone)}</Field>
      </Section>
    </div>
  );
}
