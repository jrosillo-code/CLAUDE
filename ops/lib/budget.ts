import type { Firm } from "./types";
import { firmSettings } from "./types";
import type { Store } from "./store";
import type { Sender } from "./sender";
import { monthKey, newId, nowIso } from "./ids";
import { log } from "./audit";

export class BudgetExceeded extends Error {
  constructor(
    public readonly firmId: string,
    public readonly used: number,
    public readonly budget: number,
  ) {
    super(
      `Presupuesto mensual de tokens agotado para ${firmId}: ${used} de ${budget}. ` +
        `Amplíe el presupuesto o espere al mes siguiente.`,
    );
  }
}

export interface BudgetStatus {
  used: number;
  budget: number;
  ratio: number;
  /** True at or above 80%: the firm should be warned before the ceiling. */
  warn: boolean;
  exceeded: boolean;
}

export async function budgetStatus(store: Store, firm: Firm): Promise<BudgetStatus> {
  const usage = await store.usage.get(firm.id, monthKey());
  const used = usage?.tokens ?? 0;
  const ratio = firm.monthlyTokenBudget > 0 ? used / firm.monthlyTokenBudget : 0;
  return {
    used,
    budget: firm.monthlyTokenBudget,
    ratio,
    warn: ratio >= 0.8,
    exceeded: used >= firm.monthlyTokenBudget,
  };
}

/** Throws before a model call when the month's ceiling is already reached; warns once per month at 80%. */
export async function assertWithinBudget(store: Store, firm: Firm, sender: Sender | null = null): Promise<BudgetStatus> {
  const s = await budgetStatus(store, firm);
  if (s.exceeded) throw new BudgetExceeded(firm.id, s.used, s.budget);
  if (s.warn) await noteBudgetCrossing(store, firm, s, sender);
  return s;
}

/**
 * Compliance kit item 7: the firm hears about the 80% mark before the ceiling,
 * not after. Logged once per month; emailed to the firm's alert mailbox when one
 * is set and a sender exists. This is an operational notice to the firm itself,
 * not a client-facing message, so it does not go through an approval.
 */
export async function noteBudgetCrossing(store: Store, firm: Firm, status: BudgetStatus, sender: Sender | null): Promise<boolean> {
  const month = monthKey();
  const recent = await store.activity.list(firm.id, 2000, `${month}-01`);
  if (recent.some((e) => e.action === "budget.warning")) return false;
  const { alertEmail } = firmSettings(firm);
  let notified = false;
  if (alertEmail && sender) {
    const pct = Math.round(status.ratio * 100);
    const r = await sender.send({
      id: newId(), firmId: firm.id, documentId: "", channel: "email", to: alertEmail,
      subject: `Aviso: ${pct} % del presupuesto mensual de IA usado (${firm.name})`,
      body: `Hola,\n\n${firm.name} ha usado ${status.used.toLocaleString("es-ES")} de ${status.budget.toLocaleString("es-ES")} tokens este mes (${pct} %). Al llegar al 100 % el sistema deja de leer documentos hasta el mes siguiente.\n\nPuedes ampliar el presupuesto desde Ajustes o escribirnos.\n\nOperaciones con IA`,
      usage: null, createdAt: nowIso(),
    });
    notified = r.ok;
  }
  await log(store, { firmId: firm.id, action: "budget.warning", entity: { type: "firm", id: firm.id }, detail: { month, used: status.used, budget: status.budget, ratio: Math.round(status.ratio * 1000) / 1000, notified, to: alertEmail } });
  return true;
}
