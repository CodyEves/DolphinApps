import { useQuery } from "convex/react";
import { Award, ClipboardCheck, Database, Eye, LockKeyhole, Users } from "lucide-react";
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

export function AdminPage() {
  const viewer = useQuery(api.profiles.viewer, {});
  const { isStudentPreview, setStudentPreview } = useRolePreview();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isRealAdmin = viewer?.profile.role === "admin";
  const isAdmin = effectiveRole === "admin";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="Administration foundation"
        description="Manage people, training content, equipment, badges, and approvals."
        actions={
          <Badge variant={isAdmin ? "default" : "outline"}>
            {isStudentPreview ? "Student preview" : isAdmin ? "Admin access" : "Limited view"}
          </Badge>
        }
      />

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
                Your account can view this area, but editing requires the admin role.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    <Link to="/admin/people">Open people</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Database className="size-5 text-primary" />
                  <CardTitle>LMS management</CardTitle>
                  <CardDescription>
                    Manage tracks, units, lessons, quizzes, badges, and equipment.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to="/admin/lms">Open LMS management</Link>
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
                    <Link to="/admin/badges">Open badges</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  );
}
