import AuthGate from "@/components/AuthGate";
import MapApp from "@/components/MapApp";

// The map is the home screen. No feed-first layout (plan §1).
export default function Home() {
  return (
    <AuthGate>
      <MapApp />
    </AuthGate>
  );
}
