import { boot } from "./_lib.mjs";
const { B, browser, server, ok, out, finish } = await boot({ base: 3600 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const logs = []; page.on("console", (m) => { if (/flight-film/.test(m.text())) logs.push(m.text()); });
await page.goto(`${B}/`); await page.waitForTimeout(1200);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(3500);

// ── Share cards from the recap ──
await page.goto(`${B}/u/you`); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /recap/i }).first().click(); await page.waitForTimeout(800);
const dl = page.locator('[data-testid="download-cards"]');
ok("recap offers the share cards", (await dl.count()) === 1);
const downloads = [];
page.on("download", (d) => downloads.push(d.suggestedFilename()));
await dl.click();
for (let i = 0; i < 120 && downloads.length < 2; i++) await page.waitForTimeout(500);
ok("boarding pass PNG downloaded", downloads.some((f) => /boarding-pass\.png$/.test(f)), downloads.join(","));
ok("constellation card downloaded as mp4 (or a PNG still where video encoding is missing)", downloads.some((f) => /constellation\.(mp4|png)$/.test(f)), downloads.join(","));
const btnText = await dl.innerText();
ok("button reports the save", /Saved/.test(btnText), btnText);
await page.keyboard.press("Escape"); await page.waitForTimeout(300);

// ── Import: typed places (geocoder stubbed) ──
await page.route("**/nominatim.openstreetmap.org/**", (route) => {
  const u = route.request().url();
  if (/search/.test(u)) {
    const q = decodeURIComponent(u.split("q=")[1] ?? "").split("&")[0];
    const hit = /kyoto/i.test(q) ? { lat: "35.0116", lon: "135.7681", name: "Kyoto", display_name: "Kyoto, Japan", category: "place", addresstype: "city", osm_id: 1, address: { country_code: "jp", country: "Japan" } } : { lat: "37.0194", lon: "-7.9304", name: "Faro", display_name: "Faro, Portugal", category: "place", addresstype: "city", osm_id: 2, address: { country_code: "pt", country: "Portugal" } };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([hit]) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lat: "0", lon: "0", display_name: "", address: {} }) });
});
await page.route("**/photon.komoot.io/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [] }) }));
await page.getByRole("button", { name: /Import travels/i }).first().click(); await page.waitForTimeout(600);
ok("import opens on Photos first", /Choose photos/.test(await page.evaluate(() => document.body.innerText)));
await page.getByRole("button", { name: /Type places/ }).click(); await page.waitForTimeout(200);
await page.locator('[data-testid="import-typed"]').fill("Kyoto 2023\nFaro — Aug 2024");
await page.locator('[data-testid="import-typed-go"]').click();
for (let i = 0; i < 40 && (await page.locator('[data-testid="import-review"]').count()) === 0; i++) await page.waitForTimeout(250);
ok("typed places resolve to a review list", (await page.locator('[data-testid="import-review"] li').count()) === 2);
const beforePins = await page.evaluate(() => document.body.innerText.match(/(\d+)\s*PINS/i)?.[1]);
await page.locator('[data-testid="import-go"]').click(); await page.waitForTimeout(600);
ok("imported pins are added", /2 pins added/.test(await page.evaluate(() => document.body.innerText)), `pins before ${beforePins}`);
await page.keyboard.press("Escape"); await page.waitForTimeout(400);

// ── Import: photos with EXIF (a synthetic JPEG) ──
await page.getByRole("button", { name: /Import travels/i }).first().click(); await page.waitForTimeout(600);
const jpeg = await page.evaluate(() => {
  const tiff = []; const u16 = (v) => tiff.push(v & 255, (v >> 8) & 255); const u32 = (v) => tiff.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
  tiff.push(0x49, 0x49); u16(0x2a); u32(8); u16(1); const gpsOff = 8 + 2 + 12 + 4; u16(0x8825); u16(4); u32(1); u32(gpsOff); u32(0);
  const ratLat = gpsOff + 2 + 48 + 4, ratLng = ratLat + 24; u16(4);
  u16(1); u16(2); u32(2); tiff.push(78, 0, 0, 0); u16(2); u16(5); u32(3); u32(ratLat); u16(3); u16(2); u32(2); tiff.push(87, 0, 0, 0); u16(4); u16(5); u32(3); u32(ratLng); u32(0);
  for (const [n, d] of [[38, 1], [43, 1], [20, 1], [9, 1], [8, 1], [21, 1]]) { u32(n); u32(d); }
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]; const len = app1.length + 2;
  return [0xff, 0xd8, 0xff, 0xe1, (len >> 8) & 255, len & 255, ...app1, 0xff, 0xd9];
});
await page.locator('[data-testid="import-photos"]').setInputFiles({ name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
for (let i = 0; i < 40 && (await page.locator('[data-testid="import-review"]').count()) === 0; i++) await page.waitForTimeout(250);
ok("a photo's EXIF location becomes a visit to review", (await page.locator('[data-testid="import-review"] li').count()) === 1, (await page.evaluate(() => document.body.innerText)).match(/located photo.*/)?.[0]);
await page.keyboard.press("Escape"); await page.waitForTimeout(300);

// ── Top spots: browse every list ──
await page.goto(`${B}/`); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Top spots/ }).click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /World lists/ }).click(); await page.waitForTimeout(400);
const n = await page.locator('[data-testid="topspots-list-places"] li').count();
ok("World lists mode lists a whole list, not only nearby", n >= 150, String(n));
ok("opening a list puts all its places on the map", (await page.locator('[data-testid="list-on-map"]').getAttribute("aria-pressed")) === "true");
await page.locator('[data-testid="topspots-lists-browser"] button[aria-pressed="false"]').first().click(); await page.waitForTimeout(300);
ok("picking another list lights that one up too", (await page.locator('[data-testid="list-on-map"]').getAttribute("aria-pressed")) === "true");
await page.locator('[data-testid="topspots-lists-browser"] input').fill("Portugal");
await page.waitForTimeout(200);
const pt = await page.locator('[data-testid="topspots-list-places"] li').count();
ok("the filter narrows by country", pt > 0 && pt < n, String(pt));
await page.locator('[data-testid="topspots-list-places"] li button').first().click(); await page.waitForTimeout(1200);
ok("tapping a place opens its card", (await page.locator('[data-testid="list-place-card"]').count()) === 1);

// ── Flight film: the offline render runs end to end and downloads ──
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await page.goto(`${B}/u/you`); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /recap/i }).first().click(); await page.waitForTimeout(600);
downloads.length = 0;
const film = page.getByRole("button", { name: /flight film/i });
ok("recap offers the flight film", (await film.count()) === 1);
await film.click();
for (let i = 0; i < 720 && !downloads.some((f) => /in-travel\.(mp4|webm)$/.test(f)); i++) await page.waitForTimeout(500);
ok("flight film rendered and downloaded", downloads.some((f) => /in-travel\.(mp4|webm)$/.test(f)), `${downloads.join(",")} | ${logs.join(" ")}`);
ok("zero page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await finish(browser);
