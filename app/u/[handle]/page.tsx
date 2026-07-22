import AuthGate from "@/components/AuthGate";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <AuthGate>
      <ProfileView handle={handle} />
    </AuthGate>
  );
}
