import { useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * "Show for user" box. Some spring-iam lists (deny rules, resource grants,
 * decision audit) are per user only, so those pages start from a user ID.
 */
export function SubjectLookup({
  onSubmit,
  label = "Show",
  initial = "",
}: {
  onSubmit: (subjectId: string) => void;
  label?: string;
  initial?: string;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="mb-4 flex max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft.trim());
      }}
    >
      <Input
        aria-label="User ID"
        placeholder="User ID (UUID), from the Users page"
        className="font-mono"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        className="h-9 shrink-0 rounded-md bg-[var(--primary)] px-4 text-[13px] font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
      >
        {label}
      </button>
    </form>
  );
}
