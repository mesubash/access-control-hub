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
