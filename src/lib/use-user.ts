import { useRouteContext } from "@tanstack/react-router";
import type { SessionUser } from "@/lib/types";

/** The signed-in user (or null), hydrated by the root route's beforeLoad. */
export function useUser(): SessionUser | null {
  return useRouteContext({ from: "__root__", select: (c) => c.user });
}
