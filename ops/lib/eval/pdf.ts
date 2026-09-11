// A minimal PDF writer: one or more pages of Helvetica text lines. Enough to
// produce realistic-looking fixtures (invoices, claim reports, settlement
// statements) without a dependency. Text is WinAnsi-encoded so Spanish
// accents render.

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export interface PdfPage { lines: string[]; title?: string }

export function makePdf(pages: PdfPage[]): Uint8Array {
  const objects: Buffer[] = [];
  const add = (body: Buffer | string) => { objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1")); return objects.length; };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  const pagesIdPlaceholder = objects.length + pages.length * 2 + 1;
  for (const page of pages) {
    const ops: string[] = ["BT"];
    let y = 800;
    if (page.title) { ops.push(`/F2 14 Tf 50 ${y} Td (${esc(page.title)}) Tj`); y -= 24; ops.push(`0 -24 Td`); }
    else ops.push(`/F1 11 Tf 50 ${y} Td`);
    ops.push("/F1 11 Tf");
    for (const line of page.lines) { ops.push(`(${esc(line)}) Tj 0 -15 Td`); }
    ops.push("ET");
    const stream = Buffer.from(ops.join("\n"), "latin1");
    const contentId = add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1")]));
    const pageId = add(`<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`);
    pageIds.push(pageId);
  }
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  if (pagesId !== pagesIdPlaceholder) throw new Error("PDF object numbering drifted");
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let pos = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(pos);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(chunk);
    pos += chunk.length;
  });
  const xrefPos = pos;
  const xref = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `)].join("\n") + "\n";
  parts.push(Buffer.from(xref, "latin1"));
  parts.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`, "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}
