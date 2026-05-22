import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  LockKeyhole,
  Users,
} from "lucide-react";
import { Link } from "react-router";

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
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function accountLabel(role: string, studentGroup: string | undefined) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "mentor" || role === "instructor") {
    return "Mentor";
  }

  if (role === "guest") {
    return "Guest";
  }

  return studentGroup ?? "Student";
}

export function BadgeAwardsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const badgeAwards = useQuery(
    api.badges.listBadgeAwardsForAdmin,
    isAuthenticated && isAdmin ? {} : "skip",
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Badges"
          title="Badge awards"
          description="Loading awarded badge records."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Badges"
        title="Badge awards"
        description="See which students and accounts have earned each badge."
        actions={
          <Button asChild variant="outline">
            <Link to="/badges">
              <ArrowLeft className="size-4" />
              Back to badges
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
              Badge award records require an authenticated admin account.
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
          <div className="space-y-4">
            {badgeAwards === undefined && (
              <Card>
                <CardHeader>
                  <CardTitle>Loading awards</CardTitle>
                  <CardDescription>Fetching earned badge records.</CardDescription>
                </CardHeader>
              </Card>
            )}
            {badgeAwards?.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>No badges yet</CardTitle>
                  <CardDescription>
                    Create badges before award records can appear here.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
            {badgeAwards?.map(({ badge, awards }) => (
              <Card key={badge._id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Award className="size-5 text-primary" />
                        <CardTitle>{badge.title}</CardTitle>
                        {!badge.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <CardDescription>{badge.description}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      <Users className="size-3" />
                      {awards.length} earned
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {awards.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No one has earned this badge yet.
                    </div>
                  )}
                  {awards.map((award) => (
                    <div
                      key={award._id}
                      className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {award.displayName ?? award.email ?? "Team member"}
                          </p>
                          <Badge variant="outline">
                            {accountLabel(award.role, award.studentGroup)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {award.email ?? "No email on file"}
                        </p>
                      </div>
                      <Badge>
                        <CheckCircle2 className="size-3" />
                        Earned {formatDate(award.earnedAt)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Authenticated>
    </div>
  );
}
