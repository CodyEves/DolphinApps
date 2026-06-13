import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  Award,
  ClipboardCheck,
  Database,
  FileCheck,
  LockKeyhole,
  ShieldCheck,
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
import {
  canManageBadges,
  canOpenManagement,
  canReviewLearning,
  isAdminRole,
} from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

export function AdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = isAdminRole(effectiveRole);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const canReview = canReviewLearning(effectiveRole);
  const canManageBadgeRecords = canManageBadges(effectiveRole);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="Management"
        description="Manage accounts, rosters, training content, badges, reviews, and team operations."
        actions={
          <Badge variant={isAdmin ? "default" : "outline"}>
            {isAdmin ? "Admin access" : hasManagementAccess ? "Mentor access" : "Limited view"}
          </Badge>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Sign in with an admin or mentor account to use these tools.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!hasManagementAccess ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Admin tools are restricted</CardTitle>
              <CardDescription>
                Sign in with an admin or mentor account to use management tools.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {canReview && (
                <Card>
                  <CardHeader>
                    <ClipboardCheck className="size-5 text-primary" />
                    <CardTitle>Reviews</CardTitle>
                    <CardDescription>
                      Review uploaded lesson files and hands-on equipment checks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline">
                      <Link to="/management/reviews">Open reviews</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
              {isAdmin && (
                <>
                  <Card>
                    <CardHeader>
                      <Users className="size-5 text-primary" />
                      <CardTitle>People</CardTitle>
                      <CardDescription>
                        Manage users, roles, graduation years, and active status.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild variant="outline">
                        <Link to="/management/people">Open people</Link>
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <Database className="size-5 text-primary" />
                      <CardTitle>Learning Admin</CardTitle>
                      <CardDescription>
                        Manage tracks, units, lessons, quizzes, badges, and equipment.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild variant="outline">
                        <Link to="/management/lms">Open learning admin</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
              {canManageBadgeRecords && (
                <Card>
                  <CardHeader>
                    <Award className="size-5 text-primary" />
                    <CardTitle>Badges</CardTitle>
                    <CardDescription>
                      Create badge rules, force awards, remove awards, and review badge records.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline">
                      <Link to="/management/badges">Open badges</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <ShieldCheck className="size-5 text-primary" />
                  <CardTitle>Team progress</CardTitle>
                  <CardDescription>
                    Track student learning status, missing assignments, and next actions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/management/team">Open team progress</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <FileCheck className="size-5 text-primary" />
                  <CardTitle>Paperwork</CardTitle>
                  <CardDescription>
                    Track signed forms, consent records, deadlines, and missing paperwork.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/management/paperwork">Open paperwork</Link>
                  </Button>
                </CardContent>
              </Card>
              {isAdmin && (
                <Card>
                  <CardHeader>
                    <ShieldCheck className="size-5 text-primary" />
                    <CardTitle>Parts Admin</CardTitle>
                    <CardDescription>
                      Manage robot build seasons, subsystems, catalog options, and parts configuration.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline">
                      <Link to="/management/parts">Open parts admin</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </Authenticated>
    </div>
  );
}




