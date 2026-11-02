import { expect, test, type Page } from '@playwright/test';
import { es } from '../src/lib/i18n/es';
import { totpCode } from './support/totp';

const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';
const totpSecret = process.env.E2E_ADMIN_TOTP_SECRET ?? '';
const enabled =
  process.env.E2E_BACKEND === '1' && email !== '' && password !== '' && totpSecret !== '';

async function loginWithTotp(page: Page) {
  await page.goto('/iniciar-sesion');
  await page.getByLabel(es.auth.login.email, { exact: true }).fill(email);
  await page.getByLabel(es.auth.login.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: es.auth.login.submit }).click();
  await expect(page).toHaveURL(/\/verificar/);
  await page
    .getByLabel(es.auth.verify.code, { exact: true })
    .pressSequentially(totpCode(totpSecret));
  await expect(page).toHaveURL(/\/$/);
}

test.describe('revisión de agencias contra el backend real', () => {
  test.skip(
    !enabled,
    'Requiere E2E_BACKEND=1, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD y E2E_ADMIN_TOTP_SECRET (admin MLS con 2FA ya activo) y al menos una agencia pendiente',
  );

  test('lista pendientes, abre el detalle con el municipio y exige el nombre para rechazar', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginWithTotp(page);

    await page.getByRole('link', { name: es.nav.agencies }).click();
    await expect(page).toHaveURL(/\/agencias\?status=pending/);
    const table = page.getByRole('table', { name: es.agencies.list.caption });
    await expect(table).toBeVisible();
    const firstRow = table.getByRole('row').nth(1);
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Detalle: la sede muestra «Municipio, Departamento» (filtro `codes` del backend) o, sin él, el código.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const location = page.getByText(es.agencies.detail.fields.location, { exact: true });
    await expect(location).toBeVisible();
    await expect(location.locator('xpath=following-sibling::dd[1]')).not.toHaveText('');

    // Rechazar: el botón de confirmar sigue deshabilitado hasta escribir motivo y nombre. No se envía.
    await page.getByRole('button', { name: es.agencies.review.actions.reject }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(es.agencies.review.twoFactorNotice)).toBeVisible();
    const confirm = dialog.getByRole('button', { name: es.agencies.review.actions.reject });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox', { name: es.agencies.review.reasonLabel }).fill('Prueba e2e');
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('button', { name: es.agencies.review.cancel }).click();
    await expect(dialog).toBeHidden();
  });
});
