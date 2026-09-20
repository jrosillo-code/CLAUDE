import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExif, clusterFixes, parsePlaceLine, isoFromExifDate } from "../lib/exif";

// Build a minimal JPEG with an EXIF APP1 block: IFD0 → GPS IFD + Exif IFD.
function jpegWithExif(lat: number, lng: number, date = "2024:08:14 17:32:05"): ArrayBuffer {
  const le = true;
  const tiff: number[] = [];
  const u16 = (v: number) => tiff.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) => tiff.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  // header
  tiff.push(0x49, 0x49); u16(0x2a); u32(8);
  // IFD0 at 8: 2 entries (Exif IFD ptr, GPS IFD ptr) → 2 + 24 + 4 = 30 bytes → ends at 38
  u16(2);
  const exifIfdOff = 38, gpsIfdOff = exifIfdOff + 2 + 12 + 4 + 20; // exif ifd: 1 entry + next + date string(20)
  u16(0x8769); u16(4); u32(1); u32(exifIfdOff);
  u16(0x8825); u16(4); u32(1); u32(gpsIfdOff);
  u32(0);
  // Exif IFD at 38: DateTimeOriginal ASCII count 20 at offset exifIfdOff+18
  u16(1);
  u16(0x9003); u16(2); u32(20); u32(exifIfdOff + 18);
  u32(0);
  for (const ch of date.padEnd(19, " ")) tiff.push(ch.charCodeAt(0)); tiff.push(0);
  // GPS IFD: 4 entries; rationals after
  const dms = (v: number) => { const a = Math.abs(v); const d = Math.floor(a); const m = Math.floor((a - d) * 60); const s = Math.round(((a - d) * 60 - m) * 60 * 1000); return [[d, 1], [m, 1], [s, 1000]]; };
  const gpsStart = tiff.length; assert.equal(gpsStart, gpsIfdOff);
  const ratLat = gpsIfdOff + 2 + 4 * 12 + 4, ratLng = ratLat + 24;
  u16(4);
  u16(1); u16(2); u32(2); tiff.push((lat < 0 ? "S" : "N").charCodeAt(0), 0, 0, 0);
  u16(2); u16(5); u32(3); u32(ratLat);
  u16(3); u16(2); u32(2); tiff.push((lng < 0 ? "W" : "E").charCodeAt(0), 0, 0, 0);
  u16(4); u16(5); u32(3); u32(ratLng);
  u32(0);
  for (const [n, d] of dms(lat)) { u32(n); u32(d); }
  for (const [n, d] of dms(lng)) { u32(n); u32(d); }
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...app1, 0xff, 0xd9];
  void le;
  return new Uint8Array(bytes).buffer;
}

test("parses GPS and the capture time from a JPEG's EXIF block", () => {
  const fix = parseExif(jpegWithExif(38.7223, -9.1393));
  assert.ok(fix);
  assert.ok(Math.abs(fix!.lat - 38.7223) < 0.001, String(fix!.lat));
  assert.ok(Math.abs(fix!.lng + 9.1393) < 0.001, String(fix!.lng));
  assert.equal(fix!.takenAt, "2024-08-14T17:32:05");
  const south = parseExif(jpegWithExif(-33.87, 151.21));
  assert.ok(south && south.lat < 0 && south.lng > 0);
});

test("non-JPEG or EXIF-less input is null, never a guess", () => {
  assert.equal(parseExif(new Uint8Array([0, 1, 2]).buffer), null);
  assert.equal(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer), null);
  assert.equal(isoFromExifDate("0000:00:00 00:00:00"), undefined);
});

test("photos cluster into visits by distance and time", () => {
  const fixes = [
    { lat: 38.72, lng: -9.14, takenAt: "2024-08-14T10:00:00" },
    { lat: 38.73, lng: -9.15, takenAt: "2024-08-15T10:00:00" },
    { lat: 41.15, lng: -8.61, takenAt: "2024-08-18T10:00:00" }, // Porto
    { lat: 38.72, lng: -9.14, takenAt: "2025-03-01T10:00:00" }, // Lisbon again, months later
  ];
  const c = clusterFixes(fixes);
  assert.equal(c.length, 3);
  assert.equal(c[0].count, 2);
  assert.equal(c[0].from, "2024-08-14T10:00:00");
  assert.equal(c[0].to, "2024-08-15T10:00:00");
});

test("typed place lines carry an optional date", () => {
  assert.deepEqual(parsePlaceLine("Lisbon, Portugal — Aug 2024"), { name: "Lisbon, Portugal", when: "2024-08-01" });
  assert.deepEqual(parsePlaceLine("Tokyo 2023"), { name: "Tokyo", when: "2023-01-01" });
  assert.deepEqual(parsePlaceLine("- Faro"), { name: "Faro" });
  assert.deepEqual(parsePlaceLine("Kyoto 2022-11-03"), { name: "Kyoto", when: "2022-11-03" });
  assert.equal(parsePlaceLine("   "), null);
});
