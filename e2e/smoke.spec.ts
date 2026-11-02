import { expect, test, type Page } from '@playwright/test';

// `/` es una ruta protegida: el humo no necesita backend, así que simula una sesión válida en /me.
async function mockSession(page: Page) {
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b',
          email: 'admin@innmo.test',
          name: 'Admin',
          twoFactorEnabled: true,
        },
        tenant: { code: 'co', name: 'Colombia', configVersion: 1 },
        membership: {
          role: 'admin',
          agencyId: null,
          agencyStatus: null,
          permissions: {},
          twoFactorRequired: true,
        },
        config: {
          currency: 'COP',
          timezone: 'America/Bogota',
          locale: 'es-CO',
          areaUnit: 'm2',
          uniqueIdentifierLabel: 'Matrícula inmobiliaria',
        },
      }),
    }),
  );
}

test.describe('humo de la imagen servida por Nginx', () => {
  test('carga la página base sin errores de consola ni violaciones de CSP', async ({ page }) => {
    await mockSession(page);
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`consola: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP: ${event.violatedDirective} ${event.blockedURI}`);
      });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Innmo MLS' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('el conmutador alterna a oscuro y la preferencia persiste al recargar', async ({ page }) => {
    await mockSession(page);
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Cambiar tema' }).click();
    await expect(html).toHaveClass(/dark/);

    await page.reload();
    await expect(html).toHaveClass(/dark/);
  });

  test('el QR de activación de 2FA se dibuja bajo la CSP, con la clave en texto (CA7)', async ({
    page,
  }) => {
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
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Se requiere 2FA',
          status: 403,
          code: 'two_factor_required',
        }),
      }),
    );
    await page.route('**/v1/auth/two-factor/enable', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          totpURI: 'otpauth://totp/Innmo:admin%40innmo.test?secret=JBSWY3DPEHPK3PXP&issuer=Innmo',
          backupCodes: ['aaaaa-11111', 'bbbbb-22222'],
        }),
      }),
    );

    await page.goto('/activar-2fa');
    await page.getByLabel('Contraseña actual', { exact: true }).fill('una-clave-larga-1');
    await page.getByRole('button', { name: 'Continuar' }).click();

    const qr = page.getByRole('img', { name: 'Código QR para la aplicación de autenticación' });
    await expect(qr).toBeVisible();
    await expect(page.locator('code')).toHaveText('JBSWY3DPEHPK3PXP');
    // El QR debe tener módulos dibujados (un SVG vacío también sería «visible»).
    expect(await qr.locator('path').count()).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  test('la pantalla de verificación (campo OTP) carga bajo la CSP sin violaciones', async ({
    page,
  }) => {
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
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({ title: 'No autenticado', status: 401, code: 'unauthorized' }),
      }),
    );

    await page.goto('/verificar');
    await expect(page.getByLabel('Código de 6 dígitos', { exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('una configuración inválida muestra la pantalla de error de configuración', async ({
    page,
  }) => {
    await page.route('**/config.js', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__APP_CONFIG__ = { APP_ENV: "no-valido" };',
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Error de configuración' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Innmo MLS' })).toHaveCount(0);
  });

  test('las cabeceras de seguridad están presentes', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(headers['referrer-policy']).toBeTruthy();
    expect(headers['permissions-policy']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toBeTruthy();
  });
});
