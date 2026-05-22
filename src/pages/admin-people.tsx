import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { ArrowLeft, LockKeyhole, Save, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type AccountLabel = "varsity_5199" | "jv_9271" | "mentor" | "guest" | "admin";

const accountLabelText: Record<AccountLabel, string> = {
  varsity_5199: "5199 Student",
  jv_9271: "9271 Student",
  mentor: "Mentor",
  guest: "Guest",
  admin: "Admin",
};

export function AdminPeoplePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const users = useQuery(
    api.profiles.listUsersForAdmin,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const setAccountLabel = useMutation(api.profiles.setAccountLabel);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  async function handleSetAccountLabel(
    userId: Id<"users">,
    accountLabel: AccountLabel,
  ) {
    setSavingUserId(userId);

    try {
      await setAccountLabel({ userId, accountLabel });
      toast.success("User label updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user");
    } finally {
      setSavingUserId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Admin"
          title="People"
          description="Loading user management."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="People"
        description="Manage account labels for 5199 students, 9271 students, mentors, guests, and admins."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin">
              <ArrowLeft className="size-4" />
              Back to admin
            </Link>
          </Button>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              User management requires an authenticated admin account.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!isAdmin ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Admin access required</CardTitle>
              <CardDescription>
                Turn off student preview or sign in with an admin account.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <Users className="size-5 text-primary" />
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Assign each account to the correct team or access group.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {users === undefined && (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              )}
              {users?.length === 0 && (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No user profiles exist yet.
                </div>
              )}
              {users?.map((profile) => (
                <div
                  key={profile._id}
                  className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_260px_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {profile.displayName ??
                          profile.user?.name ??
                          profile.email ??
                          profile.user?.email ??
                          "Team member"}
                      </p>
                      <Badge variant="outline">
                        {accountLabelText[profile.accountLabel as AccountLabel]}
                      </Badge>
                      {profile.status === "inactive" && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.email ?? profile.user?.email ?? "No email on file"}
                    </p>
                  </div>
                  <Select
                    value={profile.accountLabel}
                    onValueChange={(value: AccountLabel) =>
                      void handleSetAccountLabel(profile.userId, value)
                    }
                    disabled={savingUserId === profile.userId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="varsity_5199">5199 Student</SelectItem>
                      <SelectItem value="jv_9271">9271 Student</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="guest">Guest</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-end text-sm text-muted-foreground">
                    {savingUserId === profile.userId ? (
                      <span className="inline-flex items-center gap-2">
                        <Save className="size-4" />
                        Saving
                      </span>
                    ) : (
                      <span>{profile.studentGroup ?? profile.role}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </Authenticated>
    </div>
  );
}
