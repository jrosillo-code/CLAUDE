"use client";

// The viewer's own profile: Top 5, links, name and bio, creator application.

import { sb, must, op } from "./core";
import type { ActivitySlug, UserSocials } from "../types";

/** Replace the viewer's Top 5 rows wholesale (small set, simplest correct). */
const topPlaces = op<{ userId: string; entries: { rank: number; pinId: string; blurb: string }[] }>("topPlaces insert", async ({ userId, entries }) => {
  must(await sb().from("top_places").delete().eq("user_id", userId));
  if (!entries.length) return;
  must(await sb().from("top_places").insert(entries.map((e) => ({ user_id: userId, rank: e.rank, pin_id: e.pinId, blurb: e.blurb }))));
});
export function syncTopPlaces(userId: string, entries: { rank: number; pinId: string; blurb: string }[]): void {
  topPlaces({ userId, entries });
}

const socials = op<{ userId: string; socials: UserSocials }>("socials", async ({ userId, socials }) => {
  must(await sb().from("users").update({ socials }).eq("id", userId));
});
export function syncSocials(userId: string, s: UserSocials): void {
  socials({ userId, socials: s });
}

const profileOp = op<{ userId: string; displayName: string; bio: string; homeCity: string }>("profile", async ({ userId, displayName, bio, homeCity }) => {
  must(await sb().from("users").update({ display_name: displayName, bio, home_city: homeCity }).eq("id", userId));
});
export function syncProfile(userId: string, p: { displayName: string; bio: string; homeCity: string }): void {
  profileOp({ userId, ...p });
}

const applyCreator = op<{ userId: string; activities: ActivitySlug[]; link: string }>("applyCreator", async ({ userId, activities, link }) => {
  must(await sb().from("creator_applications").upsert({ user_id: userId, activities, link }));
});
export function syncApplyCreator(userId: string, activities: ActivitySlug[], link: string): void {
  applyCreator({ userId, activities, link });
}
