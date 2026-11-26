import { useState } from "react";

import { UserPicker } from "./Subject";

/**
 * "Show for user" box. Some spring-iam lists (deny rules, resource grants,
 * decision audit) are per user only, so those pages start from a user.
 */
export function SubjectLookup({
  onSubmit,
  label = "Show",
}: {
  onSubmit: (subjectId: string) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="mb-4 flex max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft.trim());
      }}
    >
      <UserPicker value={draft} onChange={setDraft} />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="h-9 shrink-0 rounded-md bg-[var(--primary)] px-4 text-[13px] font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
      >
        {label}
      </button>
    </form>
  );
}
