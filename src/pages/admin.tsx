import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  ArrowRight,
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
import {
  Card,
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

const accentClasses = ["text-brand-blue", "text-brand-aqua", "text-brand-orange", "text-primary"];

export function AdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = isAdminRole(effectiveRole);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const canReview = canReviewLearning(effectiveRole);
  const canManageBadgeRecords = canManageBadges(effectiveRole);
  const tools = [
    {
      title: "Reviews",
      description: "Review uploaded lesson files and hands-on equipment checks.",
      href: "/management/reviews",
      icon: ClipboardCheck,
      visible: canReview,
    },
    {
      title: "People",
      description: "Manage users, roles, graduation years, and active status.",
      href: "/management/people",
      icon: Users,
      visible: isAdmin,
    },
    {
      title: "Learning Admin",
      description: "Manage tracks, units, lessons, quizzes, badges, and equipment.",
      href: "/management/lms",
      icon: Database,
      visible: isAdmin,
    },
    {
      title: "Badges",
      description: "Create badge rules, force awards, remove awards, and review badge records.",
      href: "/management/badges",
      icon: Award,
      visible: canManageBadgeRecords,
    },
    {
      title: "Team progress",
      description: "Track student learning status, missing assignments, and next actions.",
      href: "/management/team",
      icon: ShieldCheck,
      visible: true,
    },
    {
      title: "Paperwork",
      description: "Track signed forms, consent records, deadlines, and missing paperwork.",
      href: "/management/paperwork",
      icon: FileCheck,
      visible: true,
    },
    {
      title: "Parts Admin",
      description: "Manage robot build seasons, subsystems, catalog options, and parts configuration.",
      href: "/management/parts",
      icon: ShieldCheck,
      visible: isAdmin,
    },
  ].filter((tool) => tool.visible);

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
          <div className="divide-y divide-border/70">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              const accent = accentClasses[index % accentClasses.length];

              return (
                <Link
                  key={tool.href}
                  to={tool.href}
                  className="group flex items-center gap-5 py-6 outline-none transition-colors first:pt-2 hover:bg-accent/50 focus-visible:bg-accent/50 sm:gap-7 sm:px-2"
                >
                  <span className="font-heading w-9 shrink-0 text-2xl font-semibold text-muted-foreground/30 sm:w-11 sm:text-3xl">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Icon className={`size-6 shrink-0 sm:size-7 ${accent}`} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      {tool.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                      {tool.description}
                    </p>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        )}
      </Authenticated>
    </div>
  );
}




