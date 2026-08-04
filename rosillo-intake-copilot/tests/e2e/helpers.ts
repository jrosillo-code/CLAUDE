import { expect, type Page } from '@playwright/test';

export const USERS = {
  operator: 'ana@rosillo.test',
  supervisor: 'carlos@rosillo.test',
  admin: 'admin@rosillo.test',
  evaluator: 'eva@rosillo.test',
  claims: 'clara@rosillo.test',
} as const;

export async function login(page: Page, email: string) {
  await page.context().clearCookies(); // support switching users within a test
  await page.goto('/login');
  await page.selectOption('select[name="email"]', email);
  await page.fill('input[name="password"]', 'demo');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/');
  await expect(page.locator('.top-nav .user')).toContainText(email.split('@')[0]!.split('.')[0]!, {
    ignoreCase: true,
  });
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Salir' }).click();
  await page.waitForURL('**/login');
}

/** Ensures a case is analysed (idempotent) and waits for the result panel. */
export async function analyseCase(page: Page, caseId: string) {
  await page.goto(`/cases/${caseId}`);
  const button = page.getByRole('button', { name: 'Analizar caso' });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
  await expect(page.locator('text=Workflow:')).toBeVisible();
}
