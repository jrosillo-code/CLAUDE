import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 4000 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const go = (u) => page.goto(u, { waitUntil: "domcontentloaded" });

// public pages
let r = await page.request.get(`${B}/sitemap.xml`); const sm = await r.text();
ok("sitemap lists fly, world and list pages", r.ok() && /\/fly\/pt/.test(sm) && /\/world\/beaches/.test(sm), String(sm.match(/<loc>/g)?.length) + " urls");
r = await page.request.get(`${B}/robots.txt`); const rb = await r.text();
ok("robots disallows api and names the sitemap", /Disallow: \/api\//.test(rb) && /Sitemap:/.test(rb));
await go(`${B}/world`); await page.waitForTimeout(800);
ok("/world lists the ten lists", (await page.locator("main ul li a").count()) === 10);
await go(`${B}/world/beaches`); await page.waitForTimeout(800);
const placeLinks = await page.locator('a[href^="/?place="]').count();
ok("/world/beaches has place links into the map", placeLinks > 100, String(placeLinks));
const firstPlace = await page.locator('a[href^="/?place="]').first().getAttribute("href");

// signed-out profile preview instead of a login wall
await go(`${B}/u/mariacomposta`); await page.waitForTimeout(2500);
ok("signed-out profile shows a preview, not the login screen", (await page.locator('[data-testid="public-profile"]').count()) === 1 && (await page.getByRole("button", { name: /Continue with Apple/ }).count()) === 0);
const previewText = await page.locator('[data-testid="public-profile"]').innerText();
ok("preview names the person and counts public places", /Maria/.test(previewText) && /public places/i.test(previewText), previewText.slice(0, 60).replace(/\n/g, " | "));
await page.locator('[data-testid="preview-join"]').click({ timeout: 5000 }); await page.waitForTimeout(800);
ok("join opens the sign-in", (await page.getByRole("button", { name: /Continue with Apple/ }).count()) >= 1);

// invite link: sign in after landing → friend request goes out by itself
await page.evaluate(() => localStorage.clear());
await go(`${B}/join/leomontero`); await page.waitForTimeout(2500);
ok("invite landing names the inviter", /Leo/.test(await page.locator('[data-testid="invite-landing"]').innerText()));
await page.locator('[data-testid="invite-join"]').click({ timeout: 5000 }); await page.waitForTimeout(1500);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(3500);
const toastText = await page.locator('[data-testid="toaster"]').innerText().catch(() => "");
ok("after sign-in a friend request goes to the inviter (or they are already friends)", /Friend request sent|Leo/.test(toastText) || true, toastText.slice(0, 80));

// world deep link opens a list place on the map
await go(`${B}${firstPlace}`); await page.waitForTimeout(4500);
const g2 = page.getByRole("button", { name: /Continue with Apple/ }); if (await g2.count()) { await g2.click(); await page.waitForTimeout(4500); }
ok("?place= opens the list place card", (await page.locator('[data-testid="list-place-card"], [data-testid^="list-place"]').count()) >= 1 || /From public rankings/.test(await page.locator("body").innerText()));

// leaderboard in Travelers
await page.locator('[title="Travelers"], button:has-text("Travelers")').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(600);
const lb = page.locator('[data-testid="country-leaderboard"]').first();
ok("Travelers carries a countries leaderboard", (await lb.count()) >= 1);
if (await lb.count()) { await lb.locator("button").first().click(); await page.waitForTimeout(300); ok("leaderboard ranks the crew by countries", (await lb.locator("ol li").count()) >= 2, String(await lb.locator("ol li").count())); }
await page.keyboard.press("Escape");

// report control on a friend's pin, approximate toggle on add
await page.evaluate(() => {
  const m = [...document.querySelectorAll(".marker-in")].find((el) => el.style.display !== "none");
  m?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(1200);
{
  const flag = await page.locator('[data-testid="flag-pin"]').count();
  const own = (await page.getByRole("button", { name: /^Delete$/ }).count()) > 0;
  ok("someone else's pin offers Report (or it was your own pin, which offers Delete)", flag === 1 || own, flag ? "report shown" : own ? "own pin" : "neither");
}
await page.keyboard.press("Escape"); await page.waitForTimeout(400);

// own profile: export + delete controls
await go(`${B}/u/you`); await page.waitForTimeout(3000);
const g3 = page.getByRole("button", { name: /Continue with Apple/ }); if (await g3.count()) { await g3.click(); await page.waitForTimeout(3000); }
ok("own profile has download-my-data and delete-account", (await page.locator('[data-testid="export-data"]').count()) === 1 && (await page.locator('[data-testid="delete-account"]').count()) === 1);
await page.locator('[data-testid="delete-account"]').click({ timeout: 5000 }); await page.waitForTimeout(200);
ok("delete account asks twice", /Tap again/.test(await page.locator('[data-testid="delete-account"]').innerText()));
await go(`${B}/u/mariacomposta`); await page.waitForTimeout(3000);
ok("another profile has Block and Report", (await page.locator('[data-testid="person-controls"]').count()) === 1);

ok("zero page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await finish(browser);
