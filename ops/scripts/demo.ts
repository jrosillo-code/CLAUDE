// Keyless walkthrough of the whole chain, printed to the terminal.
// npm run demo
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter, DemoSettlementExtractor } from "../lib/demo";
import { receiveDocument, processDocument } from "../lib/pipeline";
import { decide } from "../lib/approvals";
import { RecordingSender } from "../lib/sender";
import { CsvExportAdapter } from "../lib/adapters";
import { processSettlement } from "../lib/settlements";
import { DEMO_FIRM } from "../lib/runtime";
import { newId, nowIso } from "../lib/ids";

async function main() {
  const store = new MemoryStore();
  await store.firms.upsert(DEMO_FIRM);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const sender = new RecordingSender();
  const adapter = new CsvExportAdapter();

  console.log("1. Un cliente manda un parte de siniestro por WhatsApp");
  const inbound = { id: newId(), firmId: DEMO_FIRM.id, channel: "whatsapp" as const, fromAddress: "+34600000000", receivedAt: nowIso(), subject: null, text: null, externalId: "wamid.demo", attachments: [] };
  await store.inbound.insert(inbound);
  const doc = await receiveDocument(deps, { firm: DEMO_FIRM, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([0]), inbound });
  const r = await processDocument(deps, DEMO_FIRM, doc.id);
  console.log(`   tipo: ${r.extraction.kind} · válido: ${r.validation.ok} · faltan: ${r.validation.missing.join(", ")}`);
  console.log(`   tareas: ${r.tasks.map((t) => t.title).join(" | ")}`);
  console.log(`   borrador (${r.draft?.channel}):\n     ${r.draft?.body.split("\n").join("\n     ")}`);
  console.log(`   aprobaciones pendientes: ${r.approvals.map((a) => a.action).join(", ")}`);
  console.log(`   enviados hasta ahora: ${sender.sent.length}`);

  console.log("\n2. Una persona aprueba el envío y la escritura en el sistema");
  for (const a of r.approvals) await decide(store, { sender, adapter }, { approvalId: a.id, decision: "approved", userId: "demo-user" });
  console.log(`   enviados: ${sender.sent.length} · filas exportadas al sistema: ${adapter.rows.length - 1}`);

  console.log("\n3. Llega la liquidación de agosto de la aseguradora");
  await store.receipts.replaceForPeriod(DEMO_FIRM.id, "Aseguradora Ejemplo SA", "2026-08", [
    { id: newId(), firmId: DEMO_FIRM.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "HG-55-220931", receiptNumber: "R-1", premium: 412.5, expectedCommission: 82.5, period: "2026-08", holder: "Luis Ortega" },
    { id: newId(), firmId: DEMO_FIRM.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "AU-2024-778812", receiptNumber: "R-2", premium: 640, expectedCommission: 76.8, period: "2026-08", holder: "Marta Ruiz" },
    { id: newId(), firmId: DEMO_FIRM.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "SA-1", receiptNumber: null, premium: 100, expectedCommission: 12, period: "2026-08", holder: "Ana Pérez" },
  ]);
  const liq = await receiveDocument(deps, { firm: DEMO_FIRM, fileName: "liquidacion-agosto.pdf", mediaType: "application/pdf", bytes: new Uint8Array([0]) });
  const { record, tasks } = await processSettlement({ store, settlementExtractor: new DemoSettlementExtractor() }, { firm: DEMO_FIRM, documentId: liq.id });
  console.log(`   no pagado: ${record.unpaidEur.toFixed(2)} € · diferencias: ${record.mismatchEur.toFixed(2)} €`);
  for (const t of tasks) console.log(`   tarea: ${t.title}`);

  console.log("\n4. Registro de actividad");
  for (const e of (await store.activity.list(DEMO_FIRM.id)).reverse()) console.log(`   ${e.at.slice(11, 19)} ${e.action.padEnd(24)} ${e.actor.type}${e.actor.id ? `:${e.actor.id}` : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
