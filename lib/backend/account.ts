"use client";

// Account-level reads and the irreversible things: usernames, citation
// counts, leaving.

import { sb, log } from "./core";

export async function loadCitationCounts(): Promise<Record<string, number>> {
  const { data, error } = await sb().rpc("reflection_citation_counts");
  if (error) {
    log("citationCounts")(error);
    return {};
  }
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { rid: string; citations: number }[]) {
    out[row.rid] = Number(row.citations);
  }
  return out;
}



/** Signup: is this username still free? Fails open — the DB's unique
 *  constraint is the real gate; this just gives instant feedback. */
export async function checkHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await sb()
    .from("users")
    .select("id")
    .eq("handle", handle)
    .limit(1);
  if (error) {
    log("handle check")(error);
    return true;
  }
  return !data?.length;
}

/** Claim the username picked at signup (the auto-profile trigger derived a
 *  placeholder from the email). Display name starts as the username too. */
export async function claimHandle(userId: string, handle: string): Promise<void> {
  const { error } = await sb()
    .from("users")
    .update({ handle, display_name: handle })
    .eq("id", userId);
  if (error) log("handle claim")(error);
}


export async function deleteMyAccount(viewerId: string): Promise<boolean> {
  const sbc = sb();
  try {
    for (const bucket of ["pin-media", "avatars"]) {
      const { data } = await sbc.storage.from(bucket).list(viewerId, { limit: 1000 });
      const names = (data ?? []).map((o) => `${viewerId}/${o.name}`);
      if (names.length) await sbc.storage.from(bucket).remove(names);
    }
    const { error } = await sbc.rpc("delete_my_account");
    if (error) throw error;
    await sbc.auth.signOut();
    return true;
  } catch (e) {
    log("deleteAccount")(e);
    return false;
  }
}

