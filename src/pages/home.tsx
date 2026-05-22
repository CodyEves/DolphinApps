import { ArrowRight, Award, BookOpen, ShieldCheck, Wrench } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const focusAreas = [
  {
    title: "Training tracks",
    description: "Organize safety, mechanical, electrical, CAD, programming, and drive team lessons.",
    icon: BookOpen,
  },
  {
    title: "Equipment sign-offs",
    description: "Give mentors a clear place to review readiness and approve shop equipment use.",
    icon: Wrench,
  },
  {
    title: "Badges",
    description: "Recognize completed units, safety tests, and subteam readiness milestones.",
    icon: Award,
  },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="grid gap-6 rounded-lg border bg-card p-6 shadow-sm lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
        <div className="space-y-6">
          <Badge variant="secondary">FIRST Robotics Competition LMS</Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">
              DolphinLMS
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              A team-owned training hub for safety, skills, progress, badges,
              and mentor approvals. This first version is the foundation your
              team can keep building on.
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
              <Link to="/training">View training</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 rounded-lg border bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Foundation status</p>
              <p className="text-xs text-muted-foreground">Ready for LMS features</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-semibold">Routes</p>
              <p className="text-muted-foreground">React Router</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-semibold">Data</p>
              <p className="text-muted-foreground">Convex</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-semibold">Theme</p>
              <p className="text-muted-foreground">Light/dark/system</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-semibold">Auth</p>
              <p className="text-muted-foreground">Email/password</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {focusAreas.map((area) => (
          <Card key={area.title}>
            <CardHeader>
              <area.icon className="size-5 text-primary" />
              <CardTitle>{area.title}</CardTitle>
              <CardDescription>{area.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>What this version proves</CardTitle>
          <CardDescription>
            The app is intentionally small, but the wiring is the important part.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <p>Vite, React, TypeScript, and Tailwind render correctly.</p>
          <p>shadcn/ui components and Sonner are available.</p>
          <p>Convex is the source of truth for app data.</p>
          <p>Zustand is limited to temporary interface state.</p>
        </CardContent>
      </Card>
    </div>
  );
}
