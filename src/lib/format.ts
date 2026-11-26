export function formatDate(input?: string | number | Date | null): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isExpiring(iso?: string | null, withinMs = 7 * 24 * 60 * 60 * 1000): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t > now && t - now < withinMs;
}

/** "VERIFY_EMAIL_SENT" → "Verify email sent". */
export function humanize(value: string): string {
  const s = value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b(mfa|ip|api|id)\b/g, (w) => w.toUpperCase());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Short form of a UUID for dense tables; the full value stays in the title attribute. */
export function shortId(id?: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

const rtf =
  typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "3 hours ago", "in 2 days". Falls back to the full date. */
export function timeAgo(input?: string | null): string {
  if (!input) return "—";
  const t = new Date(input).getTime();
  if (Number.isNaN(t) || !rtf) return formatDate(input);
  const secs = Math.round((t - Date.now()) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return "just now";
}
