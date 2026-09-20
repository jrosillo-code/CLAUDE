import type { Metadata } from "next";
import InviteLanding from "@/components/InviteLanding";

// Invite links are for the person who received one, not for search engines.
export const metadata: Metadata = { title: "Join a friend on Waypoint", robots: { index: false, follow: false } };

export default async function JoinPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <InviteLanding handle={handle} />;
}
