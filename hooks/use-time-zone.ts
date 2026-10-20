import { useSyncExternalStore } from "react";

import { FALLBACK_TIME_ZONE } from "@/lib/time";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
// the device zone doesn't change while the page is open, so there is nothing to subscribe to
const subscribe = () => () => {};

/**
 * The viewer's timezone. On the server, and during hydration, it is the
 * fallback zone, so the server HTML and the first client render match; React
 * then re-renders with the device zone without a hydration warning.
 */
export function useTimeZone() {
  return useSyncExternalStore(subscribe, deviceTimeZone, () => FALLBACK_TIME_ZONE);
}
