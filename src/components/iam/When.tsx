import { formatDate, timeAgo } from "@/lib/format";

/** Relative time, with the exact date on hover. */
export function When({ at }: { at?: string | null }) {
  if (!at) return <span className="text-[var(--muted-foreground)]">—</span>;
  return (
    <time dateTime={at} title={formatDate(at)} className="whitespace-nowrap">
      {timeAgo(at)}
    </time>
  );
}
