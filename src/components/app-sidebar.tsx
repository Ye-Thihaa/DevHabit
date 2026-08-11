import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Activity,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  RefreshCw,
  Settings,
  Terminal,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// The three dashboard views used to be tabs sitting above the cards. As
// sidebar entries they read as places you go rather than a control you
// operate, which is what the reference layouts do — and because they are
// links carrying ?view=, the back button and a pasted URL both work.
export type DashboardView = "overview" | "profile" | "analytics" | "sync";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: "/dashboard" | "/log" | "/settings" | "/about";
  view?: DashboardView;
};

const SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Dashboard",
    items: [
      { label: "Overview", icon: LayoutDashboard, to: "/dashboard", view: "overview" },
      { label: "Developer profile", icon: UserRound, to: "/dashboard", view: "profile" },
      { label: "Analytics", icon: BarChart3, to: "/dashboard", view: "analytics" },
      { label: "Sync", icon: RefreshCw, to: "/dashboard", view: "sync" },
    ],
  },
  {
    heading: "Your data",
    items: [
      { label: "Daily log", icon: PenLine, to: "/log" },
      { label: "Settings", icon: Settings, to: "/settings" },
      { label: "What's measured", icon: BookOpen, to: "/about" },
    ],
  },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type AppSidebarProps = {
  /** Which dashboard view is showing, when the dashboard is the active route. */
  activeView?: DashboardView | undefined;
  /** Closes the mobile sheet after a tap; unused on the desktop rail. */
  onNavigate?: (() => void) | undefined;
  /** Icon-only rail. Never set inside the mobile sheet, which has the room. */
  collapsed?: boolean | undefined;
  onToggleCollapse?: (() => void) | undefined;
};

export function AppSidebar({
  activeView,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);

  const displayName = user?.name ?? user?.githubUsername ?? "Signed in";

  return (
    <div className={cn("flex h-full flex-col gap-6 p-4", collapsed && "items-center px-2")}>
      <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "w-full")}>
        <Link
          to="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 px-1 pt-1"
          onClick={onNavigate}
          title={collapsed ? "devhabit" : undefined}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Terminal className="size-4" />
          </span>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight">devhabit</span>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        )}
      </div>

      <nav className="flex w-full flex-1 flex-col gap-6">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="space-y-1">
            {collapsed ? (
              // The heading text has nowhere to go at 72px, but the grouping
              // still needs to read as a grouping — hence a rule instead.
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-border" />
            ) : (
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  // A view-less item (Daily log, Settings) leans on the
                  // router's own active matching; the dashboard trio has to
                  // compare ?view= itself, since all three share one route.
                  {...(item.view ? { search: { view: item.view } } : {})}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                    "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    collapsed && "justify-center px-0",
                    item.view &&
                      activeView === item.view &&
                      "bg-accent font-medium text-accent-foreground",
                  )}
                  {...(item.view
                    ? {}
                    : {
                        activeProps: {
                          className: "bg-accent font-medium text-accent-foreground",
                        },
                      })}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "w-full",
          !collapsed && "rounded-xl border border-border bg-muted/30 p-3",
        )}
      >
        <div className={cn("flex items-center gap-2.5", collapsed && "flex-col gap-2")}>
          <Avatar className="size-8 shrink-0" title={collapsed ? displayName : undefined}>
            {user?.image && <AvatarImage src={user.image} alt={displayName} />}
            <AvatarFallback className="bg-secondary text-xs font-medium">
              {initialsOf(displayName) || "?"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {user?.githubUsername && (
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  @{user.githubUsername}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              void signOut().then(() => navigate({ to: "/login" }));
            }}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <p className="flex items-center gap-1.5 px-2 pb-1 font-mono text-[11px] text-muted-foreground/70">
          <Activity className="size-3" />
          tracking since day one
        </p>
      )}
    </div>
  );
}
