import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Ban,
  Boxes,
  ClipboardList,
  FileCheck2,
  FolderTree,
  Gauge,
  Group,
  KeyRound,
  LogOut,
  Menu,
  MonitorSmartphone,
  ScrollText,
  Search,
  ShieldCheck,
  Ticket,
  Tag as TagIcon,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { FeatureFlags } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

import { BadgeMark } from "./BadgeMark";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  featureFlag?: keyof FeatureFlags;
};

const meItems: NavItem[] = [
  { to: "/me/access", label: "My access", icon: UserCheck },
  { to: "/me/sessions", label: "Sessions", icon: MonitorSmartphone },
  { to: "/me/security", label: "Security", icon: ShieldCheck },
];

const adminItems: NavItem[] = [
  { to: "/admin/dashboard", label: "Overview", icon: Gauge },
  { to: "/admin/users", label: "Users", icon: Users, permission: "platform.identity.read" },
  { to: "/admin/scopes", label: "Scopes", icon: FolderTree, permission: "platform.scope.read" },
  { to: "/admin/roles", label: "Roles", icon: KeyRound, permission: "platform.role.read" },
  {
    to: "/admin/permissions",
    label: "Permissions",
    icon: TagIcon,
    permission: "platform.permission.read",
  },
  {
    to: "/admin/assignments",
    label: "Assignments",
    icon: ClipboardList,
    permission: "platform.assignment.read",
  },
  { to: "/admin/groups", label: "Groups", icon: Group, featureFlag: "groups" },
  {
    to: "/admin/deny-rules",
    label: "Deny rules",
    icon: Ban,
    permission: "platform.deny_rule.read",
  },
  {
    to: "/admin/policies",
    label: "Policies",
    icon: FileCheck2,
    permission: "platform.policy.read",
  },
  {
    to: "/admin/resource-grants",
    label: "Resource grants",
    icon: Ticket,
    featureFlag: "resource-grants",
  },
  { to: "/admin/services", label: "Services", icon: Boxes, featureFlag: "service-registry" },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "platform.audit.read" },
  { to: "/admin/explain", label: "Explain a decision", icon: Search },
];

export function AppLayout() {
  const { identity, logout } = useAuth();
  const { scopes, scopeId, setScopeId, can, features } = useAuthz();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navOpen, setNavOpen] = useState(false);

  // Close the phone menu whenever the page changes.
  useEffect(() => setNavOpen(false), [pathname]);

  const visibleAdmin = adminItems.filter((i) => {
    if (i.featureFlag && features && !features[i.featureFlag]) return false;
    if (i.permission && !can(i.permission)) return false;
    return true;
  });

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    void navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-dvh w-full bg-[var(--background)] text-[var(--foreground)]">
      {/* Sidebar: fixed on wide screens, a slide-over menu on phones. */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/30 transition-opacity md:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-transform duration-200 motion-reduce:transition-none md:sticky md:top-0 md:h-dvh md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight"
          >
            <BadgeMark className="size-5 text-[var(--primary)]" />
            {APP_NAME}
          </Link>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="grid size-8 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
          <NavGroup label="You" items={meItems} pathname={pathname} />
          {visibleAdmin.length > 0 ? (
            <NavGroup label="Administration" items={visibleAdmin} pathname={pathname} />
          ) : null}
        </nav>
        <div className="flex items-center gap-2 border-t border-[var(--border)] py-3 pr-2 pl-4 text-[13px]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={identity?.email}>
              {identity?.displayName || identity?.email || "…"}
            </p>
            {identity?.displayName ? (
              <p className="truncate text-[var(--muted-foreground)]">{identity.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)]/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/80 md:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid size-8 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <label
              className="hidden text-[13px] text-[var(--muted-foreground)] sm:block"
              htmlFor="scope-switcher"
            >
              Scope
            </label>
            <select
              id="scope-switcher"
              value={scopeId ?? ""}
              onChange={(e) => setScopeId(e.target.value)}
              className="h-8 max-w-[52vw] min-w-0 truncate rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-[13px] sm:max-w-xs"
            >
              {scopes.length === 0 ? <option value="">No scopes</option> : null}
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={identity?.email} onLogout={handleLogout} />
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function UserMenu({ email, onLogout }: { email?: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-8 place-items-center rounded-full bg-[var(--primary-subtle)] text-[13px] font-semibold text-[var(--primary)] hover:ring-2 hover:ring-[var(--border)]"
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-10 right-0 z-30 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
        >
          <p className="truncate px-2.5 py-2 text-[13px] text-[var(--muted-foreground)]">{email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-[var(--muted)]"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="mb-5">
      <p className="px-2 pb-1.5 text-[12px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <ul className="grid gap-0.5">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-[var(--primary-subtle)] font-medium text-[var(--primary)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
