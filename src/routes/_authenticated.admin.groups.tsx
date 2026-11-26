import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { groupsApi } from "@/api/resources";
import type { Group } from "@/api/types";
import { Subject } from "@/components/iam/Subject";
import { PageHeader } from "@/components/iam/PageHeader";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { Button } from "@/components/ui/button";
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

  if (features && !features.groups) {
    return <p className="text-sm text-[var(--muted-foreground)]">Groups are disabled.</p>;
  }

  const columns: Column<Group>[] = [
    {
      key: "name",
      header: "Name",
      render: (g) => <span className="font-mono text-[13px]">{g.name}</span>,
    },
    { key: "desc", header: "Description", render: (g) => g.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title="Groups"
        description="Give a role to a group once, instead of to each person."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable
          columns={columns}
          rows={q.data}
          loading={q.isLoading}
          empty="No groups."
          rowKey={(g) => g.id}
          onRowClick={setSelected}
        />
        {selected ? (
          <GroupDetail group={selected} onClose={() => setSelected(null)} />
        ) : (
          <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted-foreground)]">
            Select a group to view members.
          </div>
        )}
      </div>
    </div>
  );
}

function GroupDetail({ group, onClose }: { group: Group; onClose: () => void }) {
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["group-members", group.id],
    queryFn: () => groupsApi.members(group.id),
  });
  const [subjectId, setSubjectId] = useState("");

  const add = useMutation({
    mutationFn: () => groupsApi.addMember(group.id, subjectId.trim()),
    onSuccess: () => {
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["group-members", group.id] });
      setSubjectId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => groupsApi.removeMember(group.id, memberId),
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["group-members", group.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-semibold">{group.name}</div>
          <div className="text-xs text-[var(--muted-foreground)]">
            {group.description ?? "No description"}
          </div>
        </div>
        <button className="text-xs text-[var(--muted-foreground)]" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mb-3 space-y-2">
        <Label htmlFor="gm-sub">Add member</Label>
        <div className="flex gap-2">
          <Input
            id="gm-sub"
            placeholder="User ID"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          />
          <Button size="sm" onClick={() => add.mutate()} disabled={!subjectId || add.isPending}>
            Add
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {(members.data ?? []).map((m) => (
          <li key={m.subjectId} className="flex items-center justify-between py-2">
            <Subject id={m.subjectId} />
            <button
              className="text-xs text-[var(--destructive)]"
              onClick={() => remove.mutate(m.subjectId)}
            >
              Remove
            </button>
          </li>
        ))}
        {!members.isLoading && (members.data ?? []).length === 0 ? (
          <li className="py-4 text-center text-xs text-[var(--muted-foreground)]">No members.</li>
        ) : null}
      </ul>
    </div>
  );
}
