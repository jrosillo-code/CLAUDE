"use client";

import type { UserSocials } from "@/lib/types";

// Small linked social icons for profiles. Each renders only when connected.
const NETWORKS: {
  key: keyof UserSocials;
  label: string;
  color: string;
  url: (handle: string) => string;
  icon: React.ReactNode;
}[] = [
  {
    key: "instagram",
    label: "Instagram",
    color: "#c13584",
    url: (h) => `https://instagram.com/${h}`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "tiktok",
    label: "TikTok",
    color: "#111111",
    url: (h) => `https://www.tiktok.com/@${h}`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.5 3h3c.2 1.8 1.3 3.3 3.5 3.7v3.1c-1.4 0-2.6-.4-3.6-1.1v6.2a6.4 6.4 0 1 1-6.4-6.4c.3 0 .7 0 1 .1v3.2a3.2 3.2 0 1 0 2.5 3.1z" />
      </svg>
    ),
  },
  {
    key: "snapchat",
    label: "Snapchat",
    color: "#d3b400",
    url: (h) => `https://www.snapchat.com/add/${h}`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.5c2.8 0 4.6 2 4.6 4.8v2c.6.2 1.2-.4 1.9-.1.6.3.4 1-.1 1.4-.5.4-1.5.6-1.7 1.4-.1.7.6 1.9 2.3 2.9.6.3.3 1-.3 1.1-.7.2-1.7.3-1.9.6-.2.3-.1.9-.7 1-.6.2-1.4-.2-2.3 0-.9.2-1.6 1.4-3.8 1.4s-2.9-1.2-3.8-1.4c-.9-.2-1.7.2-2.3 0-.6-.1-.5-.7-.7-1-.2-.3-1.2-.4-1.9-.6-.6-.1-.9-.8-.3-1.1 1.7-1 2.4-2.2 2.3-2.9-.2-.8-1.2-1-1.7-1.4-.5-.4-.7-1.1-.1-1.4.7-.3 1.3.3 1.9.1v-2c0-2.8 1.8-4.8 4.6-4.8z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "youtube",
    label: "YouTube",
    color: "#e02f2f",
    url: (h) => `https://www.youtube.com/@${h}`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="2.5" y="6" width="19" height="13" rx="3.5" stroke="currentColor" strokeWidth="2" />
        <path d="M10.5 10.2v4.6l4-2.3z" fill="currentColor" />
      </svg>
    ),
  },
];

export default function SocialLinks({ socials }: { socials?: UserSocials }) {
  if (!socials) return null;
  const connected = NETWORKS.filter((n) => socials[n.key]?.trim());
  if (connected.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      {connected.map((n) => (
        <a
          key={n.key}
          href={n.url(socials[n.key]!.trim())}
          target="_blank"
          rel="noreferrer"
          title={`${n.label}: @${socials[n.key]}`}
          className="grid h-8 w-8 place-items-center rounded-full bg-paper-2 text-ink-2 ring-1 ring-line transition-colors hover:text-paper"
          style={{ ["--hov" as string]: n.color }}
          onMouseEnter={(e) => (e.currentTarget.style.background = n.color)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        >
          {n.icon}
        </a>
      ))}
    </div>
  );
}

export const SOCIAL_NETWORKS = NETWORKS.map(({ key, label }) => ({ key, label }));
