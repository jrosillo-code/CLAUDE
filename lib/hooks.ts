"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { visiblePins as computeVisible } from "./data";
import type { PinWithOwner, User } from "./types";

export function useViewer(): User {
  const users = useStore((s) => s.users);
  const viewerId = useStore((s) => s.viewerId);
  return users.find((u) => u.id === viewerId) ?? users[0];
}

export function useVisiblePins(): PinWithOwner[] {
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const follows = useStore((s) => s.follows);
  const activeUserIds = useStore((s) => s.activeUserIds);
  const explore = useStore((s) => s.explore);
  const blockedIds = useStore((s) => s.blockedIds);

  return useMemo(
    () =>
      computeVisible({
        pins,
        users,
        friendships,
        viewerId,
        follows,
        activeUserIds,
        explore,
      }).filter((p) => !blockedIds.has(p.userId)),
    [pins, users, friendships, viewerId, follows, activeUserIds, explore, blockedIds]
  );
}

/** Pins for the dispatch strip: everything the viewer may see, ignoring the
 *  Travelers layer filter — a friend on the road shows even if their layer
 *  is switched off (visibility rules still apply, exactly as on the map). */
export function useDispatchPins(): PinWithOwner[] {
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const follows = useStore((s) => s.follows);
  const blockedIds = useStore((s) => s.blockedIds);
  return useMemo(
    () => computeVisible({ pins, users, friendships, viewerId, follows, activeUserIds: null, explore: false }).filter((p) => !blockedIds.has(p.userId)),
    [pins, users, friendships, viewerId, follows, blockedIds]
  );
}

/** All creator accounts (for the Creators tab). */
export function useCreators(): User[] {
  const users = useStore((s) => s.users);
  return useMemo(() => users.filter((u) => u.isCreator), [users]);
}

/** Creators the viewer currently follows (for the layer rail). */
export function useFollowedCreators(): User[] {
  const users = useStore((s) => s.users);
  const follows = useStore((s) => s.follows);
  return useMemo(
    () => users.filter((u) => u.isCreator && follows.has(u.id)),
    [users, follows]
  );
}

/** Accepted friends of the current viewer, for the layer rail. */
export function useFriends(): User[] {
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);

  return useMemo(() => {
    const ids = new Set<string>();
    for (const f of friendships) {
      if (f.status !== "accepted") continue;
      if (f.userA === viewerId) ids.add(f.userB);
      else if (f.userB === viewerId) ids.add(f.userA);
    }
    return users.filter((u) => ids.has(u.id));
  }, [users, friendships, viewerId]);
}
