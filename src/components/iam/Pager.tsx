import { ChevronLeft, ChevronRight } from "lucide-react";

import type { PageResponse } from "@/api/types";

/** Previous / next for spring-iam's PageResponse. Hidden when everything fits on one page. */
export function Pager({
  page,
  onPage,
}: {
  page?: PageResponse<unknown>;
  onPage: (n: number) => void;
}) {
  if (!page || page.totalPages <= 1) return null;
  const btn =
    "grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="mt-3 flex items-center justify-end gap-3 text-[13px] text-[var(--muted-foreground)]">
      <span>
        Page {page.number + 1} of {page.totalPages} ({page.totalElements} total)
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onPage(page.number - 1)}
        disabled={page.number === 0}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onPage(page.number + 1)}
        disabled={page.number + 1 >= page.totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
