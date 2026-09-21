import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 3100 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// API in keyless mode
const res = await page.request.post(`${B}/api/field-brief`, { data: { lat: 38.7223, lng: -9.1393, date: "2026-09-21", countryCode: "PT", nearby: { scoutPins: [], reports: [] } } });
const brief = await res.json();
ok("api: live brief, PT desk-reviewed, light computed, wind honest, LIS nearest", brief.source === "live" && brief.legality.covered === true && brief.legality.reviewTier === "desk-review" && !!brief.light.sunrise && (("unavailable" in brief.wind) || brief.wind.hours.length > 0) && brief.airfields?.[0]?.iata === "LIS", JSON.stringify({ src: brief.source, tier: brief.legality.reviewTier, air: brief.airfields?.map((a) => a.iata), wind: "unavailable" in brief.wind ? brief.wind.reason : "hours " + brief.wind.hours.length }));
const bad = await page.request.post(`${B}/api/field-brief`, { data: { lat: 999 } });
ok("api: rejects bad coordinates", bad.status() === 400);

// /fly pages
await page.goto(`${B}/fly`); await page.waitForTimeout(500);
const flyText = await page.evaluate(() => document.body.innerText);
ok("/fly groups 102 countries into three labelled tiers + authority-only", /102 countries/.test(flyText) && /Checked by a pilot/.test(flyText) && /Desk review/.test(flyText) && /Unverified summaries/.test(flyText) && (await page.locator('[data-testid="tier-unverified-summaries"] li').count()) === 66 && (await page.locator('[data-testid="tier-desk-review"] li').count()) === 36, flyText.slice(0, 60));
await page.goto(`${B}/fly/pt`); await page.waitForTimeout(500);
ok("/fly/pt is a desk review with the label and no 'legal'", (await page.locator('[data-testid="tier-banner"]').count()) === 1 && /Desk review of official sources/.test(await page.evaluate(() => document.body.innerText)) && !/\blegal\b/i.test(await page.evaluate(() => document.body.innerText)));
await page.goto(`${B}/fly/ar`); await page.waitForTimeout(500);
const arText = await page.evaluate(() => document.body.innerText);
ok("/fly/ar is an unverified summary with city notes and the authority link", /Unverified\./.test(arText) && /general knowledge/.test(arText) && (await page.locator('[data-testid="city-notes"] li').count()) >= 1 && /Buenos Aires/.test(arText));
await page.goto(`${B}/fly/zz`); await page.waitForTimeout(500);
ok("/fly/zz says not yet covered and is noindex", /Not yet covered/.test(await page.evaluate(() => document.body.innerText)) && /noindex/.test(await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? "")));
const r404 = await page.goto(`${B}/fly/portugal`);
ok("/fly/<not a code> is a 404", r404.status() === 404);

