import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppSidebar, type DashboardView } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// One layout for every signed-in page: a fixed sidebar rail on desktop, the
// same nav in a sheet on mobile, and a sticky header that carries the page
// title so each route stops repeating its own <h1> block.

type AppShellProps = {
  title: string;
  description?: string | undefined;
  /** Highlights the matching sidebar entry when this is the dashboard. */
  activeView?: DashboardView | undefined;
  /** Right-hand slot in the header, e.g. a range picker. */
  actions?: ReactNode;
  children: ReactNode;
};

const COLLAPSE_KEY = "devhabit:sidebar-collapsed";

export function AppShell({
  title,
  description,
  activeView,
  actions,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Starts expanded on both server and client, then reads the saved choice
  // after mount — reading localStorage in the initializer would render a
  // different tree than the server sent and break hydration.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div
      className={cn(
        "min-h-screen lg:grid",
        collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-card/40 lg:block">
        <AppSidebar
          activeView={activeView}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[264px] p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <AppSidebar activeView={activeView} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">{title}</h1>

            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {description && (
            <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{description}</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
