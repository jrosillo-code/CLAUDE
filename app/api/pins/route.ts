import { NextResponse } from "next/server";
import Supercluster from "supercluster";
import { pins, users, friendships, CURRENT_USER_ID } from "@/lib/seed";
import { visiblePins } from "@/lib/data";

// GET /api/pins?bbox=w,s,e,n&zoom=3&viewer=<id>&explore=0
//
// The plan's core query (§5): pins visible to the viewer within the viewport,
// pre-clustered server-side above a threshold. Today it reads the seed store;
// wiring Supabase means swapping the source + letting RLS enforce visibility
// (the WHERE clause here becomes the row-level policy in 0002_rls.sql).
export function GET(req: Request) {
  const url = new URL(req.url);
  const viewer = url.searchParams.get("viewer") ?? CURRENT_USER_ID;
  const explore = url.searchParams.get("explore") === "1";
  const bboxParam = url.searchParams.get("bbox");
  const zoom = Number(url.searchParams.get("zoom") ?? "3");

  const bbox: [number, number, number, number] = bboxParam
    ? (bboxParam.split(",").map(Number) as [number, number, number, number])
    : [-180, -85, 180, 85];

  const visible = visiblePins({
    pins,
    users,
    friendships,
    viewerId: viewer,
    activeUserIds: null,
    explore,
  });

  const features = visible.map((p) => ({
    type: "Feature" as const,
    properties: {
      pinId: p.id,
      ownerId: p.userId,
      placeName: p.placeName,
      color: p.owner.color,
      photo: p.photos[0]?.url ?? p.owner.avatarUrl,
      visibility: p.visibility,
    },
    geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
  }));

  // Cluster server-side above a pin-count threshold, else return raw points.
  const THRESHOLD = 100;
  let payload = features;
  let clustered = false;
  if (features.length > THRESHOLD) {
    const index = new Supercluster({ radius: 54, maxZoom: 16 });
    index.load(features);
    payload = index.getClusters(bbox, Math.round(zoom)) as typeof features;
    clustered = true;
  }

  return NextResponse.json(
    { clustered, count: payload.length, features: payload },
    { headers: { "cache-control": "no-store" } }
  );
}
