import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import {
  GraduationCap,
  LogIn,
  LogOut,
  Package,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
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
  type VisibleRoleView,
} from "@/providers/role-preview-provider";
import { useProgramView } from "@/hooks/use-program-view";
import { programMeta, type Program } from "@/lib/programs";

const apps = [
  { href: "/dashboard", titleKey: "trainingTitle", icon: GraduationCap },
  { href: "/parts", titleKey: "partsTitle", icon: Package },
] as const;

const roleViewMeta: Record<VisibleRoleView, { label: string; icon: LucideIcon }> = {
  student: { label: "Student view", icon: GraduationCap },
  mentor: { label: "Mentor view", icon: Users },
  admin: { label: "Admin view", icon: ShieldCheck },
};

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

function appLabelForPath(pathname: string, program: Program) {
  const meta = programMeta[program];
  return pathname.startsWith("/parts") ? meta.partsTitle : meta.trainingTitle;
}

function allowedRoleViews(role: string | undefined): VisibleRoleView[] {
  if (role === "admin") {
    return ["student", "mentor", "admin"];
  }

  if (role === "mentor" || role === "instructor") {
    return ["student", "mentor"];
  }

  return [];
}

function selectedRoleView(roleView: RoleView, role: string | undefined): VisibleRoleView | undefined {
  const allowed = allowedRoleViews(role);

  if (allowed.includes(roleView as VisibleRoleView)) {
    return roleView as VisibleRoleView;
  }

  if (role === "admin") {
    return "admin";
  }

  if (role === "mentor" || role === "instructor") {
    return "mentor";
  }

  return undefined;
}

export function UserMenu() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const {
    activeProgramMeta,
    availablePrograms,
    canSwitchPrograms,
    selectProgram,
    selectedProgram,
    viewer,
  } = useProgramView();
  const { roleView, setRoleView } = useRolePreview();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const currentApp = appLabelForPath(location.pathname, selectedProgram);
  const roleOptions = allowedRoleViews(viewer?.profile.role);
  const selectedView = selectedRoleView(roleView, viewer?.profile.role);

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
              {activeProgramMeta[app.titleKey]}
            </Link>
          </DropdownMenuItem>
        ))}
        {canSwitchPrograms && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Program view
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={selectedProgram}
              onValueChange={(value) => selectProgram(value as Program)}
            >
              {availablePrograms.map((program) => (
                <DropdownMenuRadioItem key={program} value={program}>
                  {programMeta[program].teamNumber} view
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {roleOptions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              View as
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={selectedView}
              onValueChange={(value) => setRoleView(value as VisibleRoleView)}
            >
              {roleOptions.map((value) => {
                const item = roleViewMeta[value];

                return (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <item.icon className="size-4" />
                    {item.label}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </>
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
