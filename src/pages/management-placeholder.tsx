import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { FileCheck, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router";

import { PageHeading } from "@/components/page-heading";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canOpenManagement } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import { ListSkeleton } from "@/components/ui/skeleton";

const pages = {
  "/management/team": {
    eyebrow: "Management",
    title: "Team Information",
    description: "Plan and manage teams, programs, seasons, graduation groups, and roster structure.",
    cardTitle: "Team information tools are next",
    cardDescription:
      "This area will become the home for FRC 5199 and 9271 program details, seasons, class-year movement, and roster organization.",
    icon: ShieldCheck,
  },
  "/management/paperwork": {
    eyebrow: "Management",
    title: "Paperwork",
    description: "Track signed forms, consent records, deadlines, and missing paperwork.",
    cardTitle: "Paperwork tracking is next",
    cardDescription:
      "This area will track required forms, completion status, reminders, and roster-level paperwork readiness.",
    icon: FileCheck,
  },
};

export function ManagementPlaceholderPage() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const page = pages[location.pathname as keyof typeof pages] ?? pages["/management/team"];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title={page.title}
        description={page.description}
      />
      {isLoading ? (
        <ListSkeleton label="Loading management access" />
      ) : !isAuthenticated || !hasManagementAccess ? (
        <Card>
          <CardHeader>
            <CardTitle>Management access required</CardTitle>
            <CardDescription>
              Sign in with an admin or mentor account to use this area.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{page.cardTitle}</CardTitle>
            <CardDescription>{page.cardDescription}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
