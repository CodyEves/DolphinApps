import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Database, Eye, LockKeyhole, Settings2, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useEffectiveRole, useRolePreview } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

const adminAreas = [
  "Users and roles",
  "Training tracks and units",
  "Quizzes and safety tests",
  "Badges and equipment records",
];

export function AdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const { isStudentPreview, setStudentPreview } = useRolePreview();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isRealAdmin = viewer?.profile.role === "admin";
  const isAdmin = effectiveRole === "admin";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="Administration foundation"
        description="A placeholder admin area for the future management tools. Access is role-aware, with roles stored in Convex profiles."
        actions={
          <Badge variant={isAdmin ? "default" : "outline"}>
            {isStudentPreview ? "Student preview" : isAdmin ? "Admin access" : "Limited view"}
          </Badge>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Admin tooling depends on an authenticated Convex profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {isRealAdmin && (
          <Card className="mb-4">
            <CardHeader>
              <Eye className="size-5 text-primary" />
              <CardTitle>Preview student experience</CardTitle>
              <CardDescription>
                Use your admin account as a student to check what students can see
                and do. Your admin role is not changed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-start gap-3 rounded-md border p-4 text-sm">
                <Checkbox
                  checked={isStudentPreview}
                  onCheckedChange={(checked) => setStudentPreview(checked === true)}
                />
                <span>
                  <span className="block font-medium">Use student preview mode</span>
                  <span className="block text-muted-foreground">
                    Admin-only buttons, draft content, and editing tools will be hidden
                    while this is on.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        )}

        {!isAdmin ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Admin tools are restricted</CardTitle>
              <CardDescription>
                Your account can still preview the planned admin surface, but
                editing will require the admin role.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
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
                  <Link to="/admin/people">Open people</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Database className="size-5 text-primary" />
                <CardTitle>LMS content</CardTitle>
                <CardDescription>
                  Manage tracks, units, lessons, quizzes, badges, and equipment.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Convex tables are already drafted for these records.
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mt-4">
          <CardHeader>
            <Settings2 className="size-5 text-primary" />
            <CardTitle>Planned admin sections</CardTitle>
            <CardDescription>
              These are intentionally placeholders in the foundation version.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {adminAreas.map((area) => (
              <p key={area} className="rounded-md border p-3">
                {area}
              </p>
            ))}
          </CardContent>
        </Card>
      </Authenticated>
    </div>
  );
}
