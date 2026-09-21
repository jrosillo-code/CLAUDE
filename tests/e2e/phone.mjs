import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 3200 });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, geolocation: { latitude: 38.72, longitude: -9.14 }, permissions: ["geolocation"] });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const reqs = []; page.on("request", (r) => reqs.push(r.url()));
await page.goto(`${B}/`); await page.waitForTimeout(1500);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(6000);
ok("opens on satellite: imagery tiles requested first", reqs.some((u) => /World_Imagery/.test(u)), String(reqs.filter((u) => /arcgis/i.test(u)).length));
ok("satellite probes the vector-label host", reqs.some((u) => /openfreemap\.org\/planet/.test(u)));
// auto theme follows the clock (this sandbox has no location until the map asks)
const html = await page.evaluate(() => document.documentElement.dataset.theme);
// the context grants a Lisbon location, so the sun decides — ask the app's own rule
const { execSync } = await import("node:child_process");
const expectTheme = execSync(`npx tsx -e 'import { autoThemeFor } from "./lib/daynight"; process.stdout.write(autoThemeFor(new Date(), { lat: 38.72, lng: -9.14 }))'`, { cwd: "/home/user/CLAUDE" }).toString().trim();
const expect = expectTheme === "midnight" ? "dark" : "light";
ok(`auto day/night follows the sun at the granted location (${expectTheme})`, html === expect, html);
await page.screenshot({ path: "/tmp/claude-0/-home-user-CLAUDE/34d0f2a7-047e-5462-8867-cd8026bea1e1/scratchpad/wp-mobile-sat.png" });
// Layers card has the auto toggle and a manual pick switches it off
await page.getByRole("button", { name: "Map layers" }).click(); await page.waitForTimeout(400);
const auto = page.getByRole("button", { name: "Auto day / night theme" });
ok("theme row starts with an Auto swatch, on", (await auto.count()) === 1 && (await auto.getAttribute("aria-pressed")) === "true");
await page.getByRole("button", { name: "Sandstone theme" }).click(); await page.waitForTimeout(300);
ok("picking a theme switches auto off and persists", (await page.evaluate(() => localStorage.getItem("wp-auto-theme"))) === "0" && (await page.evaluate(() => localStorage.getItem("wp-theme"))) === "sandstone");
await auto.click(); await page.waitForTimeout(300);
ok("auto can be switched back on", (await page.evaluate(() => localStorage.getItem("wp-auto-theme"))) === "1");
await page.keyboard.press("Escape"); await page.mouse.click(200, 300); await page.waitForTimeout(400);
// Trips on a phone: view a route, then get OUT
// phones: Travelers and Trips fold into one People entry
await page.getByRole("button", { name: "People" }).click(); await page.waitForTimeout(300);
ok("People opens a Travelers / Trips chooser", (await page.locator('[data-testid="people-menu"] button').count()) === 2);
await page.locator('[data-testid="people-menu"] button').nth(1).click(); await page.waitForTimeout(800);
const view = page.getByRole("button", { name: /View route/ }).first();
ok("trips panel lists a route to view", (await view.count()) >= 1);
if (await view.count()) {
  await view.click(); await page.waitForTimeout(1200);
  ok("phone shows the trips bar with an exit button", (await page.locator('[data-testid="trips-mobile-bar"]').count()) === 1 && (await page.locator('[data-testid="trips-exit"]').count()) === 1);
  await page.getByRole("button", { name: /Route guide/ }).click(); await page.waitForTimeout(800);
  const close = page.getByRole("button", { name: "Close" }).first();
  ok("route guide has a visible Close button in portrait", (await close.count()) >= 1 && (await close.boundingBox())?.y < 844, JSON.stringify(await close.boundingBox()));
  await close.click(); await page.waitForTimeout(600);
  ok("closing the guide brings the bar back", (await page.locator('[data-testid="trips-exit"]').count()) === 1);
  await page.locator('[data-testid="trips-exit"]').click(); await page.waitForTimeout(800);
  ok("exit returns to the pins map (layer rail back)", (await page.getByRole("button", { name: "People" }).count()) === 1 && (await page.locator('[data-testid="trips-mobile-bar"]').count()) === 0);
}
// /fly/ar authority CTA
await page.goto(`${B}/fly/ar`); await page.waitForTimeout(600);
const cta = page.locator('[data-testid="authority-cta"]');
ok("unverified page has a click-through to the authority's drone page", (await cta.count()) === 1 && /^https:\/\//.test(await cta.getAttribute("href")), await cta.getAttribute("href"));
ok("zero page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await finish(browser);
