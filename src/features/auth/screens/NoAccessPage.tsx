import { FieldGroup } from '@/components/ui/field';
import { es } from '@/lib/i18n/es';
import { AuthCard } from '@/components/shared/AuthCard';
import { LogoutButton } from '../components/LogoutButton';

export function NoAccessPage() {
  return (
    <AuthCard title={es.auth.noAccess.title} description={es.auth.noAccess.help}>
      <FieldGroup>
        <LogoutButton label={es.auth.noAccess.logout} variant="default" />
      </FieldGroup>
    </AuthCard>
  );
}
