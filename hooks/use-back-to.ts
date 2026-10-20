"use client";

import { usePathname, useRouter } from "next/navigation";

import { useCallback, useEffect, useRef } from "react";

// Ported from telescope/service-inventory-frontend (hooks/useBackTo.ts).

/**
 * Whether this document has navigated inside the app at least once.
 *
 * Module scope, so it resets on every full page load — which is exactly the question being asked. A
 * page opened straight from a bookmark or a shared link has nothing of ours behind it, and
 * `router.back()` there either does nothing or walks the user out of the app entirely.
 *
 * `window.history.length` cannot answer this: a tab that visited other sites first reports a long
 * history containing none of our pages, and a link opened in a fresh tab reports 1 even after the
 * user has moved around inside the app. What matters is whether *we* pushed an entry, so that is
 * what this tracks.
 */
let hasNavigatedWithinApp = false;

/**
 * Mounted once, near the root. Records client-side route changes so `useBackTo` can tell a
 * deep-linked page from one the user reached by clicking through the app.
 */
export function useTrackAppNavigation() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // The first pathname is where the document landed, not a navigation.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    hasNavigatedWithinApp = true;
  }, [pathname]);
}

/** The two navigations a back handler makes — `useRouter()`, or a guarded stand-in for it. */
type BackRouter = { back: () => void; push: (href: string) => void };

/**
 * A back handler for page headers: goes back when there is somewhere of ours to go back to, and
 * otherwise sends the user to `fallbackHref`.
 *
 * `via` routes both through another router, e.g. one that asks before leaving unsaved edits.
 */
export function useBackTo(fallbackHref: string, via?: BackRouter) {
  const appRouter = useRouter();
  const router = via ?? appRouter;

  return useCallback(() => {
    if (hasNavigatedWithinApp) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);
}

export default useBackTo;
