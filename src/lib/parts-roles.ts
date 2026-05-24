import type { Role } from "@/lib/parts-domain";

export type EffectiveRoleView = "actual" | "student" | "mentor" | "admin";

export function resolveEffectiveRole(actualRole: Role, roleView: EffectiveRoleView) {
  if (actualRole !== "admin") {
    return actualRole;
  }

  return roleView === "actual" ? actualRole : roleView;
}
