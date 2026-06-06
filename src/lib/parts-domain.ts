export const partStatuses = [
  "draft",
  "inDesign",
  "readyForFab",
  "inManufacturing",
  "manufactured",
  "stored",
  "onRobot",
  "deprecated",
] as const;

export const orderStatuses = [
  "requested",
  "approved",
  "ordered",
  "backordered",
  "delivered",
  "canceled",
] as const;

export const priorities = ["low", "normal", "high", "critical"] as const;
export const roles = ["student", "mentor", "admin"] as const;

export type PartStatus = (typeof partStatuses)[number];
export type OrderStatus = (typeof orderStatuses)[number];
export type Priority = (typeof priorities)[number];
export type Role = "student" | "instructor" | "mentor" | "guest" | "kiosk" | "admin";

export function formatPartNumber(letter: string, sequenceNumber: number) {
  return `${letter.toUpperCase()}-${String(sequenceNumber).padStart(3, "0")}`;
}

export function nextPartNumberPreview(letter: string, nextPartNumber: number) {
  return formatPartNumber(letter, nextPartNumber);
}

export function canAdvanceOrders(role: Role) {
  return role === "mentor" || role === "instructor" || role === "admin";
}

export function canManageAdmin(role: Role) {
  return role === "admin";
}

export function partStatusLabel(status: PartStatus) {
  const labels: Record<PartStatus, string> = {
    draft: "Draft",
    inDesign: "In design",
    readyForFab: "Ready for fab",
    inManufacturing: "Manufacturing",
    manufactured: "Manufactured",
    stored: "Stored",
    onRobot: "On robot",
    deprecated: "Deprecated",
  };

  return labels[status];
}

export function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    requested: "Requested",
    approved: "Approved",
    ordered: "Ordered",
    backordered: "Backordered",
    delivered: "Delivered",
    canceled: "Canceled",
  };

  return labels[status];
}
