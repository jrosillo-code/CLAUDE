import { test, expect } from '@playwright/test';
import { login, logout, USERS } from './helpers';

test.describe('authentication', () => {
  test('unauthenticated users are redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/cases/C-001');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login shows the synthetic banner and inbox; logout returns to login', async ({ page }) => {
    await login(page, USERS.operator);
    await expect(page.locator('.synthetic-banner')).toContainText('DATOS SINTÉTICOS');
    await expect(page.getByRole('heading', { name: 'Bandeja de entrada' })).toBeVisible();
    await logout(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('wrong password is rejected', async ({ page }) => {
    await page.goto('/login');
    await page.selectOption('select[name="email"]', USERS.operator);
    await page.fill('input[name="password"]', 'wrong');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('.notice.error')).toContainText('Credenciales no válidas');
  });

  test('a tampered session cookie is rejected', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'rosillo_session',
        value: 'USER-admin.0000000000000000000000000000000000000000000000000000000000000000',
        url: 'http://127.0.0.1:3100',
      },
    ]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a malformed session cookie is rejected', async ({ page, context }) => {
    await context.addCookies([
      { name: 'rosillo_session', value: 'garbage-without-signature', url: 'http://127.0.0.1:3100' },
    ]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
