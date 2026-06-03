import { FileCheck, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router";

import { PageHeading } from "@/components/page-heading";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const page = pages[location.pathname as keyof typeof pages] ?? pages["/management/team"];
  const Icon = page.icon;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />
      <Card>
        <CardHeader>
          <Icon className="size-5 text-primary" />
          <CardTitle>{page.cardTitle}</CardTitle>
          <CardDescription>{page.cardDescription}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
