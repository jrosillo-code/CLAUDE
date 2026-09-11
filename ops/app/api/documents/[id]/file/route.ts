import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess } from "@/lib/runtime";

/** Streams the original document to a member of its firm. The bucket stays private. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  const doc = await rt.store.documents.get(id);
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!(await assertFirmAccess(auth, doc.firmId))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
  const file = await rt.store.files.get(doc.storagePath);
  if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mediaType,
      "content-disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
