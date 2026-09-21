import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 3500 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${B}/`); await page.waitForTimeout(1200);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Map layers" }).click(); await page.waitForTimeout(300);
const fold = page.locator('[data-testid="lists-fold"]');
ok("Layers card has a World lists fold", (await fold.count()) === 1);
await fold.click(); await page.waitForTimeout(300);
const chips = await page.locator('[data-testid^="list-chip-"]').count();
ok("ten list chips", chips === 10, String(chips));
await page.locator('[data-testid="list-chip-beaches"]').click(); await page.waitForTimeout(200);
ok("a chip toggles on", (await page.locator('[data-testid="list-chip-beaches"]').getAttribute("aria-pressed")) === "true");
ok("the fold badge counts active lists", /1/.test(await fold.innerText()));
await page.locator('[data-testid="list-chip-hikes"]').click(); await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/claude-0/-home-user-CLAUDE/34d0f2a7-047e-5462-8867-cc8026bea1e1-lists.png".replace("cc8026bea1e1-lists", "cd8026bea1e1/scratchpad/wp-lists") });
// Top spots empty state: a searched region with no pins shows list places (search geocoder stubbed to Patagonia)
await page.route("**/nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ lat: "-50.9423", lon: "-73.4068", name: "Torres del Paine", display_name: "Torres del Paine, Chile", category: "boundary", addresstype: "national_park", osm_type: "relation", osm_id: 1, address: { country: "Chile", country_code: "cl" } }]) }));
await page.route("**/photon.komoot.io/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [] }) }));
await page.keyboard.press("Escape"); await page.mouse.click(640, 700); await page.waitForTimeout(300);
await page.getByRole("button", { name: /Top spots/ }).click(); await page.waitForTimeout(600);
const searchTab = page.getByRole("button", { name: /Search region/ }).first();
if (await searchTab.count()) { await searchTab.click(); await page.waitForTimeout(300); }
const box = page.locator('input[placeholder*="province" i]').first();
if (await box.count()) {
  await box.fill("Torres del Paine"); await page.waitForTimeout(900);
  const hit = page.getByRole("button", { name: /Torres del Paine/ }).first();
  if (await hit.count()) { await hit.click(); await page.waitForTimeout(800); }
  const listsBlock = page.locator('[data-testid="topspots-lists"]');
  ok("Top spots with no pins offers world-list places nearby", (await listsBlock.count()) === 1, (await page.evaluate(() => document.body.innerText)).slice(0, 80));
  if (await listsBlock.count()) {
    await listsBlock.locator("button").first().click(); await page.waitForTimeout(1200);
    ok("picking one opens the list place card", (await page.locator('[data-testid="list-place-card"]').count()) === 1);
    const cardText = await page.evaluate(() => document.body.innerText);
    ok("the card says it is from public rankings and never 'legal'", /public rankings/i.test(cardText) && !/\blegal\b/i.test(cardText));
    await page.locator('[data-testid="list-place-save"]').click(); await page.waitForTimeout(200);
    ok("Save persists on this device", ((await page.evaluate(() => localStorage.getItem("wp-saved-lists"))) ?? "").length > 5);
  }
} else {
  ok("Top spots search box found", false);
}
ok("zero page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await finish(browser);
