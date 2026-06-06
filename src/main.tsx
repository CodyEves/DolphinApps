import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";

import { AppProviders } from "@/providers/app-providers";
import { RootLayout } from "@/routes/root-layout";
import "./index.css";

const AdminBadgesPage = lazy(() =>
  import("@/pages/admin-badges").then((module) => ({ default: module.AdminBadgesPage })),
);
const AdminLmsPage = lazy(() =>
  import("@/pages/admin-lms").then((module) => ({ default: module.AdminLmsPage })),
);
const AdminPeoplePage = lazy(() =>
  import("@/pages/admin-people").then((module) => ({ default: module.AdminPeoplePage })),
);
const AdminPage = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminPage })),
);
const AuthPage = lazy(() =>
  import("@/pages/auth").then((module) => ({ default: module.AuthPage })),
);
const BadgeAwardsPage = lazy(() =>
  import("@/pages/badge-awards").then((module) => ({ default: module.BadgeAwardsPage })),
);
const BadgesPage = lazy(() =>
  import("@/pages/badges").then((module) => ({ default: module.BadgesPage })),
);
const BadgeEditorPage = lazy(() =>
  import("@/pages/badge-editor").then((module) => ({ default: module.BadgeEditorPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardPage })),
);
const EquipmentDetailPage = lazy(() =>
  import("@/pages/equipment-detail").then((module) => ({
    default: module.EquipmentDetailPage,
  })),
);
const EquipmentPage = lazy(() =>
  import("@/pages/equipment").then((module) => ({ default: module.EquipmentPage })),
);
const HomePage = lazy(() =>
  import("@/pages/home").then((module) => ({ default: module.HomePage })),
);
const LearningTrackEditorPage = lazy(() =>
  import("@/pages/learning-track-editor").then((module) => ({
    default: module.LearningTrackEditorPage,
  })),
);
const LessonEditorPage = lazy(() =>
  import("@/pages/lesson-editor").then((module) => ({ default: module.LessonEditorPage })),
);
const LessonViewPage = lazy(() =>
  import("@/pages/lesson-view").then((module) => ({ default: module.LessonViewPage })),
);
const ManagementPlaceholderPage = lazy(() =>
  import("@/pages/management-placeholder").then((module) => ({
    default: module.ManagementPlaceholderPage,
  })),
);
const ReviewsPage = lazy(() =>
  import("@/pages/reviews").then((module) => ({ default: module.ReviewsPage })),
);
const PartsDashboardPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.DashboardRoute })),
);
const PartsListPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.PartsRoute })),
);
const PartGeneratorPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.GeneratePartRoute })),
);
const PartDetailPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.PartDetailRoute })),
);
const PartsBomPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.BomRoute })),
);
const PartsManufacturingPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.ManufacturingRoute })),
);
const PartsTransmissionsPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.TransmissionsRoute })),
);
const PartsOrdersPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.OrdersRoute })),
);
const PartsAdminPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.AdminRoute })),
);
const ProfilePage = lazy(() =>
  import("@/pages/profile").then((module) => ({ default: module.ProfilePage })),
);
const TrainingPage = lazy(() =>
  import("@/pages/training").then((module) => ({ default: module.TrainingPage })),
);
const TrainingTrackPage = lazy(() =>
  import("@/pages/training-track").then((module) => ({
    default: module.TrainingTrackPage,
  })),
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "training", element: <TrainingPage /> },
      { path: "training/tracks/new", element: <LearningTrackEditorPage /> },
      { path: "training/tracks/:trackId", element: <TrainingTrackPage /> },
      { path: "training/tracks/:trackId/edit", element: <LearningTrackEditorPage /> },
      { path: "training/lessons/:lessonId/edit", element: <LessonEditorPage /> },
      { path: "training/lessons/:lessonId", element: <LessonViewPage /> },
      { path: "equipment", element: <EquipmentPage /> },
      { path: "parts", element: <PartsListPage /> },
      { path: "parts/dashboard", element: <PartsDashboardPage /> },
      { path: "parts/new", element: <PartGeneratorPage /> },
      { path: "parts/bom", element: <PartsBomPage /> },
      { path: "parts/manufacturing", element: <PartsManufacturingPage /> },
      { path: "parts/transmissions", element: <PartsTransmissionsPage /> },
      { path: "parts/orders", element: <PartsOrdersPage /> },
      { path: "parts/admin", element: <PartsAdminPage /> },
      { path: "parts/:partId", element: <PartDetailPage /> },
      { path: "equipment/:equipmentId", element: <EquipmentDetailPage /> },
      { path: "reviews", element: <ReviewsPage /> },
      { path: "badges", element: <BadgesPage /> },
      { path: "badges/awards", element: <BadgeAwardsPage /> },
      { path: "badges/new", element: <BadgeEditorPage /> },
      { path: "badges/:badgeId/edit", element: <BadgeEditorPage /> },
      { path: "management", element: <AdminPage /> },
      { path: "management/badges", element: <AdminBadgesPage /> },
      { path: "management/lms", element: <AdminLmsPage /> },
      { path: "management/paperwork", element: <ManagementPlaceholderPage /> },
      { path: "management/people", element: <AdminPeoplePage /> },
      { path: "management/parts", element: <PartsAdminPage /> },
      { path: "management/reviews", element: <ReviewsPage /> },
      { path: "management/team", element: <ManagementPlaceholderPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "admin/badges", element: <AdminBadgesPage /> },
      { path: "admin/lms", element: <AdminLmsPage /> },
      { path: "admin/people", element: <AdminPeoplePage /> },
      { path: "auth", element: <AuthPage /> },
      { path: "auth/setup", element: <AuthPage /> },
      { path: "auth/reset", element: <AuthPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);


