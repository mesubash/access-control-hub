import { useQuery } from "@tanstack/react-query";

import { identitiesApi } from "@/api/resources";
import { useAuthz } from "@/context/AuthzContext";

/** Every user, cached once for labelling IDs across pages. ponytail: first 200 only. */
export function useUsersById() {
  const { can } = useAuthz();
  const q = useQuery({
    queryKey: ["identities", "all"],
    queryFn: () => identitiesApi.list({ limit: 200 }),
    enabled: can("platform.identity.read"),
    staleTime: 60_000,
  });
  return new Map((q.data ?? []).map((u) => [u.id, u]));
}

/** A user ID shown as their name and email when known; the raw ID is on hover. */
export function Subject({ id }: { id?: string | null }) {
  const users = useUsersById();
  if (!id) return <span className="text-[var(--muted-foreground)]">—</span>;
  const u = users.get(id);
  if (!u) {
    return (
      <span className="font-mono text-[12.5px]" title={id}>
        {id.slice(0, 8)}…
      </span>
    );
  }
  return (
    <span className="block min-w-0" title={id}>
      <span className="block truncate">{u.displayName || u.email}</span>
      {u.displayName ? (
        <span className="block truncate text-[12.5px] text-[var(--muted-foreground)]">
          {u.email}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Choose a user by name when the user list is readable; otherwise type an ID.
 * Used wherever spring-iam wants a subject ID.
 */
export function UserPicker({
  id,
  value,
  onChange,
  placeholder = "Choose a user…",
}: {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const users = useUsersById();
  if (users.size === 0) {
    return (
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="User ID (UUID)"
        spellCheck={false}
        className="flex h-9 w-full min-w-0 rounded-md border border-[var(--input)] bg-[var(--card)] px-3 font-mono text-[13px]"
      />
    );
  }
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full min-w-0 rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-[13px]"
    >
      <option value="">{placeholder}</option>
      {[...users.values()].map((u) => (
        <option key={u.id} value={u.id}>
          {u.displayName ? `${u.displayName} (${u.email})` : u.email}
        </option>
      ))}
    </select>
  );
}
