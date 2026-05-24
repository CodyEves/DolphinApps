import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { GraduationCap, LogIn, LogOut, Package, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useEffectiveRole,
  useRolePreview,
  type RoleView,
} from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

const apps = [
  { href: "/dashboard", label: "Dolphin Training", icon: GraduationCap },
  { href: "/parts", label: "Dolphin Parts", icon: Package },
] as const;

const roleViews: Array<{ value: RoleView; label: string; icon: LucideIcon }> = [
  { value: "actual", label: "Actual role", icon: ShieldCheck },
  { value: "student", label: "Student view", icon: GraduationCap },
  { value: "mentor", label: "Mentor view", icon: Users },
  { value: "admin", label: "Admin view", icon: ShieldCheck },
];

function initials(nameOrEmail?: string | null) {
  if (!nameOrEmail) {
    return "DA";
  }

  return nameOrEmail
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function appLabelForPath(pathname: string) {
  return pathname.startsWith("/parts") ? "Dolphin Parts" : "Dolphin Training";
}

export function UserMenu() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const { roleView, setRoleView } = useRolePreview();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canPreviewRoles = viewer?.profile.role === "admin";
  const currentApp = appLabelForPath(location.pathname);

  async function handleSignOut() {
    setRoleView("actual");
    await signOut();
    toast.success("Signed out");
  }

  if (!isAuthenticated || viewer == null) {
    return (
      <Button asChild variant={isLoading ? "outline" : "default"}>
        <Link to="/auth">
          <LogIn className="size-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2">
          <Avatar className="size-7">
            <AvatarFallback>
              {initials(viewer.user.name ?? viewer.user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm md:inline">
            {viewer.user.name ?? viewer.user.email ?? "Team member"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate">
            {viewer.user.email ?? "Signed in"}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {currentApp} / {effectiveRole}
            {roleView !== "actual" ? " preview" : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch app
        </DropdownMenuLabel>
        {apps.map((app) => (
          <DropdownMenuItem key={app.href} asChild>
            <Link to={app.href}>
              <app.icon className="size-4" />
              {app.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          View as
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={roleView}
          onValueChange={(value) => setRoleView(value as RoleView)}
        >
          {roleViews.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              disabled={!canPreviewRoles && item.value !== "actual"}
            >
              <item.icon className="size-4" />
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {!canPreviewRoles && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Role previews are available to admins.
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

