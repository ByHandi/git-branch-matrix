"use client";

import { useTrackAppNavigation } from "@/hooks/use-back-to";

/**
 * Renders nothing; exists so the navigation tracking lives in its own component rather than in
 * a provider. Reading `usePathname()` there would re-render the provider tree on every route
 * change for no benefit.
 */
function AppNavigationTracker() {
  useTrackAppNavigation();
  return null;
}

export default AppNavigationTracker;
