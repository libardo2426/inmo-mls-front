import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { DescriptionItem, DescriptionList } from '@/components/shared/DescriptionList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AuthCard } from '@/components/shared/AuthCard';
import type { InvitationPreview } from '@/lib/api/schemas';
import { formatDate } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useInvitationsApi } from '../hooks/useInvitationsApi';
import { invitationErrorMessage } from '../messages';
import { getInvitationToken, readTokenFromHash, setInvitationToken } from '../token';

const t = es.invitations.accept;

const BY_CODE: Record<string, string> = {
  invitation_not_found: t.invalidLink,
  invitation_not_pending: t.errors.notPending,
  invitation_expired: t.errors.expired,
  already_member: t.errors.alreadyMember,
  invitation_email_mismatch: t.errors.mismatch,
  agency_not_active: t.errors.agencyNotActive,
};

/** Texto del error de vista previa o de aceptar; decide por `code`, nunca por el título. */
function acceptErrorMessage(error: unknown): string {
  if (error instanceof ApiError && !(error.status === 429)) {
    const byCode = BY_CODE[error.code];
    if (byCode) return byCode;
  }
  return invitationErrorMessage(error);
}

/**
 * Toma el token del fragmento de la URL y lo guarda en memoria. Es idempotente: si el componente se
 * monta dos veces, la segunda no encuentra fragmento y conserva el token. La URL se limpia aparte,
 * en un efecto, porque `replaceState` avisa al router y no debe ocurrir durante el render.
 */
function takeTokenFromUrl(): string | null {
  const fromHash = readTokenFromHash(window.location.hash);
  if (fromHash) setInvitationToken(fromHash);
  return getInvitationToken();
}

/** Errores definitivos del servidor (4xx): reintentar no los cambia. */
const isDefinitive = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500;

type Props = {
  session: 'anonymous' | 'no-membership' | 'authenticated';
  /** Autenticación del invitado; la aporta la ruta para no importar entre features. */
  renderAuth: (invitation: InvitationPreview, signedIn: boolean) => ReactNode;
  onAccepted: () => void;
};

/** Página pública de aceptación: vista previa de la invitación, autenticación y «Aceptar». */
export function AcceptInvitationScreen({ session, renderAuth, onAccepted }: Props) {
  const api = useInvitationsApi();
  const [token] = useState(takeTokenFromUrl);

  // El token ya está en memoria: se quita el fragmento de la URL conservando el estado del historial.
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  const preview = useQuery({
    queryKey: ['invitations', 'preview', token],
    queryFn: () => api.preview(token ?? ''),
    enabled: token !== null,
    staleTime: Infinity,
  });
  const accept = useMutation({
    mutationKey: ['invitations', 'accept'],
    mutationFn: () => api.accept(token ?? ''),
    onSuccess: () => {
      setInvitationToken(null);
      onAccepted();
    },
  });

  if (token === null) return <Notice message={t.invalidLink} />;
  if (preview.isPending) {
    return (
      <AuthCard title={t.title}>
        <p role="status" className="type-data flex items-center gap-2">
          <Spinner /> {t.loading}
        </p>
      </AuthCard>
    );
  }
  if (preview.isError) {
    return (
      <Notice
        message={acceptErrorMessage(preview.error)}
        onRetry={isDefinitive(preview.error) ? undefined : () => void preview.refetch()}
      />
    );
  }

  const invitation = preview.data;
  return (
    <AuthCard title={t.title} description={t.invitedTo(invitation.agencyName)}>
      <div className="flex flex-col gap-4">
        <DescriptionList>
          {invitation.officeName ? (
            <DescriptionItem label={t.office}>{invitation.officeName}</DescriptionItem>
          ) : null}
          <DescriptionItem label={t.email}>{invitation.email}</DescriptionItem>
          <DescriptionItem label={t.name}>{invitation.fullName}</DescriptionItem>
          <DescriptionItem label={t.role}>
            {(es.members.roles as Record<string, string>)[invitation.role] ?? invitation.role}
          </DescriptionItem>
          <DescriptionItem label={t.expires}>{formatDate(invitation.expiresAt)}</DescriptionItem>
        </DescriptionList>

        {session === 'authenticated' ? (
          <>
            <p className="type-data">{t.alreadyHasAgency}</p>
            <a href="/" className="text-sm underline underline-offset-4">
              {t.goHome}
            </a>
          </>
        ) : (
          <>
            {renderAuth(invitation, session === 'no-membership')}
            {session === 'no-membership' ? (
              <>
                {accept.isError ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{acceptErrorMessage(accept.error)}</AlertDescription>
                  </Alert>
                ) : null}
                <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
                  {accept.isPending ? <Spinner data-icon="inline-start" /> : null}
                  {accept.isPending ? t.pending : t.submit}
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </AuthCard>
  );
}

function Notice({ message, onRetry }: { message: string; onRetry?: (() => void) | undefined }) {
  return (
    <AuthCard title={t.title}>
      <div className="flex flex-col gap-3">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            {es.states.retry}
          </Button>
        ) : null}
      </div>
    </AuthCard>
  );
}
