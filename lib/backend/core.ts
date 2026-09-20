"use client";

// Shared plumbing for the backend modules: the Supabase client, the
// failure reporter that also tells the person, the load timeout, and the
// op helper that puts every write through the outbox.

import { supabase } from "../supabase";
import { toast } from "../toast";
import { reportError } from "../monitor";
import { defineOp } from "./outbox";

export { supabase };
export const sb = () => supabase!;

const USER_FACING: Record<string, string> = {
  addPin: "Your pin didn't save. Check your connection and try again.",
  "addPin media": "The pin saved, but its photos didn't. Open the pin and add them again.",
  updatePin: "That edit didn't save. Try again in a moment.",
  "updatePin media": "The photo change didn't save. Try again in a moment.",
  deletePin: "The pin couldn't be deleted. Reload and try again.",
  ratePin: "Your score didn't save.",
  like: "That like didn't go through.",
  save: "That save didn't go through.",
  follow: "That follow didn't go through.",
  sendFriendRequest: "The friend request didn't send. Try again.",
  respondFriendRequest: "That reply didn't send. Try again.",
  saveTrip: "The trip didn't save. Check your connection and try again.",
  "saveTrip stops": "The trip saved without its stops. Open it and try again.",
  renameTrip: "The new trip name didn't save.",
  completeTrip: "Marking the trip complete didn't save.",
  deleteTrip: "The trip couldn't be deleted. Reload and try again.",
  saveReflection: "Your debrief didn't save. Your answers are still on this device — try again.",
  "saveReflection answers": "Part of your debrief didn't save. Open it and try again.",
  deleteReflection: "The debrief couldn't be deleted.",
  uploadPinMedia: "That upload failed. Check the file is a photo or video under 100 MB and try again.",
  uploadAvatar: "The new photo didn't upload. Try a smaller image.",
  profile: "Profile changes didn't save.",
  socials: "Your links didn't save.",
  "handle claim": "That username couldn't be claimed. Pick another on your profile.",
  "topPlaces insert": "Your Top 5 didn't save.",
  saveScoutNote: "The scout details didn't save.",
  deleteScoutNote: "The scout details couldn't be removed.",
  saveFieldReport: "The field report didn't save.",
  deleteFieldReport: "The field report couldn't be deleted.",
  applyCreator: "Your application didn't send. Try again.",
  block: "The block didn't save. Try again.",
  unblock: "The unblock didn't save. Try again.",
  report: "The report didn't send. Try again.",
  deleteAccount: "Your account couldn't be deleted. Try again, or email support with your handle.",
};

export const log = (op: string) => (e: unknown) => {
  console.error(`[backend] ${op} failed:`, e);
  reportError(e, { kind: "backend", op });
  const said = USER_FACING[op] ?? (op.startsWith("loadWorld:") ? "Part of your map didn't load. Pull to refresh or reload the page." : null);
  if (said) toast(said, { kind: "error" });
};

/**
 * Never let a backend call hold the UI open indefinitely.
 *
 * This is not belt-and-braces: a Supabase query that fails at the NETWORK
 * level (DNS, a reset connection, a project that is paused or over quota)
 * can leave `Promise.all` over the query builders permanently unsettled —
 * not rejected, just never finished. Awaiting one builder handles the same
 * failure fine; the group does not. So `loadWorld` never returned, the one
 * line that sets sessionReady never ran, and the app sat on its loading logo
 * forever with no error and nothing to click.
 *
 * A promise that has not answered in `ms` is treated as a failure and the
 * caller carries on with `fallback`.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      console.error(`[backend] ${label} timed out after ${ms}ms — continuing without it`);
      resolve(fallback);
    }, ms);
    work.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        log(label)(error);
        resolve(fallback);
      }
    );
  });
}

/** How long any single startup load may take before we give up on it. */
export const LOAD_TIMEOUT_MS = 12_000;

/** Throw the PostgREST error so the outbox can classify it. */
export function must(res: { error: unknown }): void {
  if (res.error) throw res.error;
}

/** A named, retried write. `run` throws on failure; a transient failure is
 *  queued and retried, a refusal is logged and told to the person. */
export function op<P>(name: string, run: (payload: P) => Promise<void>): (payload: P) => void {
  return defineOp<P>(name, run, log(name));
}

