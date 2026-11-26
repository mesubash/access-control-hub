import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { assignmentsApi, rolesApi, scopesApi } from "@/api/resources";
import type { Scope } from "@/api/types";
import { Subject } from "@/components/iam/Subject";
import { PageHeader } from "@/components/iam/PageHeader";
import { PermissionGuardedPage } from "@/components/iam/PermissionGuardedPage";
import { Can } from "@/components/iam/Can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/iam/ConfirmDialog";
import { Tag } from "@/components/iam/badges";
import { cn } from "@/lib/utils";
import { useAuthz } from "@/context/AuthzContext";
import { pageTitle } from "@/lib/brand";
import { humanize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/scopes")({
  head: () => ({ meta: [{ title: pageTitle("Scopes") }] }),
  component: () => (
    <PermissionGuardedPage permission="platform.scope.read">
      <ScopesPage />
    </PermissionGuardedPage>
  ),
});

type TreeNode = Scope & { children: TreeNode[] };

function buildTree(scopes: Scope[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  scopes.forEach((s) => map.set(s.id, { ...s, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((n) => {
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function ScopesPage() {
  const q = useQuery({ queryKey: ["scopes"], queryFn: scopesApi.list });
  const [selected, setSelected] = useState<Scope | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const { can } = useAuthz();

  const tree = useMemo(() => buildTree(q.data ?? []), [q.data]);
  const descendants = useMemo(() => {
    if (!selected || !q.data) return 0;
    let count = 0;
    const stack = [selected.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const s of q.data) {
        if (s.parentId === id) {
          count++;
          stack.push(s.id);
        }
      }
    }
    return count;
  }, [selected, q.data]);

  return (
    <div>
      <PageHeader
        title="Scopes"
        description="Your organisation as a tree, such as company, country, branch. Access given higher up flows down."
        actions={
          <Can permission="platform.scope.create">
            <Button onClick={() => setCreateOpen(true)}>New scope</Button>
          </Can>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
          {q.isLoading ? (
            <div className="p-3 text-sm text-[var(--muted-foreground)]">Loading…</div>
          ) : tree.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">
              No scopes yet.
            </div>
          ) : (
            <ul className="py-2">
              {tree.map((n) => (
                <TreeRow key={n.id} node={n} depth={0} selected={selected} onSelect={setSelected} />
              ))}
            </ul>
          )}
        </div>
        {selected ? (
          <ScopeDetail
            scope={selected}
            subScopes={descendants}
            canMove={can("platform.scope.move")}
            onMove={() => setMoveOpen(true)}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--input)] p-5 text-[13.5px] text-[var(--muted-foreground)]">
            Pick a scope to see who has roles there.
          </p>
        )}
      </div>
      <CreateScopeDialog open={createOpen} onOpenChange={setCreateOpen} parent={selected} />
      {selected ? (
        <MoveScopeDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          scope={selected}
          all={q.data ?? []}
        />
      ) : null}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: Scope | null;
  onSelect: (s: Scope) => void;
}) {
  const isActive = selected?.id === node.id;
  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => onSelect(node)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-[14px] hover:bg-[var(--muted)]",
            isActive &&
              "bg-[var(--primary-subtle)] text-[var(--primary)] hover:bg-[var(--primary-subtle)]",
          )}
          style={{ paddingLeft: 10 + depth * 22 }}
          aria-current={isActive ? "true" : undefined}
        >
          {depth > 0 ? (
            <span aria-hidden="true" className="-ml-3 text-[var(--input)]">
              └
            </span>
          ) : null}
          <span className="font-medium">{node.name}</span>
          <span className="font-mono text-[12px] text-[var(--muted-foreground)]">{node.code}</span>
          <Tag className="ml-auto">{humanize(node.type)}</Tag>
        </button>
      </li>
      {node.children.map((c) => (
        <TreeRow key={c.id} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

function CreateScopeDialog({
  open,
  onOpenChange,
  parent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parent: Scope | null;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState("ORG");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>(parent?.id ?? "");
  const m = useMutation({
    mutationFn: () => scopesApi.create({ type, name, code, parentId: parentId || null }),
    onSuccess: () => {
      toast.success("Scope created");
      qc.invalidateQueries({ queryKey: ["scopes"] });
      onOpenChange(false);
      setName("");
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New scope</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="s-type">Type</Label>
          <Input id="s-type" value={type} onChange={(e) => setType(e.target.value)} />
          <Label htmlFor="s-name">Name</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Label htmlFor="s-code">Code</Label>
          <Input id="s-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Label htmlFor="s-parent">Parent ID (optional)</Label>
          <Input id="s-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !name || !code || !type}>
            {m.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveScopeDialog({
  open,
  onOpenChange,
  scope,
  all,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: Scope;
  all: Scope[];
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const m = useMutation({
    mutationFn: () => scopesApi.move(scope.id, target),
    onSuccess: () => {
      toast.success("Scope moved");
      qc.invalidateQueries({ queryKey: ["scopes"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Move ${scope.name}`}
      description="Everything under it moves too, and access inherited from the old parent stops applying."
      confirmLabel="Move"
      destructive
      pending={m.isPending}
      onConfirm={() => target && m.mutate()}
    >
      <div className="space-y-2">
        <Label htmlFor="m-parent">New parent</Label>
        <select
          id="m-parent"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-9 w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-sm"
        >
          <option value="">Choose a new parent…</option>
          {all
            // A scope can't move under itself or anything below it.
            .filter((s) => !s.path.startsWith(scope.path) && s.id !== scope.parentId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.path}
              </option>
            ))}
        </select>
      </div>
    </ConfirmDialog>
  );
}

function ScopeDetail({
  scope,
  subScopes,
  canMove,
  onMove,
}: {
  scope: Scope;
  subScopes: number;
  canMove: boolean;
  onMove: () => void;
}) {
  const { can } = useAuthz();
  const assignments = useQuery({
    queryKey: ["assignments"],
    queryFn: () => assignmentsApi.list(),
    enabled: can("platform.assignment.read"),
  });
  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const here = (assignments.data ?? []).filter((a) => a.scopeId === scope.id && a.active !== false);
  const roleName = (id: string) => {
    const r = roles.data?.find((x) => x.id === id);
    return r ? r.displayName || r.name : "Unknown role";
  };

  return (
    <aside className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="font-semibold">{scope.name}</h2>
        <p className="font-mono text-[12.5px] text-[var(--muted-foreground)]">{scope.path}</p>
      </header>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-[13.5px]">
        <dt className="text-[var(--muted-foreground)]">Type</dt>
        <dd>{humanize(scope.type)}</dd>
        <dt className="text-[var(--muted-foreground)]">Below it</dt>
        <dd>{subScopes === 0 ? "Nothing" : `${subScopes} scope${subScopes === 1 ? "" : "s"}`}</dd>
        <dt className="text-[var(--muted-foreground)]">Status</dt>
        <dd>{scope.active ? "Active" : "Inactive"}</dd>
      </dl>
      {assignments.data ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <p className="mb-2 text-[13px] font-medium">
            Roles given here{" "}
            <span className="font-normal text-[var(--muted-foreground)]">({here.length})</span>
          </p>
          {here.length === 0 ? (
            <p className="text-[13px] text-[var(--muted-foreground)]">
              None directly. Roles from scopes above still apply.
            </p>
          ) : (
            <ul className="grid gap-2">
              {here.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-[13px]">
                  <Subject id={a.subjectId} />
                  <Tag>{roleName(a.roleId)}</Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {canMove ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <Button variant="outline" size="sm" onClick={onMove}>
            Move this scope
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
