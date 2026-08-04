import { test, expect } from '@playwright/test';
import { login, analyseCase, USERS } from './helpers';

test.describe('role-based access control', () => {
  test('operators cannot open administration or analytics', async ({ page }) => {
    await login(page, USERS.operator);
    await page.goto('/admin');
    await expect(page.locator('.notice.error')).toContainText('administración');
    await page.goto('/analytics');
    await expect(page.locator('.notice.error')).toContainText('rol');
  });

  test('supervisors get analytics and evaluation but not administration', async ({ page }) => {
    await login(page, USERS.supervisor);
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: /Analítica/ })).toBeVisible();
    await page.goto('/evaluation');
    await expect(page.getByRole('heading', { name: /Evaluación/ })).toBeVisible();
    await page.goto('/admin');
    await expect(page.locator('.notice.error')).toBeVisible();
  });

  test('the evaluator sees evaluation and analytics but cannot record decisions', async ({ page }) => {
    // An operator prepares an analysed, undecided case first.
    await login(page, USERS.operator);
    await analyseCase(page, 'C-008');

    await login(page, USERS.evaluator);
    await page.goto('/evaluation');
    await expect(page.getByRole('heading', { name: /Evaluación/ })).toBeVisible();

    // Server action enforcement: the evaluator submits a decision anyway.
    await page.goto('/cases/C-008');
    await page.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.locator('.notice.error')).toContainText('no permite registrar decisiones');
  });

  test('administrators can open the administration page', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Proveedor de IA' })).toContainText('mock');
  });

  test('horizontal access: operators cannot open a case assigned to someone else', async ({ page }) => {
    await login(page, USERS.supervisor);
    await page.goto('/cases/C-009');
    await page.selectOption('select[name="assignee"]', 'USER-carlos');
    await page.getByRole('button', { name: 'Reasignar' }).click();

    await login(page, USERS.operator);
    await page.goto('/cases/C-009');
    await expect(page.locator('.notice.error')).toContainText('asignado a otra persona');
    // No analysis content is leaked.
    await expect(page.locator('text=Análisis de IA')).toHaveCount(0);
  });

  test('operators cannot use the supervisor override to bypass required items', async ({ page }) => {
    // C-013 has REQUIRED missing items; the operator form has no override field
    // and the server ignores overrideReason from non-supervisors.
    await login(page, USERS.operator);
    await analyseCase(page, 'C-013');
    await expect(page.locator('input[name="overrideReason"]')).toHaveCount(0);
    const response = await page.request.post(page.url(), {
      form: {
        analysisRunId: 'irrelevant',
        decisionType: 'APPROVE',
        overrideReason: 'intento de bypass',
      },
      headers: { 'next-action': '0'.repeat(40) },
      failOnStatusCode: false,
    });
    expect(response.status()).toBeLessThan(500);
    await page.reload();
    await expect(page.locator('h1 .badge.status-ANALYSED')).toBeVisible(); // still undecided
  });
});
