import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  ArrowRight,
  Award,
  ClipboardCheck,
  Database,
  FileCheck,
  ShieldCheck,
  Users,
  BookOpen,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeading } from "@/components/page-heading";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canManageBadges,
  canOpenManagement,
  canEditLearning,
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
      title: "Learning skills",
      description: "Edit learning paths, skills, resource links, and quizzes.",
      href: "/training/manage",
      icon: BookOpen,
      visible: canEditLearning(effectiveRole),
    },
    {
      title: "Progress resets",
      description: "Remove old lesson progress, quiz attempts, and equipment sign-offs for a user.",
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
      description: "See where every student is in each learning path.",
      href: "/training/team",
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
        title="Team management"
        description="Accounts, reviews, learning content, badges, and paperwork."
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
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
              <CardTitle>Admin tools are restricted</CardTitle>
              <CardDescription>
                Sign in with an admin or mentor account to use management tools.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            {tools.map((tool, index) => {
              const Icon = tool.icon;

              return (
                <li
                  key={tool.href}
                  className={tools.length % 2 === 1 && index === tools.length - 1 ? "bg-card sm:col-span-2" : "bg-card"}
                >
                  <Link
                    to={tool.href}
                    className="group flex h-full items-start gap-4 p-5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block font-semibold">{tool.title}</span>
                      <span className="block text-sm text-muted-foreground">{tool.description}</span>
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Authenticated>
    </div>
  );
}




