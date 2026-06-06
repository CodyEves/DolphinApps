import type { Doc } from "@convex/_generated/dataModel";

export const programs = ["frc_5199", "frc_9271"] as const;
export type Program = (typeof programs)[number];
export type TeamNumber = "5199" | "9271";

export const programMeta: Record<
  Program,
  {
    teamNumber: TeamNumber;
    studentLabel: string;
    trainingTitle: string;
    trainingDescription: string;
    partsTitle: string;
    partsDescription: string;
  }
> = {
  frc_5199: {
    teamNumber: "5199",
    studentLabel: "5199 Varsity",
    trainingTitle: "Learning",
    trainingDescription: "Lessons, safety, badges, and sign-offs",
    partsTitle: "Parts",
    partsDescription: "Parts, BOM, manufacturing, transmissions, and orders",
  },
  frc_9271: {
    teamNumber: "9271",
    studentLabel: "9271 Junior Varsity",
    trainingTitle: "Learning",
    trainingDescription: "Lessons, safety, badges, and sign-offs",
    partsTitle: "Parts",
    partsDescription: "Parts, BOM, manufacturing, transmissions, and orders",
  },
};

type ProfileLike =
  | Pick<Doc<"profiles">, "role" | "primaryProgram" | "studentGroup">
  | null
  | undefined;

export function programForProfile(profile: ProfileLike): Program {
  if (profile?.primaryProgram) {
    return profile.primaryProgram;
  }

  if (profile?.studentGroup === "JV 9271" || profile?.studentGroup === "9271 Student") {
    return "frc_9271";
  }

  return "frc_5199";
}

export function teamNumberForProgram(program: Program): TeamNumber {
  return programMeta[program].teamNumber;
}

export function programForTeamNumber(teamNumber: TeamNumber): Program {
  return teamNumber === "9271" ? "frc_9271" : "frc_5199";
}

export function canAccessPartsProgram(profile: ProfileLike, program: Program) {
  if (!profile) {
    return false;
  }

  if (profile.role === "admin" || profile.role === "mentor" || profile.role === "instructor") {
    return true;
  }

  const primaryProgram = programForProfile(profile);

  if (primaryProgram === "frc_5199") {
    return true;
  }

  return program === "frc_9271";
}

export function availablePartsPrograms(profile: ProfileLike): Program[] {
  return programs.filter((program) => canAccessPartsProgram(profile, program));
}

export function canSwitchProgramView(profile: ProfileLike) {
  return profile?.role === "admin";
}

export function availableProgramViews(profile: ProfileLike): Program[] {
  return canSwitchProgramView(profile) ? [...programs] : [programForProfile(profile)];
}

export function programForView(profile: ProfileLike, programView: Program | null): Program {
  const availablePrograms = availableProgramViews(profile);

  if (programView && availablePrograms.includes(programView)) {
    return programView;
  }

  return programForProfile(profile);
}

export function defaultPartsProgram(profile: ProfileLike): Program {
  return programForProfile(profile) === "frc_9271" ? "frc_9271" : "frc_5199";
}

export function needsProgramOnboarding(profile: ProfileLike) {
  if (!profile || profile.role !== "student") {
    return false;
  }

  return !profile.primaryProgram && !profile.studentGroup;
}
