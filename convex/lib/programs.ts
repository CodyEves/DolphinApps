import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

export const programValidator = v.union(
  v.literal("frc_5199"),
  v.literal("frc_9271"),
);

export type Program = "frc_5199" | "frc_9271";
export type TeamNumber = "5199" | "9271";

export function teamNumberForProgram(program: Program): TeamNumber {
  return program === "frc_9271" ? "9271" : "5199";
}

export function programForTeamNumber(teamNumber: TeamNumber): Program {
  return teamNumber === "9271" ? "frc_9271" : "frc_5199";
}

export function programForProfile(profile: Pick<Doc<"profiles">, "primaryProgram" | "studentGroup">): Program {
  if (profile.primaryProgram) {
    return profile.primaryProgram;
  }

  if (profile.studentGroup === "JV 9271" || profile.studentGroup === "9271 Student") {
    return "frc_9271";
  }

  return "frc_5199";
}

export function canAccessPartsTeam(profile: Doc<"profiles">, teamNumber: TeamNumber) {
  if (profile.role === "admin" || profile.role === "mentor" || profile.role === "instructor") {
    return true;
  }

  const program = programForProfile(profile);

  if (program === "frc_5199") {
    return true;
  }

  return teamNumber === "9271";
}

export function requirePartsTeamAccess(profile: Doc<"profiles">, teamNumber: TeamNumber) {
  if (!canAccessPartsTeam(profile, teamNumber)) {
    throw new Error("You do not have access to that robot program.");
  }
}

export function teamNumberForSeason(season: Pick<Doc<"seasons">, "teamNumber">): TeamNumber {
  return season.teamNumber ?? "5199";
}
