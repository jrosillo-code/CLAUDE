import { randomUUID, createHash } from "node:crypto";

export const newId = (): string => randomUUID();
export const nowIso = (): string => new Date().toISOString();
export const sha256 = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");
export const monthKey = (d: Date = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
