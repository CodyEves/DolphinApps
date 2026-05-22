import { create } from "zustand";

type DashboardView = "overview" | "student" | "instructor" | "admin";

type UiState = {
  dashboardView: DashboardView;
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  selectedTrainingTrackId: string | null;
  setDashboardView: (view: DashboardView) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSelectedTrainingTrackId: (id: string | null) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  dashboardView: "overview",
  isSidebarCollapsed: false,
  isMobileNavOpen: false,
  selectedTrainingTrackId: null,
  setDashboardView: (dashboardView) => set({ dashboardView }),
  setMobileNavOpen: (isMobileNavOpen) => set({ isMobileNavOpen }),
  setSelectedTrainingTrackId: (selectedTrainingTrackId) =>
    set({ selectedTrainingTrackId }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
