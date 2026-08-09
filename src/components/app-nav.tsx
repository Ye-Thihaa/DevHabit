import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, Terminal, User } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// No auth system yet — this is a cosmetic placeholder, not a real session.
const MOCK_USER = { name: "Demo User", handle: "you", initials: "DU" };

const linkClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function AppNav() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <Terminal className="size-4" />
            </span>
            <span className="truncate font-semibold tracking-tight">devhabit</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/log"
              className={linkClass}
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              Daily Log
            </Link>
            <Link
              to="/dashboard"
              className={linkClass}
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Account menu"
              >
                <Avatar className="size-7">
                  <AvatarFallback className="bg-secondary text-xs font-medium">
                    {MOCK_USER.initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm">{MOCK_USER.name}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  @{MOCK_USER.handle}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="size-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/login" })}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
