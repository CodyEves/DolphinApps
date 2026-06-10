import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import {
  GraduationCap,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { api } from "@convex/_generated/api";

const roleViewMeta: Record<VisibleRoleView, { label: string; icon: LucideIcon }> = {
  student: { label: "Student view", icon: GraduationCap },
  mentor: { label: "Mentor view", icon: Users },
  admin: { label: "Admin view", icon: ShieldCheck },
};

const profileRefreshTimeoutMs = 12_000;

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
  const { viewer } = useProgramView();
  const { roleView, setRoleView } = useRolePreview();
  const syncMyProvisionedProfile = useMutation(api.access.syncMyProvisionedProfile);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const roleOptions = allowedRoleViews(viewer?.profile.role);
  const selectedView = selectedRoleView(roleView, viewer?.profile.role);
  const isKiosk = viewer?.profile.role === "kiosk";

  async function handleSignOut() {
    setRoleView("actual");
    await signOut();
    toast.success("Signed out");
  }

  async function handleRefreshProfile() {
    setIsRefreshingProfile(true);

    try {
      const synced = await Promise.race([
        syncMyProvisionedProfile({}),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Profile refresh timed out. Restart Convex and try again.")),
            profileRefreshTimeoutMs,
          );
        }),
      ]);
      setRoleView("actual");
      toast.success(
        synced.role === "admin"
          ? "Admin access refreshed"
          : "Team profile refreshed",
      );
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh team profile");
    } finally {
      setIsRefreshingProfile(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <Button asChild variant={isLoading ? "outline" : "default"}>
        <Link to="/auth">
          <LogIn className="size-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  if (viewer === undefined) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label="Open profile menu"
          >
            <Avatar className="size-7">
              <AvatarFallback>
                <UserRound className="size-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <span className="block truncate">
              Loading profile
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Checking your account
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void handleRefreshProfile()}
            disabled={isRefreshingProfile}
          >
            <RefreshCw className="size-4" />
            {isRefreshingProfile ? "Refreshing..." : "Refresh team profile"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} variant="destructive">
            <LogOut className="size-4" />
            Sign out and reset
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (viewer === null) {
    return (
      <Button asChild variant="default">
        <Link to="/auth">
          <LogIn className="size-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  const displayName = viewer.profile.displayName ?? viewer.user.name ?? "Team member";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Open profile menu">
          <Avatar className="size-7">
            {viewer.avatarUrl && (
              <AvatarImage src={viewer.avatarUrl} alt="" />
            )}
            <AvatarFallback>
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate">
            {displayName}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {effectiveRole}
            {roleView !== "actual" ? " preview" : ""}
          </span>
        </DropdownMenuLabel>
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
        {!isKiosk && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <UserRound className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void handleRefreshProfile()}
          disabled={isRefreshingProfile}
        >
          <RefreshCw className="size-4" />
          {isRefreshingProfile ? "Refreshing..." : "Refresh team profile"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
