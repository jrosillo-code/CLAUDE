import { test, expect, type Page } from '@playwright/test';
import { login, analyseCase, USERS } from './helpers';

/**
 * Prohibited-action sweep: no page may expose a control that sends email,
 * submits to an insurer, binds coverage, executes a cancellation, or approves/
 * denies a claim. "Aprobar análisis" (approving the INTERNAL analysis) is the
 * only approve-verb allowed; nothing may pair an external noun with an
 * execute verb.
 */

const FORBIDDEN_CONTROL_PATTERNS = [
  /^enviar\b/i, // send
  /\bsend\b/i,
  /\bsubmit to\b/i,
  /emitir póliza/i,
  /\bbind\b/i,
  /ejecutar (baja|cancelación)/i,
  /cancelar póliza/i,
  /aprobar (siniestro|cobertura|reclamación)/i,
  /denegar/i,
  /tramitar baja definitiva/i,
];

async function assertNoForbiddenControls(page: Page) {
  const controls = page.locator('button, input[type="submit"], a.btn, [role="button"]');
  const count = await controls.count();
  for (let i = 0; i < count; i++) {
    const label = ((await controls.nth(i).textContent()) ?? '') + ((await controls.nth(i).getAttribute('value')) ?? '');
    for (const pattern of FORBIDDEN_CONTROL_PATTERNS) {
      expect(label.trim(), `forbidden control "${label.trim()}" on ${page.url()}`).not.toMatch(pattern);
    }
  }
}

test.describe('no external-action controls exist anywhere', () => {
  test('sweep across every page type for every role', async ({ page }) => {
    for (const email of [USERS.operator, USERS.supervisor, USERS.admin, USERS.evaluator]) {
      await login(page, email);
      for (const path of ['/', '/cases/C-001', '/cases/C-003', '/cases/C-012', '/evaluation', '/analytics', '/admin']) {
        await page.goto(path);
        await assertNoForbiddenControls(page);
      }
    }
  });

  test('the analysis explicitly states external actions are not allowed', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-001');
    await expect(page.locator('text=Acción externa permitida')).toContainText('NO');
  });

  test('the response draft is editable but has no send pathway', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-008'); // analysed, undecided
    await expect(page.locator('textarea[name="draftBody"]')).toBeVisible();
    await expect(page.locator('fieldset', { hasText: 'Borrador de respuesta' })).toContainText('nunca se envía');
    await assertNoForbiddenControls(page);
  });
});