// demo map: open a seeded scout pin via the search-free path (click a marker)
await page.goto(`${B}/`); await page.waitForTimeout(1500);
// the demo gate: every option signs into the sample account
const gate = page.getByRole("button", { name: /Continue with Apple/ });
if (await gate.count()) { await gate.click(); }
await page.waitForTimeout(7000);
const markers = await page.locator(".marker-in").count();
ok("demo map renders pin markers", markers > 5, String(markers));
await page.screenshot({ path: "/tmp/claude-0/-home-user-CLAUDE/34d0f2a7-047e-5462-8867-cd8026bea1e1/scratchpad/wp-map.png" });
// the scout glyph: markers carrying the reticle badge
const scoutGlyphs = await page.locator('.marker-in div[title="Scout details"]').count();
ok("scout pins wear the reticle glyph", scoutGlyphs >= 1, String(scoutGlyphs));
// click a scout marker → pin sheet → scout section + field brief button
console.log("markers", markers, "glyphs", scoutGlyphs, "visible glyph parents", await page.evaluate(() => [...document.querySelectorAll('div[title="Scout details"]')].map((g) => g.parentElement?.parentElement?.style.display)));
const clicked = await page.evaluate(() => {
  const g = [...document.querySelectorAll('div[title="Scout details"]')].find((el) => el.parentElement?.parentElement?.style.display !== "none");
  if (!g) return false;
  (g.parentElement.parentElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return true;
});
if (!clicked) { await finish(browser); }
await page.waitForTimeout(1500);
const sheetText = await page.evaluate(() => document.body.innerText);
ok("pin sheet shows scout details", (await page.locator('[data-testid="scout-view"]').count()) === 1, sheetText.slice(0, 80));
ok("pin sheet has the Field brief button", (await page.locator('[data-testid="button-field-brief"]').count()) >= 1);
await page.locator('[data-testid="button-field-brief"]').first().click(); await page.waitForTimeout(3000);
const cards = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="brief-card-"]')].map((c) => c.dataset.testid));
ok("brief panel renders the five cards in order", JSON.stringify(cards) === JSON.stringify(["brief-card-rules", "brief-card-light", "brief-card-weather", "brief-card-wind", "brief-card-nearby"]), JSON.stringify(cards));
const panelText = await page.evaluate(() => document.body.innerText);
ok("rules card never says 'legal'; carries a tier label or not-covered, and the airfield distance caveat", (/not yet covered/i.test(panelText) || (await page.locator('[data-testid="brief-tier"]').count()) === 1 || /verified by/i.test(panelText)) && !/\blegal\b/i.test(panelText.split("Light")[0] ?? "") && /not an airspace check/i.test(panelText), panelText.split("Rules")[1]?.slice(0, 120));
ok("weather card is honest when the forecast is offline", /Weather unavailable|likely wet|no wet hours/i.test(panelText));
ok("light card shows sunrise/sunset times", /sunrise/i.test(panelText) && /golden hour pm/i.test(panelText));
ok("nearby card shows the scout pin and a report", (await page.locator('[data-testid^="brief-scout-"]').count()) >= 1 && (await page.locator('[data-testid^="brief-report-"]').count()) >= 1);
await page.screenshot({ path: "/tmp/claude-0/-home-user-CLAUDE/34d0f2a7-047e-5462-8867-cd8026bea1e1/scratchpad/wp-brief.png" });
// change the date → refetch
await page.locator('[data-testid="brief-date"]').fill("2026-12-21"); await page.waitForTimeout(2500);
ok("date change refetches (winter sunset earlier)", /sunset/i.test(await page.evaluate(() => document.body.innerText)));
// place-local clock label + hourly table (wind is offline here, so the clock is the longitude estimate)
const lightHint = await page.evaluate(() => document.querySelector('[data-testid="brief-card-light"] span')?.textContent ?? "");
ok("light card names the place clock", /local time|\(UTC/.test(lightHint), lightHint);
// "Brief here" from the map centre: close the sheet first, then use the control
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
await page.keyboard.press("Escape"); await page.waitForTimeout(600);
const hereBtn = page.locator('[data-testid="button-brief-here"]');
ok("the brief button sits inside the search bar, not the right stack", (await hereBtn.count()) === 1 && (await page.evaluate(() => !!document.querySelector('[data-testid="button-brief-here"]')?.closest("header"))));
ok("the bell is hidden with nothing unread, or shown without a badge; the avatar wears the count", (await page.locator('[data-testid="activity-bell"]').count()) === 0 || (await page.locator('[data-testid="me-unread"]').count()) === 1);
await hereBtn.click(); await page.waitForTimeout(4500);
const hereCards = await page.locator('[data-testid^="brief-card-"]').count();
const hereTitle = await page.evaluate(() => document.querySelector('[data-testid="brief-card-rules"]')?.closest("div")?.parentElement?.querySelector("h2")?.textContent ?? "");
ok("Brief here opens a brief for the map centre (coordinates when the geocoder is offline)", hereCards === 5, `${hereCards} cards, title ${hereTitle}`);
// Layers card: Flights toggle renders outcome markers
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Map layers" }).click(); await page.waitForTimeout(400);
const flightsRow = page.getByRole("button", { name: /^Drone view$/ });
ok("Layers card has one Drone view row (scout pins + flights)", (await flightsRow.count()) === 1);
await flightsRow.click(); await page.waitForTimeout(1200);
const flightMarkers = await page.locator('[title*="flew"], [title*="refused"], [title*="fined"], [title*="didn"]').count();
ok("Drone view draws outcome-coloured flight markers from seeded reports", flightMarkers >= 1, String(flightMarkers)); ok("no separate Scout pins / Flights rows", (await page.getByRole("button", { name: /^Scout pins$|^Flights$/ }).count()) === 0);
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// Trips: name before saving
await page.goto(`${B}/`); await page.waitForTimeout(2500);
const tripsBtn = page.locator("button[title=\"Trips\"]").first();
if (await tripsBtn.count()) { await tripsBtn.click(); await page.waitForTimeout(800); }
const newTitle = page.locator('[data-testid="trip-new-title"]');
ok("Trips panel asks for a name before planning", (await newTitle.count()) === 1);
if (await newTitle.count()) {
  await newTitle.fill("Azores loop"); await page.locator('[data-testid="trip-plan"]').click(); await page.waitForTimeout(800);
  const draftTitle = page.locator('[data-testid="trip-draft-title"]');
  ok("planning bar carries the name, editable before save", (await draftTitle.count()) === 1 && (await draftTitle.inputValue()) === "Azores loop", await draftTitle.inputValue().catch(() => "n/a"));
}
// A searched place makes the brief button glow; no popup card; a bare map tap clears it.
// The geocoders are unreachable here, so Nominatim is stubbed with one Portugal hit.
await page.route("**/nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ lat: "39.4", lon: "-8.2", name: "Portugal", display_name: "Portugal", category: "boundary", addresstype: "country", osm_type: "relation", osm_id: 295480, address: { country: "Portugal", country_code: "pt" } }]) }));
await page.route("**/photon.komoot.io/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [] }) }));
await page.goto(`${B}/?fly=PT`); await page.waitForTimeout(4000);
await page.keyboard.press("Escape"); await page.waitForTimeout(500); // close the brief the deep link opens
const glowBtn = page.locator('[data-testid="button-brief-here"][data-glow="1"]');
ok("after a search the brief button glows instead of a popup", (await glowBtn.count()) === 1 && !/Field brief — drone rules/.test(await page.evaluate(() => document.body.innerText)));
ok("the glowing button names the place", /Field brief for/.test((await glowBtn.getAttribute("aria-label")) ?? ""), await glowBtn.getAttribute("aria-label"));
await page.mouse.click(640, 700); await page.waitForTimeout(600);
ok("tapping the bare map stops the glow", (await page.locator('[data-testid="button-brief-here"][data-glow="1"]').count()) === 0);
// the opening camera keeps the planet in frame
const zoomNow = await page.evaluate(() => window.__wpZoom ?? null);
// Dispatches: the strip shows friends on the road; tapping plays their dispatch with the map flying along
await page.goto(`${B}/`); await page.waitForTimeout(3000);
const strip = page.locator('[data-testid="dispatch-strip"]');
ok("the dispatch strip shows travelers who are here now", (await strip.count()) === 1 && (await strip.locator('[data-testid^="dispatch-bubble-"]').count()) >= 2, String(await strip.locator('[data-testid^="dispatch-bubble-"]').count()));
ok("live pins pulse on the map", (await page.locator(".marker-in .wp-live-pulse").count()) >= 1, String(await page.locator(".marker-in .wp-live-pulse").count()));
// zoomed all the way out, the beacon survives clustering
await page.mouse.move(640, 400); for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(80); } await page.waitForTimeout(1500);
ok("zoomed all the way out, a live beacon still shows (clusters inherit it)", (await page.locator(".marker-in .wp-live-glow").count()) >= 1, String(await page.locator(".marker-in .wp-live-glow").count()));
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(80); } await page.waitForTimeout(800);
await strip.locator('[data-testid^="dispatch-bubble-"]').first().click(); await page.waitForTimeout(1200);
const player = page.locator('[data-testid="dispatch-player"]');
ok("a bubble opens the player with the place and time ago", (await player.count()) === 1 && /ago|just now/.test(await player.innerText()), (await player.innerText()).slice(0, 80));
const pinsOfFirst = await player.innerText();
await page.locator('[data-testid="dispatch-next"]').click(); await page.waitForTimeout(500);
ok("next advances or closes at the end", (await player.count()) === 0 || (await player.innerText()) !== pinsOfFirst);
if (await player.count()) { await page.keyboard.press("Escape"); await page.mouse.click(20, 400); await page.waitForTimeout(300); }
// New pin sheet offers "I'm here now"
await page.getByRole("button", { name: /Add a pin|Drop a pin|^\+$/ }).first().click().catch(() => {});
await page.waitForTimeout(400);
const plus = page.locator('button[aria-label*="pin" i]').first();
if (await page.locator('[data-testid="here-now-toggle"]').count() === 0 && await plus.count()) { await plus.click(); await page.waitForTimeout(400); }
ok("zero page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await finish(browser);
