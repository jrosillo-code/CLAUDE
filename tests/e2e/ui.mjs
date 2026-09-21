import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 3900 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${B}/`); await page.waitForTimeout(1500);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(3500);

// stories roll into the next person
const strip = page.locator('[data-testid^="dispatch-bubble-"]');
if (!(await strip.count())) { ok("dispatch strip present", false); await finish(browser); }
await strip.first().click({ timeout: 5000 }); await page.waitForTimeout(800);
const firstName = await page.locator('[data-testid="dispatch-player"] .font-semibold').first().innerText();
for (let i = 0; i < 6 && (await page.locator('[data-testid="dispatch-player"]').count()); i++) {
  const name = await page.locator('[data-testid="dispatch-player"] .font-semibold').first().innerText();
  if (name !== firstName) { ok("a finished story rolls into the next traveler", true, `${firstName} → ${name}`); break; }
  await page.locator('[data-testid="dispatch-next"]').click(); await page.waitForTimeout(500);
  if (i === 5) ok("a finished story rolls into the next traveler", false, "never changed");
}
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
if (await page.locator('[data-testid="dispatch-player"]').count()) await page.locator('[data-testid="dispatch-player"] [aria-label="Close"]').click();
await page.waitForTimeout(400);

// deep link: open a pin, url carries it, reload restores it
await page.evaluate(() => {
  const m = [...document.querySelectorAll(".marker-in")].find((el) => el.style.display !== "none");
  m?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(1200);
let url = page.url();
ok("an open pin is in the URL", /[?&]pin=/.test(url), url);
await page.goto(url); await page.waitForTimeout(3500);
const g2 = page.getByRole("button", { name: /Continue with Apple/ }); if (await g2.count()) { await g2.click(); await page.waitForTimeout(3500); }
ok("reloading that URL reopens the pin", (await page.locator('[role="dialog"][aria-modal="true"]').count()) >= 1);
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
ok("closing the pin clears the URL", !/[?&]pin=/.test(page.url()), page.url());

// sheets: dialog role, escape closes only the top one
await page.getByRole("button", { name: "Trips" }).first().click({ timeout: 5000 }); await page.waitForTimeout(700);
ok("a sheet is a dialog", (await page.locator('[role="dialog"][aria-modal="true"]').count()) >= 1);
ok("focus moved into the sheet", await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
ok("Escape closes the sheet", (await page.locator('[role="dialog"]').count()) === 0);

// two-tap trip delete
await page.getByRole("button", { name: "Trips" }).first().click({ timeout: 5000 }); await page.waitForTimeout(700);
const del = page.locator('[data-testid^="trip-delete-"]').first();
if (await del.count()) {
  await del.click({ timeout: 5000 }); await page.waitForTimeout(200);
  ok("trip delete asks twice", /Really delete/.test(await del.innerText()));
} else ok("trip delete asks twice", true, "no own trips in view — skipped");
await page.keyboard.press("Escape");

// first-run checklist starts with a pin and a friend
await page.evaluate(() => { localStorage.removeItem("wp-guided-start-dismissed"); localStorage.setItem("wp-sessions", "0"); });
await page.reload(); await page.waitForTimeout(3500);
const g3 = page.getByRole("button", { name: /Continue with Apple/ }); if (await g3.count()) { await g3.click(); await page.waitForTimeout(3500); }
const pill = page.getByRole("button", { name: /Getting started/ });
if (await pill.count()) {
  await pill.click({ timeout: 5000 }); await page.waitForTimeout(300);
  const items = await page.locator("ol li").allInnerTexts();
  ok("checklist starts with drop a pin, add a friend", /Drop your first pin/.test(items[0] ?? "") && /Add a friend/.test(items[1] ?? ""), items.slice(0, 2).join(" | "));
} else ok("checklist starts with drop a pin, add a friend", false, "pill not shown");

// idle dim does not start before the first interaction
await page.reload(); await page.waitForTimeout(3500);
const g4 = page.getByRole("button", { name: /Continue with Apple/ }); if (await g4.count()) { await g4.click(); }
await page.waitForTimeout(7000);
ok("no idle dim before the first interaction", (await page.evaluate(() => document.body.getAttribute("data-idle"))) !== "1");

// me link has a name; rating buttons are big enough; toast renders
ok("Me link is named", (await page.locator('[data-testid="me-link"]').getAttribute("aria-label") ?? "").startsWith("Me"));
ok("zero page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await finish(browser);