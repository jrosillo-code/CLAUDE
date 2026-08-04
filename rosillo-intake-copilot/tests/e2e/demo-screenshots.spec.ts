import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { login, USERS } from './helpers';

/**
 * Captures the three guided-demo workflows (docs/DEMO.md) as screenshots.
 * Runs last (file ordering: demo- < n... actually alphabetical) — cases are
 * prepared here independently so ordering does not matter.
 */

const shotsDir = join(process.cwd(), 'docs', 'screenshots');

test.beforeAll(() => {
  mkdirSync(shotsDir, { recursive: true });
});

test.describe('demo screenshots', () => {
  test.use({ viewport: { width: 1440, height: 1080 } });

  test('demo 1 — straightforward motor claim (C-001)', async ({ page }) => {
    await login(page, USERS.operator);
    await page.goto('/cases/C-001');
    if (await page.getByRole('button', { name: 'Analizar caso' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Analizar caso' }).click();
    }
    await expect(page.getByText('Workflow: MOTOR_CLAIM')).toBeVisible();
    await page.screenshot({ path: join(shotsDir, 'demo-1-motor-claim.png'), fullPage: true });
  });

  test('demo 2 — cancellation with missing required information (C-003)', async ({ page }) => {
    await login(page, USERS.operator);
    await page.goto('/cases/C-003');
    if (await page.getByRole('button', { name: 'Analizar caso' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Analizar caso' }).click();
    }
    await expect(page.getByText('Workflow: POLICY_CANCELLATION')).toBeVisible();
    await expect(page.locator('.missing-item', { hasText: 'Fecha de efecto' })).toBeVisible();
    await page.screenshot({ path: join(shotsDir, 'demo-2-cancellation-missing-info.png'), fullPage: true });
  });

  test('demo 3 — adversarial prompt-injection marketing email (C-012)', async ({ page }) => {
    await login(page, USERS.operator);
    await page.goto('/cases/C-012');
    if (await page.getByRole('button', { name: 'Analizar caso' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Analizar caso' }).click();
    }
    await expect(page.getByText('Workflow: UNKNOWN')).toBeVisible();
    await expect(page.locator('strong', { hasText: 'NO_ACTION_NOT_OPERATIONAL' })).toBeVisible();
    await page.screenshot({ path: join(shotsDir, 'demo-3-prompt-injection.png'), fullPage: true });
  });
});
