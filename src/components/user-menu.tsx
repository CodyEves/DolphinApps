import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { LogIn, LogOut } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffectiveRole, useRolePreview } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

function initials(nameOrEmail?: string | null) {
  if (!nameOrEmail) {
    return "DL";
  }

  return nameOrEmail
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const { isStudentPreview, setStudentPreview } = useRolePreview();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canPreviewAsStudent = viewer?.profile.role === "admin";

  async function handleSignOut() {
    setStudentPreview(false);
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
              {initials(viewer?.user.name ?? viewer?.user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm md:inline">
            {viewer?.user.name ?? viewer?.user.email ?? "Team member"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">
            {viewer?.user.email ?? "Signed in"}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {isStudentPreview ? "student preview" : effectiveRole}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canPreviewAsStudent && (
          <>
            <DropdownMenuCheckboxItem
              checked={isStudentPreview}
              onCheckedChange={(checked) => setStudentPreview(checked === true)}
              onSelect={(event) => event.preventDefault()}
            >
              Student view
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
