import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  LogOut,
  PenLine,
  RefreshCw,
  Settings,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// The three dashboard views used to be tabs sitting above the cards. As
// sidebar entries they read as places you go rather than a control you
// operate, which is what the reference layouts do — and because they are
// links carrying ?view=, the back button and a pasted URL both work.
export type DashboardView = "overview" | "analytics" | "sync";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: "/dashboard" | "/log" | "/settings";
  view?: DashboardView;
};

const SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Dashboard",
    items: [
      { label: "Overview", icon: LayoutDashboard, to: "/dashboard", view: "overview" },
      { label: "Analytics", icon: BarChart3, to: "/dashboard", view: "analytics" },
      { label: "Sync", icon: RefreshCw, to: "/dashboard", view: "sync" },
    ],
  },
  {
    heading: "Your data",
    items: [
      { label: "Daily log", icon: PenLine, to: "/log" },
      { label: "Settings", icon: Settings, to: "/settings" },
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
};

export function AppSidebar({ activeView, onNavigate }: AppSidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);

  const displayName = user?.name ?? user?.githubUsername ?? "Signed in";

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" className="flex items-center gap-2.5 px-2 pt-1" onClick={onNavigate}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Terminal className="size-4" />
        </span>
        <span className="truncate text-[15px] font-semibold tracking-tight">devhabit</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-6">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="space-y-1">
            <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
              {section.heading}
            </p>
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
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                    "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            {user?.image && <AvatarImage src={user.image} alt={displayName} />}
            <AvatarFallback className="bg-secondary text-xs font-medium">
              {initialsOf(displayName) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {user?.githubUsername && (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                @{user.githubUsername}
              </p>
            )}
          </div>
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

      <p className="flex items-center gap-1.5 px-2 pb-1 font-mono text-[11px] text-muted-foreground/70">
        <Activity className="size-3" />
        tracking since day one
      </p>
    </div>
  );
}
