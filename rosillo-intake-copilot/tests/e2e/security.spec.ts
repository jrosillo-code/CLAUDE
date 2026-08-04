import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers';

test.describe('security probes', () => {
  test('hostile customer content and forged AI output render inert (no XSS)', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });

    await login(page, USERS.supervisor);
    await page.goto('/cases/SEC-XSS');

    // The hostile strings are visible as text (escaped), not executed.
    await expect(page.locator('.email-body').first()).toContainText('<script>alert("body")</script>');
    await expect(page.locator('main')).toContainText('<script>alert("summary")</script>');
    await expect(page.locator('main')).toContainText('alert("filename")');

    // Open the attachment panel (hostile filename + content).
    await page.locator('details summary').first().click();
    await expect(page.locator('main')).toContainText('alert("attachment")');

    // The forged draft renders inside a textarea as inert text.
    await expect(page.locator('textarea[name="draftBody"]')).toHaveValue(/<script>alert\("draft"\)<\/script>/);

    // No dialog ever fired. (Framework data scripts legitimately contain the
    // payload as escaped JSON; what must not exist is any *live* injection
    // vector: event-handler attributes, hostile elements, or javascript: URLs.)
    expect(dialogs).toHaveLength(0);
    expect(await page.locator('[onerror], [onload]:not(body), img[src="x"], svg').count()).toBe(0);
    expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
  });

  test('direct server-action invocation without a session does not mutate state', async ({ page, request }) => {
    // POST at a case route with a forged Next-Action id and no session cookie.
    const response = await request.post('http://127.0.0.1:3100/cases/C-010', {
      form: { decisionType: 'APPROVE', analysisRunId: 'forged' },
      headers: { 'next-action': 'f'.repeat(40) },
      failOnStatusCode: false,
    });
    expect(response.status()).toBeLessThan(500); // no crash, no stack trace page
    const body = await response.text();
    expect(body).not.toMatch(/at\s+\w+\s+\(.*\.ts:\d+/); // no stack frames leaked

    await login(page, USERS.operator);
    await page.goto('/cases/C-010');
    // C-010 was never analysed nor decided by the forged request.
    await expect(page.getByRole('button', { name: 'Analizar caso' })).toBeVisible();
  });

  test('SQL-injection-shaped filter input is neutralised', async ({ page }) => {
    await login(page, USERS.operator);
    await page.goto(`/?status=${encodeURIComponent("NEW'; DROP TABLE cases;--")}`);
    // Invalid filter values are ignored by the allowlist; the inbox still renders.
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.goto('/');
    await expect(page.locator('tbody tr')).toHaveCount(20);
  });

  test('error pages and notices do not leak configuration', async ({ page }) => {
    await login(page, USERS.operator);
    await page.goto('/cases/does-not-exist');
    await expect(page.locator('body')).not.toContainText('rosillo.db');
    await expect(page.locator('body')).not.toContainText('ANTHROPIC');
    await expect(page.locator('body')).not.toContainText('AUTH_SECRET');
  });

  test('health endpoints require no auth but expose no secrets', async ({ request }) => {
    const health = await request.get('http://127.0.0.1:3100/api/health');
    expect(health.status()).toBe(200);
    const ready = await request.get('http://127.0.0.1:3100/api/ready');
    expect([200, 503]).toContain(ready.status());
    const text = (await health.text()) + (await ready.text());
    expect(text).not.toMatch(/sk-ant|AUTH_SECRET|e2e-secret/);
  });
});
