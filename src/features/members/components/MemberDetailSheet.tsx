import { useState, type ReactNode } from 'react';
import { DescriptionItem, DescriptionList } from '@/components/shared/DescriptionList';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDate } from '@/lib/format';
import type { Member } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { MemberStatusBadge } from './MemberStatusBadge';

type Props = { member: Member; onClose: () => void; children?: ReactNode };

/** Detalle de un miembro con los datos de la lista (el backend no tiene endpoint de detalle). */
export function MemberDetailSheet({ member, onClose, children }: Props) {
  // Sin `SheetTrigger`, Radix no devuelve el foco: se guarda quién lo tenía al abrir.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{es.members.detail.title}</SheetTitle>
          <SheetDescription>{member.fullName}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <DescriptionList>
            <DescriptionItem label={es.members.columns.name}>{member.fullName}</DescriptionItem>
            <DescriptionItem label={es.members.columns.email}>{member.email}</DescriptionItem>
            <DescriptionItem label={es.members.columns.role}>
              {(es.members.roles as Record<string, string>)[member.role] ?? member.role}
            </DescriptionItem>
            <DescriptionItem label={es.members.columns.status}>
              <MemberStatusBadge status={member.status} />
            </DescriptionItem>
            <DescriptionItem label={es.members.columns.since}>
              {formatDate(member.since)}
            </DescriptionItem>
          </DescriptionList>
          {children ? <div className="flex gap-2">{children}</div> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
