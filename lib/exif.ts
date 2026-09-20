// A tiny EXIF reader for the photo import: GPS position and the moment the
// photo was taken, from a JPEG's APP1 segment. No dependency, no upload —
// the file never leaves the device. HEIC and anything without an EXIF block
// return null and the import simply skips them.

export interface PhotoFix {
  lat: number;
  lng: number;
  /** ISO 8601 (local time as written by the camera, no zone). */
  takenAt?: string;
}

const TAG_GPS_IFD = 0x8825;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_ORIGINAL = 0x9003;
const TAG_DATE_DIGITIZED = 0x9004;
const TAG_DATE = 0x0132;
const GPS_LAT_REF = 0x0001, GPS_LAT = 0x0002, GPS_LNG_REF = 0x0003, GPS_LNG = 0x0004;

export function parseExif(buf: ArrayBuffer): PhotoFix | null {
  const bytes = new Uint8Array(buf);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // not a JPEG
  // Walk the marker segments to APP1/Exif.
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) return null;
    const marker = bytes[p + 1];
    if (marker === 0xda || marker === 0xd9) return null; // image data / end: no EXIF
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marker === 0xe1 && bytes[p + 4] === 0x45 && bytes[p + 5] === 0x78 && bytes[p + 6] === 0x69 && bytes[p + 7] === 0x66) {
      return parseTiff(new DataView(buf, p + 10, Math.min(len - 8, bytes.length - (p + 10))));
    }
    p += 2 + len;
  }
  return null;
}

function parseTiff(dv: DataView): PhotoFix | null {
  if (dv.byteLength < 8) return null;
  const le = dv.getUint16(0) === 0x4949;
  if (dv.getUint16(2, le) !== 0x2a) return null;
  const ifd0 = dv.getUint32(4, le);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const inRange = (o: number, n: number) => o >= 0 && o + n <= dv.byteLength;

  const ascii = (off: number, count: number): string => {
    if (!inRange(off, count)) return "";
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = dv.getUint8(off + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const rationals = (off: number, count: number): number[] => {
    const out: number[] = [];
    if (!inRange(off, count * 8)) return out;
    for (let i = 0; i < count; i++) {
      const n = u32(off + i * 8), d = u32(off + i * 8 + 4);
      out.push(d ? n / d : 0);
    }
    return out;
  };

  interface Entry { tag: number; type: number; count: number; valueOff: number }
  const readIfd = (off: number): Entry[] => {
    if (!inRange(off, 2)) return [];
    const n = u16(off);
    const out: Entry[] = [];
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (!inRange(e, 12)) break;
      const type = u16(e + 2), count = u32(e + 4);
      const size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] ?? 1;
      // values of 4 bytes or fewer live inline
      const valueOff = size * count <= 4 ? e + 8 : u32(e + 8);
      out.push({ tag: u16(e), type, count, valueOff });
    }
    return out;
  };

  const ifd = readIfd(ifd0);
  let takenAt: string | undefined;
  let gpsOff: number | null = null;
  let exifOff: number | null = null;
  for (const e of ifd) {
    // sub-IFD pointers are LONGs stored inline: read the value, not its slot
    if (e.tag === TAG_GPS_IFD) gpsOff = inRange(e.valueOff, 4) ? u32(e.valueOff) : null;
    else if (e.tag === TAG_EXIF_IFD) exifOff = inRange(e.valueOff, 4) ? u32(e.valueOff) : null;
    else if (e.tag === TAG_DATE && e.type === 2) takenAt = isoFromExifDate(ascii(e.valueOff, e.count));
  }
  if (exifOff != null) {
    for (const e of readIfd(exifOff)) {
      if ((e.tag === TAG_DATE_ORIGINAL || (e.tag === TAG_DATE_DIGITIZED && !takenAt)) && e.type === 2) {
        const iso = isoFromExifDate(ascii(e.valueOff, e.count));
        if (iso && (e.tag === TAG_DATE_ORIGINAL || !takenAt)) takenAt = iso;
      }
    }
  }
  if (gpsOff == null) return null;
  let latRef = "N", lngRef = "E";
  let lat: number[] = [], lng: number[] = [];
  for (const e of readIfd(gpsOff)) {
    if (e.tag === GPS_LAT_REF) latRef = ascii(e.valueOff, e.count) || "N";
    else if (e.tag === GPS_LNG_REF) lngRef = ascii(e.valueOff, e.count) || "E";
    else if (e.tag === GPS_LAT) lat = rationals(e.valueOff, Math.min(3, e.count));
    else if (e.tag === GPS_LNG) lng = rationals(e.valueOff, Math.min(3, e.count));
  }
  if (lat.length < 1 || lng.length < 1) return null;
  const dms = (v: number[]) => (v[0] ?? 0) + (v[1] ?? 0) / 60 + (v[2] ?? 0) / 3600;
  let la = dms(lat), lo = dms(lng);
  if (latRef.toUpperCase().startsWith("S")) la = -la;
  if (lngRef.toUpperCase().startsWith("W")) lo = -lo;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null;
  return { lat: la, lng: lo, ...(takenAt ? { takenAt } : {}) };
}

