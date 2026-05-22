import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Award, ClipboardCheck, GraduationCap, ShieldCheck, Users } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/stores/use-ui-store";
import { api } from "@convex/_generated/api";

const studentCards = [
  "Continue training lessons",
  "Review quiz attempts",
  "Track earned badges",
  "Check equipment sign-off status",
];

const instructorCards = [
  "Review student progress",
  "Approve equipment sign-offs",
  "Check safety readiness",
  "Spot students who need help",
];

const adminCards = [
  "Manage training tracks",
  "Plan quizzes and tests",
  "Maintain equipment records",
  "Update roles and permissions",
];

function CapabilityCard({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof GraduationCap;
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="size-5 text-primary" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const dashboardView = useUiStore((state) => state.dashboardView);
  const setDashboardView = useUiStore((state) => state.setDashboardView);
  const role = viewer?.profile.role ?? "student";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Dashboard"
        title="Team training overview"
        description="Role-aware placeholders for the student, instructor, and admin workflows this LMS will grow into."
        actions={<Badge variant="outline">Current role: {role}</Badge>}
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to see your dashboard</CardTitle>
            <CardDescription>
              Email/password authentication is wired through Convex Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/auth">Sign in or create account</Link>
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <Card>
            <CardHeader>
              <CardTitle>My progress</CardTitle>
              <CardDescription>
                Sample student progress summary for the first demo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Shop safety path</span>
                  <span className="font-medium">35%</span>
                </div>
                <Progress value={35} />
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span>Lessons completed</span>
                  <Badge variant="secondary">2 of 8</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span>Equipment approvals</span>
                  <Badge variant="outline">1 pending</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span>Badges earned</span>
                  <Badge>1</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role workspace</CardTitle>
              <CardDescription>
                Persisted roles come from the Convex profile table.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={dashboardView} onValueChange={(value) => setDashboardView(value as typeof dashboardView)}>
                <TabsList className="mb-4 flex w-full flex-wrap justify-start">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="student">Student</TabsTrigger>
                  <TabsTrigger value="instructor">Instructor</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="grid gap-4 md:grid-cols-3">
                  <CapabilityCard title="Students" items={studentCards} icon={GraduationCap} />
                  <CapabilityCard title="Instructors" items={instructorCards} icon={ClipboardCheck} />
                  <CapabilityCard title="Admins" items={adminCards} icon={Users} />
                </TabsContent>
                <TabsContent value="student">
                  <CapabilityCard title="Student tools" items={studentCards} icon={GraduationCap} />
                </TabsContent>
                <TabsContent value="instructor">
                  <CapabilityCard title="Instructor tools" items={instructorCards} icon={ShieldCheck} />
                </TabsContent>
                <TabsContent value="admin">
                  <CapabilityCard title="Admin tools" items={adminCards} icon={Award} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </Authenticated>
    </div>
  );
}
