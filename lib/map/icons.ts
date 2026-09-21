// Canvas-drawn badges for the map's GPU symbol layers: landmarks and the
// airport / station / stadium overlays. Drawn at 2x and registered with
// pixelRatio 2.

// The landmark layer is GPU-rendered (one symbol layer, built-in collision
// decluttering) instead of 563 DOM markers. Icons are canvas-drawn badges.
export function landmarkIconImage(glyph: string, color: string): ImageData {
  const s = 56; // drawn at 2x, rendered with pixelRatio 2
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 23, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (glyph.startsWith("\u{1F3DB}")) {
    // 🏛 is a text-presentation emoji: canvas fillText draws it as a thin
    // outline or nothing at all on iOS and Android, so the UNESCO marker
    // showed an empty disc. Draw a small temple instead.
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath(); // pediment
    ctx.moveTo(15, 24); ctx.lineTo(28, 15); ctx.lineTo(41, 24); ctx.closePath();
    ctx.fill();
    ctx.fillRect(15, 25, 26, 3); // architrave
    for (const x of [18, 24, 30, 36]) { // columns
      ctx.beginPath(); ctx.moveTo(x + 1, 30); ctx.lineTo(x + 1, 38); ctx.stroke();
    }
    ctx.fillRect(14, 39, 28, 3); // stylobate
    return ctx.getImageData(0, 0, s, s);
  }
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, s / 2, s / 2 + 2);
  return ctx.getImageData(0, 0, s, s);
}

// White disc + a monochrome plane / train / stadium glyph in the overlay's
// color. Same visual language as the landmark pins.
export function overlayIconImage(kind: "plane" | "train" | "stadium", color: string): ImageData {
  const s = 56;
  const cx = s / 2;
  const cy = s / 2;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (kind === "plane") {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4); // point up-right, like the flight-film jet
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(2.4, -3);
    ctx.lineTo(13, 3);
    ctx.lineTo(13, 6);
    ctx.lineTo(2.4, 4);
    ctx.lineTo(2, 11);
    ctx.lineTo(5.5, 14);
    ctx.lineTo(5.5, 16);
    ctx.lineTo(0, 13.5);
    ctx.lineTo(-5.5, 16);
    ctx.lineTo(-5.5, 14);
    ctx.lineTo(-2, 11);
    ctx.lineTo(-2.4, 4);
    ctx.lineTo(-13, 6);
    ctx.lineTo(-13, 3);
    ctx.lineTo(-2.4, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (kind === "train") {
    // rounded body with a window band and two legs
    const w = 18;
    const h = 22;
    const x = cx - w / 2;
    const y = cy - h / 2 - 1;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(x + 3, y + 4, w - 6, 7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 5, y + h - 5, 1.6, 0, Math.PI * 2);
    ctx.arc(x + w - 5, y + h - 5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h + 3);
    ctx.lineTo(x, y + h + 6);
    ctx.moveTo(x + w - 3, y + h + 3);
    ctx.lineTo(x + w, y + h + 6);
    ctx.stroke();
  } else {
    // stadium: concentric ellipse ring + inner field
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 15, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 7, 4.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, s, s);
}

