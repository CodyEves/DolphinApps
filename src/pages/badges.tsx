import { Award, BadgeCheck, CircuitBoard, Code2 } from "lucide-react";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const badges = [
  {
    title: "Shop Safety Complete",
    description: "Complete the base shop safety path.",
    icon: BadgeCheck,
  },
  {
    title: "Electrical Basics",
    description: "Finish intro wiring and battery safety.",
    icon: CircuitBoard,
  },
  {
    title: "Programming Basics",
    description: "Complete controls and code introduction.",
    icon: Code2,
  },
  {
    title: "Pit Crew Ready",
    description: "Complete match support and tool readiness.",
    icon: Award,
  },
];

export function BadgesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Badges"
        title="Achievements and certifications"
        description="Badges will eventually be awarded by training completion, safety tests, equipment approvals, and subteam paths."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {badges.map((badge) => (
          <Card key={badge.title}>
            <CardHeader>
              <badge.icon className="size-5 text-primary" />
              <CardTitle>{badge.title}</CardTitle>
              <CardDescription>{badge.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Planned badge</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
