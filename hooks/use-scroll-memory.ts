"use client";

import { usePathname } from "next/navigation";

import { useCallback } from "react";

/**
 * Whether the navigation in progress came from Back/Forward.
 *
 * Module scope, set by `popstate` and consumed by the next list that mounts — a Back lands on a
 * page with one scrolling list, and that list is the one to put back where it was. A click on a
 * link fires no `popstate`, so a list reached that way starts at the top.
 */
let restoring = false;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    restoring = true;
  });
}

const STORAGE_PREFIX = "gbm.scroll:";

/**
 * The page itself never scrolls — only its list does — so the browser's own scroll restoration has
 * nothing to restore on Back. This keeps each list's position for the session, per path, and puts
 * it back when you return through history.
 *
 * Returns a callback ref rather than taking a ref object: a list that only renders once it has
 * rows mounts after the page does, and a ref object would not say when that happens.
 */
export function useScrollMemory(id = "list") {
  const pathname = usePathname();
  const key = `${STORAGE_PREFIX}${pathname}#${id}`;

  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;

      if (restoring) {
        restoring = false;
        try {
          const saved = Number(sessionStorage.getItem(key));
          // after layout, so the rows are there to scroll past
          if (saved > 0) requestAnimationFrame(() => el.scrollTo({ top: saved }));
        } catch {}
      }

      let frame = 0;
      const onScroll = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          try {
            sessionStorage.setItem(key, String(Math.round(el.scrollTop)));
          } catch {}
        });
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        cancelAnimationFrame(frame);
        el.removeEventListener("scroll", onScroll);
      };
    },
    [key],
  );
}

export default useScrollMemory;
