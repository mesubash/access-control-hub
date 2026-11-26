import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { groupsApi } from "@/api/resources";
import type { Group } from "@/api/types";
import { ConfirmDialog } from "@/components/iam/ConfirmDialog";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { PageHeader } from "@/components/iam/PageHeader";
import { Subject, UserPicker, useUsersById } from "@/components/iam/Subject";
import { When } from "@/components/iam/When";
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

export const Route = createFileRoute("/_authenticated/admin/groups")({
  head: () => ({ meta: [{ title: pageTitle("Groups") }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const { features } = useAuthz();
  const q = useQuery({ queryKey: ["groups"], queryFn: groupsApi.list });
  const [selected, setSelected] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);

  if (features && !features.groups) {
    return (
      <PageHeader
        title="Groups"
        description="Groups are turned off on this IAM (iam.features.groups)."
      />
    );
  }

  const columns: Column<Group>[] = [
    {
      key: "name",
      header: "Group",
      render: (g) => (
        <div>
          <p className="font-medium">{g.name}</p>
          {g.description ? (
            <p className="text-[12.5px] text-[var(--muted-foreground)]">{g.description}</p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Groups"
        description="Give a role to a group once, instead of to each person."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New group
          </Button>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <DataTable
          columns={columns}
          rows={q.data}
          loading={q.isLoading}
          empty="No groups yet."
          rowKey={(g) => g.id}
          onRowClick={setSelected}
          selectedKey={selected?.id}
        />
        {selected ? (
          <GroupDetail key={selected.id} group={selected} onClose={() => setSelected(null)} />
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--input)] p-5 text-[13.5px] text-[var(--muted-foreground)]">
            Pick a group to see and change who's in it.
          </p>
        )}
      </div>
      {creating ? <CreateGroup onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function GroupDetail({ group, onClose }: { group: Group; onClose: () => void }) {
  const qc = useQueryClient();
  const users = useUsersById();
  const members = useQuery({
    queryKey: ["group-members", group.id],
    queryFn: () => groupsApi.members(group.id),
  });
  const [subjectId, setSubjectId] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => groupsApi.addMember(group.id, subjectId),
    onSuccess: () => {
      toast.success("Added to the group");
      void qc.invalidateQueries({ queryKey: ["group-members", group.id] });
      setSubjectId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (sid: string) => groupsApi.removeMember(group.id, sid),
    onSuccess: () => {
      toast.success("Removed from the group");
      void qc.invalidateQueries({ queryKey: ["group-members", group.id] });
      setRemoving(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inGroup = new Set((members.data ?? []).map((m) => m.subjectId));
  const label = (sid: string) => users.get(sid)?.email ?? sid;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="font-semibold">{group.name}</h2>
          <p className="text-[12.5px] text-[var(--muted-foreground)]">
            {members.data ? `${members.data.length} in this group` : "Loading members…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-7 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
        >
          <X className="size-4" />
        </button>
      </header>
      <form
        className="flex gap-2 border-b border-[var(--border)] px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (inGroup.has(subjectId)) return void toast.message("Already in this group");
          add.mutate();
        }}
      >
        <Label htmlFor="gm-sub" className="sr-only">
          Add someone
        </Label>
        <UserPicker
          id="gm-sub"
          value={subjectId}
          onChange={setSubjectId}
          placeholder="Add someone…"
        />
        <Button type="submit" size="sm" className="h-9" disabled={!subjectId || add.isPending}>
          Add
        </Button>
      </form>
      <ul className="divide-y divide-[var(--border)]">
        {(members.data ?? []).map((m) => (
          <li key={m.subjectId} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
            <div className="min-w-0 flex-1">
              <Subject id={m.subjectId} />
            </div>
            {m.addedAt ? (
              <span className="text-[12.5px] text-[var(--muted-foreground)]">
                added <When at={m.addedAt} />
              </span>
            ) : null}
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[12.5px] text-[var(--destructive)] hover:bg-[var(--destructive-subtle)]"
              onClick={() => setRemoving(m.subjectId)}
            >
              Remove
            </button>
          </li>
        ))}
        {!members.isLoading && (members.data ?? []).length === 0 ? (
          <li className="px-4 py-6 text-center text-[13px] text-[var(--muted-foreground)]">
            Nobody yet.
          </li>
        ) : null}
      </ul>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove from ${group.name}?`}
        description="They lose any roles that come through this group on their next request."
        target={removing ? label(removing) : undefined}
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </section>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const m = useMutation({
    mutationFn: () =>
      groupsApi.create({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      toast.success("Group created");
      void qc.invalidateQueries({ queryKey: ["groups"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Then add people, and give the group roles on the Assignments page.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-group"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="g-name">Name</Label>
            <Input
              id="g-name"
              autoFocus
              placeholder="night-shift"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Input
              id="g-desc"
              placeholder="Cashiers on the night rota"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-group" disabled={!name.trim() || m.isPending}>
            {m.isPending ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
