import { create } from "zustand";

type DashboardView = "overview" | "student" | "instructor" | "admin";

type PartsRoleView = "actual" | "student" | "mentor" | "admin";
type Program = "frc_5199" | "frc_9271";

type UiState = {
  dashboardView: DashboardView;
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  selectedTrainingTrackId: string | null;
  effectiveRoleView: PartsRoleView;
  partsProgramView: Program | null;
  manufacturingStatusFilter: string;
  partsSubsystemFilter: string;
  setDashboardView: (view: DashboardView) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSelectedTrainingTrackId: (id: string | null) => void;
  setEffectiveRoleView: (view: PartsRoleView) => void;
  setPartsProgramView: (program: Program) => void;
  setManufacturingStatusFilter: (status: string) => void;
  setPartsSubsystemFilter: (subsystemId: string) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  dashboardView: "overview",
  isSidebarCollapsed: false,
  isMobileNavOpen: false,
  selectedTrainingTrackId: null,
  effectiveRoleView: "actual",
  partsProgramView: null,
  manufacturingStatusFilter: "inManufacturing",
  partsSubsystemFilter: "all",
  setDashboardView: (dashboardView) => set({ dashboardView }),
  setMobileNavOpen: (isMobileNavOpen) => set({ isMobileNavOpen }),
  setSelectedTrainingTrackId: (selectedTrainingTrackId) =>
    set({ selectedTrainingTrackId }),
  setEffectiveRoleView: (effectiveRoleView) => set({ effectiveRoleView }),
  setPartsProgramView: (partsProgramView) => set({ partsProgramView }),
  setManufacturingStatusFilter: (manufacturingStatusFilter) =>
    set({ manufacturingStatusFilter }),
  setPartsSubsystemFilter: (partsSubsystemFilter) => set({ partsSubsystemFilter }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
