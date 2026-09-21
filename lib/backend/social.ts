"use client";

// People: notifications, follows, friend requests, blocks and reports.

import { sb, must, op, log } from "./core";
import { pair } from "./rows";

/** Fire an in-app notification row for someone else. */
const notifyOp = op<{ userId: string; actorId: string; type: "like" | "friend_request" | "friend_accept"; pinId?: string }>("notify", async ({ userId, actorId, type, pinId }) => {
  must(await sb().from("notifications").insert({ user_id: userId, actor_id: actorId, type, pin_id: pinId ?? null }));
});
export function notify(userId: string, actorId: string, type: "like" | "friend_request" | "friend_accept", pinId?: string): void {
  notifyOp({ userId, actorId, type, pinId });
}

const markRead = op<{ id: string }>("markNotificationRead", async ({ id }) => {
  must(await sb().from("notifications").update({ read: true }).eq("id", id));
});
export function syncMarkNotificationRead(id: string): void {
  markRead({ id });
}

const markAllRead = op<{ userId: string }>("markNotificationsRead", async ({ userId }) => {
  must(await sb().from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false));
});
export function syncMarkNotificationsRead(userId: string): void {
  markAllRead({ userId });
}

const follow = op<{ creatorId: string; followerId: string; following: boolean }>("follow", async ({ creatorId, followerId, following }) => {
  must(following
    ? await sb().from("follows").upsert({ follower_id: followerId, creator_id: creatorId }, { onConflict: "follower_id,creator_id", ignoreDuplicates: true })
    : await sb().from("follows").delete().eq("follower_id", followerId).eq("creator_id", creatorId));
});
export function syncFollow(creatorId: string, followerId: string, following: boolean): void {
  follow({ creatorId, followerId, following });
}

// The notification is sent once, outside the retried unit: a retry after a
// request that did land would otherwise hit the unique constraint and take
// the "crossed" branch below. That branch only notifies when it actually
// changed a row.
const sendFriendRequest = op<{ viewerId: string; userId: string }>("sendFriendRequest", async ({ viewerId, userId }) => {
  const p = pair(viewerId, userId);
  const { error } = await sb().from("friendships").upsert({ ...p, status: "pending", requested_by: viewerId }, { onConflict: "user_a,user_b", ignoreDuplicates: true });
  if (error) throw error;
  // Requests crossed in the air: their pending row landed first. Both sides
  // want in — upgrade THEIR request to accepted. The guards make this a
  // no-op when the row is ours or already accepted, and only a changed row
  // earns the "accepted" notification.
  const { data, error: e2 } = await sb().from("friendships").update({ status: "accepted" }).match(p).eq("status", "pending").neq("requested_by", viewerId).select("user_a");
  if (e2) { log("sendFriendRequest/crossed")(e2); return; }
  if (data && data.length) notify(userId, viewerId, "friend_accept");
});
export function syncSendFriendRequest(viewerId: string, userId: string): void {
  sendFriendRequest({ viewerId, userId });
  notify(userId, viewerId, "friend_request");
}

const respondFriendRequest = op<{ viewerId: string; userId: string; accept: boolean }>("respondFriendRequest", async ({ viewerId, userId, accept }) => {
  const p = pair(viewerId, userId);
  must(accept
    ? await sb().from("friendships").update({ status: "accepted" }).match(p)
    : await sb().from("friendships").delete().match(p));
});
export function syncRespondFriendRequest(viewerId: string, userId: string, accept: boolean): void {
  respondFriendRequest({ viewerId, userId, accept });
  if (accept) notify(userId, viewerId, "friend_accept");
}

// ── Trust ──

const block = op<{ viewerId: string; userId: string }>("block", async ({ viewerId, userId }) => {
  must(await sb().from("blocks").upsert({ blocker_id: viewerId, blocked_id: userId }));
});
export function syncBlock(viewerId: string, userId: string): void {
  block({ viewerId, userId });
}

const unblock = op<{ viewerId: string; userId: string }>("unblock", async ({ viewerId, userId }) => {
  must(await sb().from("blocks").delete().eq("blocker_id", viewerId).eq("blocked_id", userId));
});
export function syncUnblock(viewerId: string, userId: string): void {
  unblock({ viewerId, userId });
}

export type ReportReason = "not_a_real_place" | "harassment" | "private_info" | "explicit" | "spam" | "other";

const report = op<{ viewerId: string; pinId?: string; userId?: string; reason: ReportReason; note: string }>("report", async ({ viewerId, pinId, userId, reason, note }) => {
  must(await sb().from("content_reports").insert({ reporter_id: viewerId, pin_id: pinId ?? null, user_id: userId ?? null, reason, note: note.slice(0, 500) }));
});
export function syncReport(viewerId: string, target: { pinId?: string; userId?: string }, reason: ReportReason, note: string): void {
  report({ viewerId, pinId: target.pinId, userId: target.userId, reason, note });
}
