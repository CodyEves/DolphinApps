import { ArrowRight, Award, BookOpen, Wrench } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const focusAreas = [
  {
    title: "Learning tracks",
    description: "Organize safety, mechanical, electrical, CAD, programming, and drive team lessons.",
    icon: BookOpen,
    href: "/training",
  },
  {
    title: "Equipment sign-offs",
    description: "Give mentors a clear place to review readiness and approve shop equipment use.",
    icon: Wrench,
    href: "/equipment",
  },
  {
    title: "Badges",
    description: "Recognize completed units, safety tests, and subteam readiness milestones.",
    icon: Award,
    href: "/badges",
  },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="overflow-hidden rounded-lg border bg-card p-6 shadow-sm lg:p-8">
        <div className="space-y-6">
          <Badge variant="secondary">Team 5199 training system</Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">
              The Robot Dolphins From Outer Space
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              A team-owned training hub for safety, skills, progress, badges,
              and mentor approvals for a FIRST Robotics Competition team based
              in Orange County, California.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/dashboard">
                Open dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/training">View learning</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {focusAreas.map((area) => (
          <Link
            key={area.title}
            to={area.href}
            className="rounded-lg focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <area.icon className="size-5 text-primary" />
                <CardTitle>{area.title}</CardTitle>
                <CardDescription>{area.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
