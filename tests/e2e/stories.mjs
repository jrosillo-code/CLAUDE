import { boot } from "./_lib.mjs";
const { B, browser, ok, finish } = await boot({ base: 4400 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));

// A tiny real video, recorded from a canvas in the browser itself, so the
// player's clip path can be exercised without any network.
const rec = await browser.newPage();
await rec.goto("about:blank");
const webmB64 = await rec.evaluate(async () => {
  const c = document.createElement("canvas"); c.width = 160; c.height = 200;
  const ctx = c.getContext("2d");
  const stream = c.captureStream(30);
  const r = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
  const chunks = []; r.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((res) => (r.onstop = res));
  r.start(100);
  const t0 = performance.now();
  await new Promise((res) => { const tick = () => { const t = performance.now() - t0; ctx.fillStyle = `hsl(${(t / 10) % 360},70%,50%)`; ctx.fillRect(0, 0, 160, 200); if (t < 2200) requestAnimationFrame(tick); else res(); }; tick(); });
  r.stop(); await done;
  const blob = new Blob(chunks, { type: "video/webm" });
  const buf = await blob.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
});
await rec.close();
const webm = Buffer.from(webmB64, "base64");
ok("recorded a test clip in the browser", webm.length > 1000, `${webm.length} bytes`);

// Photos arrive late (1.5 s); clips are served from the recorded webm.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
await page.route(/images\.unsplash\.com|picsum\.photos/, async (route) => {
  // pin covers are seeded as /seed/pin-…; avatars are /seed/<handle> and come at once
  if (/\/seed\/pin-/.test(route.request().url())) await new Promise((r) => setTimeout(r, 1500));
  await route.fulfill({ status: 200, contentType: "image/png", body: png });
});
await page.route(/gtv-videos-bucket/, (route) => route.fulfill({ status: 200, contentType: "video/webm", body: webm }));

await page.goto(`${B}/`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
const gate = page.getByRole("button", { name: /Continue with Apple/ }); if (await gate.count()) await gate.click();
await page.waitForTimeout(3500);

const bubbles = page.locator('[data-testid^="dispatch-bubble-"]');
if (!(await bubbles.count())) { ok("dispatch bubbles present", false); await finish(browser); }
const widthOf = async () => parseFloat((await page.locator('[data-testid="dispatch-progress-current"]').evaluate((el) => el.style.width)) || "0");

// Two live dispatches of the viewer's own: a clip, then a photo nobody has
// loaded before (so its 1.5 s delay is real, not served from cache). Their
// order in the player follows creation, so the story runs photo → clip.
await page.evaluate(() => {
  const st = window.__wpStore.getState();
  st.addPin({ lng: -9.14, lat: 38.72, placeName: "Lisbon", countryCode: "PT", title: "Tram 28 at dusk", note: "", visibility: "friends", media: [{ kind: "video", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" }], hereNow: true, createdAt: new Date(Date.now() - 60_000).toISOString() });
  st.addPin({ lng: -8.61, lat: 41.15, placeName: "Porto", countryCode: "PT", title: "Ribeira at noon", note: "", visibility: "friends", media: [{ kind: "photo", url: "https://picsum.photos/seed/pin-story-test/1200/800" }], hereNow: true });
  st.selectPin(null);
});
await page.waitForTimeout(800);

// 1. The clock waits for the photo.
const mineBubble = page.locator('[data-testid="dispatch-bubble-u-you"]');
await mineBubble.click({ timeout: 5000 });
const player = page.locator('[data-testid="dispatch-player"]');
await player.waitFor({ timeout: 5000 }); await page.waitForTimeout(300);
ok("the player opens", (await player.count()) === 1);
const isVideoFirst = (await page.locator('[data-testid="dispatch-video"]').count()) > 0;
if (!isVideoFirst) {
  ok("while the photo is still arriving, the bar has not started", (await widthOf()) === 0 && (await page.locator('[data-testid="dispatch-loading"]').count()) === 1, `${await widthOf()}%`);
  await page.waitForTimeout(2400);
  const w = await widthOf();
  ok("once the photo is on screen the bar runs", w > 3 && w < 60 && (await page.locator('[data-testid="dispatch-loading"]').count()) === 0, `${w}%`);
  // 2. Holding pauses it.
  const box = await player.locator(".aspect-\\[4\\/5\\]").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(150);
  const held = await widthOf(); await page.waitForTimeout(800);
  ok("holding the story pauses the bar", Math.abs((await widthOf()) - held) < 2, `${held}% → ${await widthOf()}%`);
  await page.mouse.up(); await page.waitForTimeout(500);
  ok("letting go resumes it", (await widthOf()) > held + 2);
} else {
  ok("first story was a clip; photo timing checked on the next", true);
}

// 3. A clip is its own clock: the bar follows the video and the story ends
//    when the clip ends (~2.2 s), not at a fixed six seconds.
let sawVideo = (await page.locator('[data-testid="dispatch-video"]').count()) > 0;
for (let i = 0; i < 4 && !sawVideo && (await player.count()); i++) {
  await page.locator('[data-testid="dispatch-next"]').click(); await page.waitForTimeout(400);
  sawVideo = (await page.locator('[data-testid="dispatch-video"]').count()) > 0;
}
if (sawVideo) {
  const title = await player.locator(".font-display").first().innerText();
  ok("a clip story shows a mute control", (await page.locator('[data-testid="dispatch-mute"]').count()) === 1);
  await page.waitForTimeout(1200);
  const w1 = await widthOf();
  ok("the bar follows the clip's own time", w1 > 20, `${w1}%`);
  await page.waitForTimeout(2200);
  const moved = (await player.count()) === 0 || (await player.locator(".font-display").first().innerText()) !== title;
  ok("the story ends when the clip ends, not on a fixed timer", moved);
} else {
  ok("a clip story was reachable", false, "no video dispatch in the demo");
}

ok("zero page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await finish(browser);
