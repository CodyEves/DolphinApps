import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { GraduationCap, Loader2, Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { programMeta, needsProgramOnboarding, type Program } from "@/lib/programs";
import { api } from "@convex/_generated/api";

const choices: Array<{
  program: Program;
  title: string;
  description: string;
}> = [
  {
    program: "frc_5199",
    title: "Varsity FRC Team 5199",
    description: "Use the 5199 training view by default and access both 5199 and 9271 parts.",
  },
  {
    program: "frc_9271",
    title: "Junior Varsity FRC Team 9271",
    description: "Use the 9271 training view and the 9271 robot parts tracker.",
  },
];

export function ProgramOnboarding() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const setPrimaryProgram = useMutation(api.profiles.setPrimaryProgram);
  const [savingProgram, setSavingProgram] = useState<Program | null>(null);
  const profile = viewer?.profile;

  if (!needsProgramOnboarding(profile)) {
    return null;
  }

  async function chooseProgram(program: Program) {
    setSavingProgram(program);

    try {
      await setPrimaryProgram({ program });
      toast.success(`${programMeta[program].teamNumber} program selected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save program");
    } finally {
      setSavingProgram(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <GraduationCap className="size-6 text-primary" />
          <CardTitle>Which Robot Dolphins program are you part of?</CardTitle>
          <CardDescription>
            This sets your default training view and keeps robot parts separated by team.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {choices.map((choice) => (
            <button
              key={choice.program}
              type="button"
              className="rounded-md border p-4 text-left transition-all hover:border-brand-aqua/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
              onClick={() => void chooseProgram(choice.program)}
              disabled={savingProgram !== null}
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                {savingProgram === choice.program ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Rocket className="size-5" />
                )}
              </div>
              <p className="font-semibold">{choice.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {choice.description}
              </p>
            </button>
          ))}
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
            Mentors and admins can adjust program labels later from Admin / People.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
