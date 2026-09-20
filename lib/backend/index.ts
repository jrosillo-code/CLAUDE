"use client";

// The Supabase data layer, one module per domain. Reads map rows to app
// types; writes go through the outbox (retried when the network is the
// problem, dropped and told when the server refuses). All functions assume
// the client exists — callers gate on `backendEnabled`.

export { withTimeout, LOAD_TIMEOUT_MS, supabase } from "./core";
export { storagePathOf, signPinMedia } from "./rows";
export type { World } from "./world";
export { loadWorld, ensureProfile, subscribeRealtime } from "./world";
export { uploadAvatar, uploadPinMedia, MAX_MEDIA_BYTES } from "./media";
export type { UploadedMedia } from "./media";
export { loadCitationCounts, checkHandleAvailable, claimHandle, deleteMyAccount } from "./account";
export * from "./pins";
export * from "./social";
export * from "./trips";
export * from "./profile";
export * from "./fieldbrief";
export { resumeOutbox, pendingWrites, drain as drainOutbox } from "./outbox";
export { patchFor, fetchPin } from "./live";
export type { LiveChange, LivePatch } from "./live";