/** "2024:08:14 17:32:05" → "2024-08-14T17:32:05" */
export function isoFromExifDate(s: string): string | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return undefined;
  if (m[1] === "0000") return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

/** Read just enough of a file for EXIF (it sits in the first segments). */
export async function photoFix(file: Blob): Promise<PhotoFix | null> {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExif(head);
  } catch {
    return null;
  }
}

export interface PhotoCluster {
  lat: number;
  lng: number;
  count: number;
  /** Earliest and latest capture in the cluster (ISO), when known. */
  from?: string;
  to?: string;
}

/** Group fixes into visits: a new cluster starts when a photo is farther
 *  than `km` from the running centre or more than `days` after the last. */
export function clusterFixes(fixes: PhotoFix[], km = 30, days = 5): PhotoCluster[] {
  const sorted = [...fixes].sort((a, b) => (a.takenAt ?? "").localeCompare(b.takenAt ?? ""));
  const out: PhotoCluster[] = [];
  const R = 6371;
  const dist = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  for (const f of sorted) {
    let home: PhotoCluster | null = null;
    for (const c of out) {
      if (dist(c.lat, c.lng, f.lat, f.lng) > km) continue;
      if (f.takenAt && c.to && (Date.parse(f.takenAt) - Date.parse(c.to)) / 86_400_000 > days) continue;
      home = c;
      break;
    }
    if (!home) {
      out.push({ lat: f.lat, lng: f.lng, count: 1, from: f.takenAt, to: f.takenAt });
      continue;
    }
    // running centre
    home.lat = (home.lat * home.count + f.lat) / (home.count + 1);
    home.lng = (home.lng * home.count + f.lng) / (home.count + 1);
    home.count += 1;
    if (f.takenAt) {
      if (!home.from || f.takenAt < home.from) home.from = f.takenAt;
      if (!home.to || f.takenAt > home.to) home.to = f.takenAt;
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

/** "Lisbon, Portugal — Aug 2024" / "Tokyo 2023" / "Faro" → name + optional ISO date. */
export function parsePlaceLine(line: string): { name: string; when?: string } | null {
  const raw = line.trim().replace(/^[-*•]\s*/, "");
  if (!raw) return null;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  // trailing "— Aug 2024", ", 2024", " 2024-08", " Aug 2024"
  const m = /^(.*?)(?:\s*[—–-]\s*|,\s*|\s+)((?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?)$/i.exec(raw);
  if (!m || !m[1].trim()) return { name: raw };
  const name = m[1].trim().replace(/[,\s]+$/, "");
  const year = m[4];
  const month = m[5] ? m[5] : m[3] ? String(MONTHS.indexOf(m[3].toLowerCase()) + 1).padStart(2, "0") : "01";
  const day = m[6] ?? "01";
  const y = Number(year);
  if (y < 1950 || y > 2100) return { name: raw };
  return { name, when: `${year}-${month}-${day}` };
}
