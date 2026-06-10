import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Role = "student" | "instructor" | "mentor" | "guest" | "kiosk" | "admin";
export type RoleView = "actual" | "student" | "mentor" | "admin";
export type VisibleRoleView = "student" | "mentor" | "admin";

type RolePreviewContextValue = {
  roleView: RoleView;
  setRoleView: (roleView: RoleView) => void;
  isStudentPreview: boolean;
  setStudentPreview: (enabled: boolean) => void;
};

const RolePreviewContext = createContext<RolePreviewContextValue | null>(null);

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [roleView, setRoleView] = useState<RoleView>("actual");

  const value = useMemo(
    () => ({
      roleView,
      setRoleView,
      isStudentPreview: roleView === "student",
      setStudentPreview: (enabled: boolean) =>
        setRoleView(enabled ? "student" : "actual"),
    }),
    [roleView],
  );

  return (
    <RolePreviewContext.Provider value={value}>
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  const context = useContext(RolePreviewContext);

  if (!context) {
    throw new Error("useRolePreview must be used within RolePreviewProvider.");
  }

  return context;
}

export function useEffectiveRole(role: Role | undefined) {
  const { roleView } = useRolePreview();

  if (role === "admin" && roleView !== "actual") {
    return roleView;
  }

  if ((role === "mentor" || role === "instructor") && (roleView === "student" || roleView === "mentor")) {
    return roleView;
  }

  return role ?? "guest";
}
