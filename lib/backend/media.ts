"use client";

// Uploads to Storage: avatars (public bucket) and pin media (private
// bucket, returned as a signed URL plus the path the row keeps). Uploads
// return values, so they are awaited, not queued.

import { sb, log } from "./core";
import { SIGNED_TTL_S } from "./rows";

/** Upload an avatar (dataURL) to Storage; returns the public URL. */
export async function uploadAvatar(userId: string, dataUrl: string): Promise<string | null> {
  const sbc = sb();
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${userId}/avatar.jpg`;
    const { error } = await sbc.storage.from("avatars").upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (error) throw error;
    const { data } = sbc.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: rowErr } = await sbc.from("users").update({ avatar_url: url }).eq("id", userId);
    if (rowErr) throw rowErr;
    return url;
  } catch (e) {
    log("uploadAvatar")(e);
    return null;
  }
}

/** Largest file the pin-media bucket accepts (mirrors migration 0022). */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

export interface UploadedMedia {
  /** A signed URL to show now. */
  url: string;
  /** The object path to store on the pin. */
  path: string;
}

/** Upload a pin photo/video to the private bucket; returns a signed URL to
 *  display plus the path the database keeps. Null on failure (the user is
 *  told by log()). */
export async function uploadPinMedia(userId: string, file: File | Blob, ext: string): Promise<UploadedMedia | null> {
  const sbc = sb();
  try {
    if (file.size > MAX_MEDIA_BYTES) throw new Error(`file is ${Math.round(file.size / 1048576)} MB; the limit is 100 MB`);
    const contentType = file.type || (ext === "jpg" ? "image/jpeg" : ext === "mp4" ? "video/mp4" : ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "application/octet-stream");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sbc.storage.from("pin-media").upload(path, file, { upsert: false, contentType });
    if (error) throw error;
    const { data, error: signErr } = await sbc.storage.from("pin-media").createSignedUrl(path, SIGNED_TTL_S);
    if (signErr || !data?.signedUrl) throw signErr ?? new Error("no signed url");
    return { url: data.signedUrl, path };
  } catch (e) {
    log("uploadPinMedia")(e);
    return null;
  }
}

