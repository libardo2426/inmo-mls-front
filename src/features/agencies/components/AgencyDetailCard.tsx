import { DescriptionItem, DescriptionList } from '@/components/shared/DescriptionList';
import { Section } from '@/components/shared/Section';
import { useTerritoryName } from '@/lib/territory/useTerritoryName';
import type { AgencyApplication } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { formatDate } from '@/lib/format';
import { AgencyStatusBadge } from './AgencyStatusBadge';

const f = es.agencies.detail.fields;

/** Datos de una solicitud, solo lectura. */
export function AgencyDetailCard({ agency }: { agency: AgencyApplication }) {
  const location = useTerritoryName(agency.mainOffice.territorialUnitCode);
  return (
    <div className="flex flex-col gap-6">
      <Section title={es.agencies.detail.sections.application}>
        <DescriptionList>
          <DescriptionItem label={f.legalName}>{agency.legalName}</DescriptionItem>
          <DescriptionItem label={f.taxId}>{`${agency.taxIdType} ${agency.taxId}`}</DescriptionItem>
          <DescriptionItem label={f.email}>{agency.email}</DescriptionItem>
          <DescriptionItem label={f.phone}>{agency.phone}</DescriptionItem>
          <DescriptionItem label={f.status}>
            <AgencyStatusBadge status={agency.status} />
          </DescriptionItem>
          <DescriptionItem label={f.submittedAt}>{formatDate(agency.submittedAt)}</DescriptionItem>
        </DescriptionList>
      </Section>
      {agency.reviewReason !== null || agency.reviewedAt !== null ? (
        <Section title={es.agencies.detail.sections.review}>
          <DescriptionList>
            {agency.reviewReason !== null ? (
              <DescriptionItem label={f.reviewReason}>{agency.reviewReason}</DescriptionItem>
            ) : null}
            {agency.reviewedAt !== null ? (
              <DescriptionItem label={f.reviewedAt}>
                {formatDate(agency.reviewedAt)}
              </DescriptionItem>
            ) : null}
          </DescriptionList>
        </Section>
      ) : null}
      <Section title={es.agencies.detail.sections.office}>
        <DescriptionList>
          <DescriptionItem label={f.officeName}>{agency.mainOffice.name}</DescriptionItem>
          <DescriptionItem label={f.location}>{location.label}</DescriptionItem>
          <DescriptionItem label={f.address}>{agency.mainOffice.address}</DescriptionItem>
          <DescriptionItem label={f.officePhone}>{agency.mainOffice.phone}</DescriptionItem>
        </DescriptionList>
      </Section>
    </div>
  );
}
