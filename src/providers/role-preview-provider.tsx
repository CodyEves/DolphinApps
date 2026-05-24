import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Role = "student" | "instructor" | "mentor" | "guest" | "admin";
export type RoleView = "actual" | "student" | "mentor" | "admin";

type RolePreviewContextValue = {
  roleView: RoleView;
  setRoleView: (roleView: RoleView) => void;
  isStudentPreview: boolean;
  setStudentPreview: (enabled: boolean) => void;
};

const storageKey = "dolphin-apps-role-view";
const legacyStudentPreviewKey = "dolphin-lms-student-preview";
const RolePreviewContext = createContext<RolePreviewContextValue | null>(null);

function initialRoleView(): RoleView {
  if (typeof window === "undefined") {
    return "actual";
  }

  const stored = window.localStorage.getItem(storageKey);
  if (stored === "student" || stored === "mentor" || stored === "admin") {
    return stored;
  }

  return window.localStorage.getItem(legacyStudentPreviewKey) === "true"
    ? "student"
    : "actual";
}

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [roleView, setRoleView] = useState<RoleView>(initialRoleView);

  useEffect(() => {
    window.localStorage.removeItem(legacyStudentPreviewKey);

    if (roleView === "actual") {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, roleView);
  }, [roleView]);

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

  return role ?? "student";
}
