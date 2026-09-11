import type { Firm } from "./types";
import type { Store } from "./store";
import { monthKey } from "./ids";

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

/** Throws before a model call when the month's ceiling is already reached. */
export async function assertWithinBudget(store: Store, firm: Firm): Promise<BudgetStatus> {
  const s = await budgetStatus(store, firm);
  if (s.exceeded) throw new BudgetExceeded(firm.id, s.used, s.budget);
  return s;
}
