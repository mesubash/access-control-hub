import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuthz } from "@/context/AuthzContext";
import { PageHeader } from "@/components/iam/PageHeader";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { Tag } from "@/components/iam/badges";
import { Input } from "@/components/ui/input";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/me/access")({
  head: () => ({ meta: [{ title: pageTitle("My access") }] }),
  component: MyAccessPage,
});

function MyAccessPage() {
  const { permissions, isLoading } = useAuthz();
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const arr = Array.from(permissions).sort();
    const f = filter.trim().toLowerCase();
    return f ? arr.filter((k) => k.toLowerCase().includes(f)) : arr;
  }, [permissions, filter]);

  const columns: Column<string>[] = [
    {
      key: "key",
      header: "Permission",
      render: (k) => <span className="font-mono text-[13px]">{k}</span>,
    },
    {
      key: "domain",
      header: "Domain",
      width: "140px",
      render: (k) => <Tag>{k.split(".")[0] ?? "—"}</Tag>,
    },
  ];

  return (
    <div>
      <PageHeader title="My access" description="What you can do in the scope picked at the top." />
      <div className="mb-3">
        <Input
          placeholder="Filter permissions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        empty="No permissions at this scope."
        rowKey={(k) => k}
      />
    </div>
  );
}
