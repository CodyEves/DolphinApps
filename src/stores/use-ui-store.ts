import { create } from "zustand";

type DashboardView = "overview" | "student" | "instructor" | "admin";

type PartsRoleView = "actual" | "student" | "mentor" | "admin";

type UiState = {
  dashboardView: DashboardView;
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  selectedTrainingTrackId: string | null;
  effectiveRoleView: PartsRoleView;
  manufacturingStatusFilter: string;
  partsSubsystemFilter: string;
  setDashboardView: (view: DashboardView) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSelectedTrainingTrackId: (id: string | null) => void;
  setEffectiveRoleView: (view: PartsRoleView) => void;
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
  manufacturingStatusFilter: "inManufacturing",
  partsSubsystemFilter: "all",
  setDashboardView: (dashboardView) => set({ dashboardView }),
  setMobileNavOpen: (isMobileNavOpen) => set({ isMobileNavOpen }),
  setSelectedTrainingTrackId: (selectedTrainingTrackId) =>
    set({ selectedTrainingTrackId }),
  setEffectiveRoleView: (effectiveRoleView) => set({ effectiveRoleView }),
  setManufacturingStatusFilter: (manufacturingStatusFilter) =>
    set({ manufacturingStatusFilter }),
  setPartsSubsystemFilter: (partsSubsystemFilter) => set({ partsSubsystemFilter }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
