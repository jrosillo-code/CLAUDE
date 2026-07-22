"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useFriends, useViewer } from "@/lib/hooks";

// Me / individual friends / Everyone toggles (plan §6). Collapses to a pill on
// mobile; expands to a left rail of avatars.
export default function LayerRail() {
  const [open, setOpen] = useState(false);
  const viewer = useViewer();
  const friends = useFriends();
  const activeUserIds = useStore((s) => s.activeUserIds);
  const showOnlyMe = useStore((s) => s.showOnlyMe);
  const showEveryone = useStore((s) => s.showEveryone);
  const toggleUser = useStore((s) => s.toggleUser);

  const isEveryone = activeUserIds === null;
  const isOn = (id: string) => isEveryone || activeUserIds!.has(id);
  const onlyMe = !isEveryone && activeUserIds!.size === 1 && activeUserIds!.has(viewer.id);

  return (
    <div className="fixed left-3 top-1/2 z-30 -translate-y-1/2">
      <div className="w-[220px] rounded-3xl bg-paper/90 p-2 shadow-float backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left"
        >
          <span className="font-display text-base">Layers</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className={`${open ? "block" : "hidden"} px-1 pb-1`}>
          <div className="mb-2 flex gap-1.5">
            <Segment active={isEveryone} onClick={showEveryone}>Everyone</Segment>
            <Segment active={onlyMe} onClick={showOnlyMe}>Just me</Segment>
          </div>

          <ul className="space-y-0.5">
            <Row
              user={viewer}
              label="You"
              on={isOn(viewer.id)}
              onToggle={() => toggleUser(viewer.id)}
            />
            {friends.map((f) => (
              <Row
                key={f.id}
                user={f}
                label={f.displayName}
                on={isOn(f.id)}
                onToggle={() => toggleUser(f.id)}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  user,
  label,
  on,
  onToggle,
}: {
  user: { avatarUrl: string; color: string };
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper-2"
      >
        <img
          src={user.avatarUrl}
          alt=""
          className="h-7 w-7 rounded-full object-cover ring-2"
          style={{ ["--tw-ring-color" as string]: user.color, opacity: on ? 1 : 0.35 }}
        />
        <span className={`truncate text-sm ${on ? "text-ink" : "text-ink-3"}`}>{label}</span>
        <span
          className="ml-auto h-4 w-4 rounded-full border-2"
          style={{
            borderColor: user.color,
            background: on ? user.color : "transparent",
          }}
        />
      </button>
    </li>
  );
}
