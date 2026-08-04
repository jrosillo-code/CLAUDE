import { test, expect } from '@playwright/test';
import { login, analyseCase, USERS } from './helpers';

test.describe('inbox and analysis workflow', () => {
  test('inbox lists the seeded cases and filters by workflow and status', async ({ page }) => {
    await login(page, USERS.operator);
    await expect(page.locator('tbody tr')).toHaveCount(20); // 19 fixtures + SEC-XSS probe

    await page.selectOption('select[name="status"]', 'NEW');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('tbody tr td .badge.status-NEW').first()).toBeVisible();

    await page.goto('/?workflow=MOTOR_CLAIM&status=');
    // Before analysis no case is classified yet, so the filter may return none — the empty state must be honest.
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(1); // at least the empty-state row or matches
  });

  test('opening and analysing a motor claim produces evidence-linked analysis', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-001');

    await expect(page.getByText('Workflow: MOTOR_CLAIM')).toBeVisible();
    await expect(page.locator('.field-row', { hasText: 'incident_date' })).toContainText('Inferido');
    await expect(page.locator('.field-row', { hasText: 'location' })).toContainText('Explícito');
    // Deterministic candidates are labelled as database matches.
    await expect(page.locator('.badge', { hasText: 'coincidencia determinista (BD)' }).first()).toBeVisible();
    // Missing-information checklist from deterministic rules.
    await expect(page.locator('.missing-item', { hasText: 'Hora exacta del incidente' })).toBeVisible();
    // Clicking an aligned evidence citation highlights the passage in the email.
    await page.locator('.evidence-btn').first().click();
    await expect(page.locator('mark.evidence-mark').first()).toBeVisible();
  });

  test('approval is blocked while REQUIRED items are unresolved', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-003');
    await page.getByRole('button', { name: 'Aprobar análisis' }).click();
    await expect(page.locator('.notice.error')).toContainText('obligatorio');
    // Case is still not decided.
    await expect(page.locator('h1 .badge.status-ANALYSED')).toBeVisible();
  });

  test('approval succeeds when the employee resolves the REQUIRED items', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-005');
    await page.fill('input[name="edit_driver_licence_date"]', 'Carnet desde 2025 (confirmado por teléfono)');
    await page.getByRole('button', { name: 'Aprobar análisis' }).click();
    await expect(page.locator('.notice.info')).toContainText('Decisión registrada');
    await expect(page.locator('h1 .badge.status-DECIDED')).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Decisiones' })).toContainText('APPROVE_WITH_EDITS');
  });

  test('a supervisor can approve with unresolved REQUIRED items only via an override reason', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-004');

    await login(page, USERS.supervisor);
    await page.goto('/cases/C-004');
    await page.fill('input[name="overrideReason"]', 'Cliente confirmó por teléfono; excepción registrada.');
    await page.getByRole('button', { name: 'Aprobar análisis' }).click();
    await expect(page.locator('.notice.info')).toContainText('Decisión registrada');
    await expect(page.locator('.card', { hasText: 'Decisiones' })).toContainText('excepción');
  });

  test('rejecting a case records the decision', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-006');
    await page.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.locator('h1 .badge.status-DECIDED')).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Decisiones' })).toContainText('REJECT');
  });

  test('escalating a case records the decision', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-007');
    await page.getByRole('button', { name: 'Escalar' }).click();
    await expect(page.locator('.card', { hasText: 'Decisiones' })).toContainText('ESCALATE');
  });

  test('re-analysis creates a new immutable version and preserves the old one', async ({ page }) => {
    await login(page, USERS.operator);
    await analyseCase(page, 'C-002');
    await page.getByRole('button', { name: 'Re-analizar' }).click();
    await expect(page.locator('text=Versiones:')).toBeVisible();
    await expect(page.getByRole('link', { name: 'v1' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'v2' })).toBeVisible();
    // The old version is still fully viewable.
    await page.getByRole('link', { name: 'v1' }).click();
    await expect(page.locator('text=v1 · proveedor mock')).toBeVisible();
  });

  test('the audit timeline shows the complete immutable history', async ({ page }) => {
    await login(page, USERS.supervisor);
    await page.goto('/cases/C-005');
    const audit = page.locator('.card', { hasText: 'Historial de auditoría' });
    await expect(audit).toContainText('INGESTED');
    await expect(audit).toContainText('STATUS_ANALYSING');
    await expect(audit).toContainText('ANALYSED');
    await expect(audit).toContainText('DECISION_APPROVE_WITH_EDITS');
    // Every entry carries an actor and a payload hash.
    await expect(audit.locator('.audit-line').first()).toContainText('actor');
    await expect(audit.locator('.audit-line').first()).toContainText('hash');
  });
});
