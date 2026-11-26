import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { assignmentsApi, permissionsApi, rolesApi } from "@/api/resources";
import type { Permission, Role } from "@/api/types";
import { Can } from "@/components/iam/Can";
import { ConfirmDialog } from "@/components/iam/ConfirmDialog";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { Tag } from "@/components/iam/badges";
import { PageHeader } from "@/components/iam/PageHeader";
import { PermissionGuardedPage } from "@/components/iam/PermissionGuardedPage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthz } from "@/context/AuthzContext";
import { pageTitle } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({ meta: [{ title: pageTitle("Roles") }] }),
  component: () => (
    <PermissionGuardedPage permission="platform.role.read">
      <RolesPage />
    </PermissionGuardedPage>
  ),
});

function RolesPage() {
  const { can } = useAuthz();
  const q = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const assignments = useQuery({
    queryKey: ["assignments"],
    queryFn: () => assignmentsApi.list(),
    enabled: can("platform.assignment.read"),
  });
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const holders = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of assignments.data ?? []) {
      if (a.active === false) continue;
      if (!m.has(a.roleId)) m.set(a.roleId, new Set());
      m.get(a.roleId)!.add(a.subjectId);
    }
    return m;
  }, [assignments.data]);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const arr = q.data ?? [];
    return f
      ? arr.filter((r) =>
          [r.name, r.displayName, r.description].some((v) => v?.toLowerCase().includes(f)),
        )
      : arr;
  }, [q.data, filter]);

  const columns: Column<Role>[] = [
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {r.displayName || r.name}
            {r.isSystemRole ? (
              <span title="Built in: can't be changed" className="text-[var(--muted-foreground)]">
                <Lock className="size-3.5" aria-label="Built in" />
              </span>
            ) : null}
          </p>
          <p className="font-mono text-[12px] text-[var(--muted-foreground)]">{r.name}</p>
        </div>
      ),
    },
    {
      key: "desc",
      header: "What it's for",
      render: (r) => <span className="text-[var(--muted-foreground)]">{r.description || "—"}</span>,
    },
    {
      key: "people",
      header: "Held by",
      width: "110px",
      render: (r) => {
        if (!assignments.data) return "—";
        const n = holders.get(r.id)?.size ?? 0;
        return n === 0 ? (
          <span className="text-[var(--muted-foreground)]">Nobody</span>
        ) : (
          `${n} ${n === 1 ? "person" : "people"}`
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Bundles of permissions you hand out together. Give them to people on the Assignments page."
        actions={
          <Can permission="platform.role.create">
            <Button onClick={() => setCreateOpen(true)}>New role</Button>
          </Can>
        }
      />
      <Input
        aria-label="Filter roles"
        placeholder="Filter roles"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 max-w-xs"
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={q.isLoading}
        empty={filter ? "No roles match." : "No roles yet."}
        rowKey={(r) => r.id}
        onRowClick={setEditing}
      />
      {createOpen ? <RoleDialog onClose={() => setCreateOpen(false)} /> : null}
      {editing ? <RoleDialog role={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function RoleDialog({ role, onClose }: { role?: Role; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuthz();
  const permsQ = useQuery({ queryKey: ["permissions"], queryFn: permissionsApi.list });
  // spring-iam returns a role's permissions from their own endpoint.
  const rolePermsQ = useQuery({
    queryKey: ["role-permissions", role?.id],
    queryFn: () => rolesApi.permissions(role!.id),
    enabled: !!role,
  });
  const original = useMemo(
    () => new Set((rolePermsQ.data ?? []).map((p) => p.id)),
    [rolePermsQ.data],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set(original)), [original]);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("");
  const [confirming, setConfirming] = useState(false);

  // spring-iam can't edit a role's name or description after creation, and
  // built-in roles can't change at all.
  const locked = !!role?.isSystemRole || (role ? !can("platform.role.update") : false);

  const byId = useMemo(() => new Map((permsQ.data ?? []).map((p) => [p.id, p])), [permsQ.data]);
  const added = [...selected].filter((id) => !original.has(id)).map((id) => byId.get(id)!);
  const removed = [...original].filter((id) => !selected.has(id)).map((id) => byId.get(id)!);
  const dirty = added.length + removed.length > 0;

  const create = useMutation({
    mutationFn: () =>
      rolesApi.create({
        name: name.trim(),
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        permissionIds: [...selected],
      }),
    onSuccess: () => {
      toast.success("Role created");
      void qc.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: () => rolesApi.updatePermissions(role!.id, [...selected]),
    onSuccess: () => {
      toast.success("Permissions saved");
      void qc.invalidateQueries({ queryKey: ["roles"] });
      void qc.invalidateQueries({ queryKey: ["role-permissions", role!.id] });
      setConfirming(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const map = new Map<string, Permission[]>();
    for (const p of permsQ.data ?? []) {
      if (f && !p.key.toLowerCase().includes(f) && !p.description?.toLowerCase().includes(f))
        continue;
      const d = p.domain ?? p.key.split(".")[0];
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permsQ.data, filter]);

  const toggle = (id: string) => {
    if (locked) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{role ? role.displayName || role.name : "New role"}</DialogTitle>
            <DialogDescription>
              {role
                ? role.isSystemRole
                  ? "A built-in role. You can look, but its permissions can't be changed."
                  : role.description || "Pick the permissions this role gives."
                : "Name it after a job people do, then pick what that job needs."}
            </DialogDescription>
          </DialogHeader>

          {role ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="r-name">Key</Label>
                <Input
                  id="r-name"
                  className="font-mono"
                  placeholder="BranchManager"
                  spellCheck={false}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="r-dn">Display name</Label>
                <Input
                  id="r-dn"
                  placeholder="Branch manager"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="r-desc">What it's for</Label>
                <Input
                  id="r-desc"
                  placeholder="Runs orders for one branch"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <p className="text-[12.5px] text-[var(--muted-foreground)] sm:col-span-2">
                These can't be changed after the role is created.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="r-filter">
                Permissions{" "}
                <span className="font-normal text-[var(--muted-foreground)]">
                  ({selected.size} of {permsQ.data?.length ?? 0})
                </span>
              </Label>
              <Input
                id="r-filter"
                placeholder="Search"
                className="h-8 max-w-[200px]"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-[var(--border)]">
              {permsQ.isLoading || rolePermsQ.isLoading ? (
                <p className="p-4 text-[13px] text-[var(--muted-foreground)]">Loading…</p>
              ) : null}
              {grouped.map(([domain, perms]) => {
                const on = perms.filter((p) => selected.has(p.id)).length;
                return (
                  <fieldset
                    key={domain}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <legend className="sr-only">{domain}</legend>
                    <p className="sticky top-0 z-10 flex justify-between bg-[var(--muted)] px-3 py-1.5 text-[12.5px] font-medium">
                      <span className="capitalize">{domain}</span>
                      <span className="font-normal text-[var(--muted-foreground)]">
                        {on} of {perms.length}
                      </span>
                    </p>
                    {perms.map((p) => (
                      <label
                        key={p.id}
                        className={cn(
                          "flex items-start gap-2.5 px-3 py-2 text-[13px]",
                          locked ? "cursor-default" : "cursor-pointer hover:bg-[var(--muted)]/50",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[var(--primary)]"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          disabled={locked}
                        />
                        <span className="min-w-0">
                          <span className="font-mono text-[12.5px]">{p.key}</span>
                          {p.isDeprecated ? (
                            <Tag tone="warning" className="ml-2">
                              Deprecated
                            </Tag>
                          ) : null}
                          {p.description ? (
                            <span className="block text-[var(--muted-foreground)]">
                              {p.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </div>

          <DialogFooter className="items-center">
            {role && dirty ? (
              <p className="mr-auto text-[13px] text-[var(--muted-foreground)]">
                {added.length ? `+${added.length}` : ""}{" "}
                {removed.length ? `−${removed.length}` : ""} unsaved
              </p>
            ) : null}
            <Button variant="outline" onClick={onClose}>
              {locked ? "Close" : "Cancel"}
            </Button>
            {locked ? null : role ? (
              <Button onClick={() => setConfirming(true)} disabled={!dirty}>
                Review changes
              </Button>
            ) : (
              <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
                {create.isPending ? "Creating…" : "Create role"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirming && role ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={`Change ${role.displayName || role.name}?`}
          description="Everyone holding this role gets the change on their next request."
          confirmLabel="Save permissions"
          pending={update.isPending}
          onConfirm={() => update.mutate()}
        >
          <div className="grid gap-3 text-[13px]">
            {added.length ? <Diff label="Adds" tone="success" items={added} /> : null}
            {removed.length ? <Diff label="Removes" tone="destructive" items={removed} /> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function Diff({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "success" | "destructive";
  items: Permission[];
}) {
  return (
    <div>
      <p className="mb-1 font-medium">
        {label} {items.length}
      </p>
      <ul className="grid gap-1">
        {items.map((p) => (
          <li key={p.id}>
            <Tag tone={tone} mono>
              {tone === "success" ? "+" : "−"} {p.key}
            </Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}
