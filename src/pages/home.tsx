import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Clock,
  GraduationCap,
  Grid3X3,
  Package,
  Settings,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProgramView } from "@/hooks/use-program-view";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

export function HomePage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const { activeProgramMeta } = useProgramView();
  const apps = [
    {
      title: activeProgramMeta.trainingTitle,
      description: "Lessons, safety training, equipment sign-offs, badges, and mentor reviews.",
      href: "/dashboard",
      icon: GraduationCap,
      label: "Courses",
      enabled: true,
    },
    {
      title: activeProgramMeta.partsTitle,
      description: "Robot parts, BOMs, manufacturing status, transmissions, and order requests.",
      href: "/parts",
      icon: Package,
      label: "Build system",
      enabled: true,
    },
    {
      title: "Shop Attendance",
      description: "Slack check-ins, rotating shop codes, live roster, hour reports, and mentor review.",
      href: "/shop",
      icon: Clock,
      label: "Hours",
      enabled: true,
    },
    {
      title: "Management",
      description: "Accounts, rosters, access, LMS content, badges, team information, and future paperwork tools.",
      href: "/management",
      icon: Settings,
      label: "Admin app",
      adminOnly: true,
    },
  ].filter((app) => !app.adminOnly || isAdmin);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col justify-center space-y-8">
      <section className="space-y-4">
        <Badge variant="secondary" className="w-fit">
          <Grid3X3 className="size-3.5" />
          Apps
        </Badge>
        <div className="space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-normal text-brand-navy dark:text-foreground sm:text-4xl">
            Choose an app
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Open learning, parts, management, and other tools from one place.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {apps.map((app) => {
          const Icon = app.icon;

          return (
            <Link
              key={app.title}
              to={app.href}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-brand-aqua/50 hover:bg-accent hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </div>
                <Badge variant="outline" className="w-fit">{app.label}</Badge>
                <CardTitle>{app.title}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Open app
                  <ArrowRight className="size-4" />
                </span>
              </CardContent>
            </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
