import type { Metadata } from "next";
import AuthGate from "@/components/AuthGate";
import ProfileView from "@/components/ProfileView";
import PublicProfilePreview from "@/components/PublicProfilePreview";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} on Waypoint`,
    description: `Where @${handle} has been — public places on Waypoint, the map of your friends' travels.`,
    alternates: { canonical: `/u/${handle}` },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    // Signed out, a profile link shows a read-only preview instead of a
    // login wall: the person, their public places, and the way in.
    <AuthGate fallback={<PublicProfilePreview handle={handle} />}>
      <ProfileView handle={handle} />
    </AuthGate>
  );
}
