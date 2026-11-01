import { expect, test, type Page } from '@playwright/test';
import { es } from '../src/lib/i18n/es';
import { totpCode } from './support/totp';

const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';
const enabled = process.env.E2E_BACKEND === '1' && email !== '' && password !== '';

async function login(page: Page) {
  await page.goto('/iniciar-sesion');
  await page.getByLabel(es.auth.login.email, { exact: true }).fill(email);
  await page.getByLabel(es.auth.login.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: es.auth.login.submit }).click();
}

async function expectHome(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: es.app.name })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: es.auth.home.logout }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion/);
}

test.describe('autenticación contra el backend real (CA20)', () => {
  test.skip(
    !enabled,
    'Requiere E2E_BACKEND=1, E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD (admin MLS recién creado, sin 2FA)',
  );

  test('login → activar 2FA → cerrar sesión → TOTP → cerrar sesión → código de respaldo', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // CA7: sin errores de consola ni violaciones de CSP. Chromium registra como error de consola
    // cada respuesta 4xx de una petición (p. ej. el 401 de /me sin sesión); eso es esperado aquí.
    const problems: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && !text.startsWith('Failed to load resource')) {
        problems.push(`consola: ${text}`);
      }
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP: ${event.violatedDirective} ${event.blockedURI}`);
      });
    });

    // 1) Login sin 2FA: el backend exige activarlo antes de entrar.
    await login(page);
    await expect(page).toHaveURL(/\/activar-2fa/);

    // 2) Activación: contraseña → clave en texto → primer código → códigos de respaldo.
    await page.getByLabel(es.auth.activate.password, { exact: true }).fill(password);
    await page.getByRole('button', { name: es.auth.activate.start }).click();
    await expect(page.getByRole('img', { name: es.auth.activate.qrLabel })).toBeVisible();
    const secret = (await page.locator('code').first().innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    await page
      .getByLabel(es.auth.activate.code, { exact: true })
      .pressSequentially(totpCode(secret));

    await expect(
      page.getByRole('heading', { level: 1, name: es.auth.activate.codesTitle }),
    ).toBeVisible();
    const backupCode = (await page.getByRole('listitem').first().innerText()).trim();
    expect(backupCode).not.toBe('');
    await page.getByRole('checkbox', { name: es.auth.activate.saved }).check();
    await page.getByRole('button', { name: es.auth.activate.continue }).click();
    await expectHome(page);

    // 3) Nuevo login con TOTP.
    await logout(page);
    await login(page);
    await expect(page).toHaveURL(/\/verificar/);
    await page.getByLabel(es.auth.verify.code, { exact: true }).pressSequentially(totpCode(secret));
    await expectHome(page);

    // 4) Nuevo login con el código de respaldo.
    await logout(page);
    await login(page);
    await expect(page).toHaveURL(/\/verificar/);
    await page.getByRole('button', { name: es.auth.verify.useBackup }).click();
    await page.getByLabel(es.auth.verify.backupCode, { exact: true }).fill(backupCode);
    await page.getByRole('button', { name: es.auth.verify.submit }).click();
    await expectHome(page);

    expect(problems).toEqual([]);
  });
});
