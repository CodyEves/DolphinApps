import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  Award,
  ClipboardCheck,
  Database,
  Eye,
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
import { useEffectiveRole, useRolePreview } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

export function AdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const { roleView, setRoleView } = useRolePreview();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isRealAdmin = viewer?.profile.role === "admin";
  const isAdmin = effectiveRole === "admin";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="Dolphin Management"
        description="Manage accounts, rosters, training content, badges, reviews, and team operations."
        actions={
          <Badge variant={isAdmin ? "default" : "outline"}>
            {roleView !== "actual" ? `${roleView} preview` : isAdmin ? "Admin access" : "Limited view"}
          </Badge>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Sign in with an admin account to use these tools.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {isRealAdmin && (
          <Card className="mb-4">
            <CardHeader>
              <Eye className="size-5 text-primary" />
              <CardTitle>Preview another role</CardTitle>
              <CardDescription>
                Use the account menu to switch between student, mentor, and admin
                views. Your real account role is not changed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["actual", "student", "mentor", "admin"] as const).map((view) => (
                  <Button
                    key={view}
                    variant={roleView === view ? "default" : "outline"}
                    onClick={() => setRoleView(view)}
                  >
                    {view === "actual" ? "Actual role" : `${view} view`}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isAdmin ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Admin tools are restricted</CardTitle>
              <CardDescription>
                Your account can view this area, but editing requires the admin role.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <Link to="/reviews">Open reviews</Link>
                  </Button>
                </CardContent>
              </Card>
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
                  <CardTitle>Dolphin Training</CardTitle>
                  <CardDescription>
                    Manage tracks, units, lessons, quizzes, badges, and equipment.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/management/lms">Open Dolphin Training</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Award className="size-5 text-primary" />
                  <CardTitle>Badges</CardTitle>
                  <CardDescription>
                    Force awards, remove awards, and review badge records.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/management/badges">Open badges</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <ShieldCheck className="size-5 text-primary" />
                  <CardTitle>Team information</CardTitle>
                  <CardDescription>
                    Manage teams, programs, seasons, graduation groups, and roster structure.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled variant="outline">
                    Coming soon
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
                  <Button disabled variant="outline">
                    Coming soon
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Authenticated>
    </div>
  );
}




