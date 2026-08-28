export type AppRole =
  | "student"
  | "instructor"
  | "mentor"
  | "guest"
  | "kiosk"
  | "admin"
  | "lead";

export function canReviewLearning(role: string) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

export function canManageBadges(role: string) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

export function canOpenManagement(role: string) {
  return canManageBadges(role);
}

export function isAdminRole(role: string) {
  return role === "admin";
}

export function canManageTrainingContent(role: string) {
  return role === "admin" || role === "lead";
}

export function canManageAttendanceEvents(role: string) {
  return role === "admin" || role === "mentor" || role === "instructor" || role === "lead";
}
