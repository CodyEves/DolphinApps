import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Role = "student" | "instructor" | "mentor" | "guest" | "admin";

type RolePreviewContextValue = {
  isStudentPreview: boolean;
  setStudentPreview: (enabled: boolean) => void;
};

const storageKey = "dolphin-lms-student-preview";
const RolePreviewContext = createContext<RolePreviewContextValue | null>(null);

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [isStudentPreview, setIsStudentPreview] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(storageKey) === "true";
  });

  useEffect(() => {
    if (isStudentPreview) {
      window.localStorage.setItem(storageKey, "true");
      return;
    }

    window.localStorage.removeItem(storageKey);
  }, [isStudentPreview]);

  const value = useMemo(
    () => ({
      isStudentPreview,
      setStudentPreview: setIsStudentPreview,
    }),
    [isStudentPreview],
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
  const { isStudentPreview } = useRolePreview();

  if (role === "admin" && isStudentPreview) {
    return "student";
  }

  return role ?? "student";
}
