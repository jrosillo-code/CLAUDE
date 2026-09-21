import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 4200 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
// Evening, by the page's clock.
await page.clock.install({ time: new Date("2026-09-20T20:30:00") });
await page.goto(`${B}/`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(4000);
await page.clock.runFor(2000);
const bubble = page.locator('[data-testid="digest-bubble"]');
ok("in the evening a Tonight bubble sits at the head of the stories", (await bubble.count()) === 1);
if (await bubble.count()) {
  await bubble.click({ timeout: 5000 }); await page.waitForTimeout(1200);
  const title = await page.locator('[data-testid="digest-title"]').innerText().catch(() => "");
  ok("the bubble opens the digest", /picks|Worth a look/.test(title), title);
  const picks = await page.locator('[data-testid^="digest-pick-"]').count();
  ok("it holds two to five picks with reasons", picks >= 2 && picks <= 5 && (await page.locator('[data-testid="digest-pick-0"] .text-accent').count()) >= 1, String(picks));
  const owners = await page.locator('[data-testid^="digest-pick-"]').allInnerTexts();
  ok("no pick is the viewer's own", !owners.some((t) => /· you\b/.test(t)));
  await page.locator('[data-testid="digest-pick-0"]').click({ timeout: 5000 }); await page.clock.runFor(1500); await page.waitForTimeout(2000);
  ok("tapping a pick flies there and opens the pin", (await page.locator('[role="dialog"][aria-modal="true"]').count()) >= 1);
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  ok("once opened, the bubble is gone for tonight", (await bubble.count()) === 0);
}
// The feed always leads with the picks.
await page.getByTitle("Latest pins").click({ timeout: 5000 }); await page.waitForTimeout(1200);
ok("the feed leads with the picks", (await page.locator('[data-testid="feed-digest"] li').count()) >= 2);
await page.keyboard.press("Escape");
// Morning: no bubble.
const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page2.clock.install({ time: new Date("2026-09-21T10:00:00") });
await page2.goto(`${B}/`, { waitUntil: "domcontentloaded" }); await page2.waitForTimeout(1500);
const g2 = page2.getByRole("button", { name: /Continue with Apple/ }); if (await g2.count()) await g2.click();
await page2.waitForTimeout(4000);
ok("in the morning there is no bubble", (await page2.locator('[data-testid="digest-bubble"]').count()) === 0);
// Leaderboard carries the "only" tag.
await page2.locator('button:has-text("Travelers")').first().click({ timeout: 5000 }).catch(() => {});
await page2.waitForTimeout(600);
const lb = page2.locator('[data-testid="country-leaderboard"]').first();
if (await lb.count()) { await lb.locator("button").first().click(); await page2.waitForTimeout(300); ok("leaderboard shows how many countries only that person has", (await lb.locator('span:has-text(" only")').count()) >= 1); }
ok("zero page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await finish(browser);
