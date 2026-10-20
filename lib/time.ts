/**
 * Absolute dates on the dashboard are shown in the viewer's own timezone. Git
 * stamps each commit with its author's offset and the container runs in UTC,
 * so the raw date strings can't be shown as they are.
 *
 * The server can't know the viewer's zone, so it renders in FALLBACK_TIME_ZONE
 * and the browser switches to the device zone right after hydrating (see
 * hooks/use-time-zone.ts). Override the fallback at build time with
 * NEXT_PUBLIC_TIME_ZONE (an IANA name).
 */
export const FALLBACK_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "UTC";

type Formats = { date: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat; label: string };
const cache = new Map<string, Formats>();

function formats(timeZone: string): Formats {
  let f = cache.get(timeZone);
  if (!f) {
    // sv-SE formats as 2026-10-20 / 2026-10-20 08:29, which is what the UI already used
    const parts = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
    f = {
      date: new Intl.DateTimeFormat("sv-SE", { timeZone, ...parts }),
      dateTime: new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        ...parts,
        hour: "2-digit",
        minute: "2-digit",
      }),
      // "GMT+7" — short and unambiguous, unlike local abbreviations such as "WIB"
      label:
        new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
          .formatToParts(new Date())
          .find((p) => p.type === "timeZoneName")?.value ?? timeZone,
    };
    cache.set(timeZone, f);
  }
  return f;
}

/** 2026-10-20 */
export const formatDate = (iso: string, timeZone = FALLBACK_TIME_ZONE) =>
  formats(timeZone).date.format(new Date(iso));

/** 2026-10-20 08:29 GMT+7 */
export const formatDateTime = (iso: string, timeZone = FALLBACK_TIME_ZONE) => {
  const f = formats(timeZone);
  return `${f.dateTime.format(new Date(iso))} ${f.label}`;
};
