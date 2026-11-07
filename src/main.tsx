import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter, useParams } from "react-router";

import { AppProviders } from "@/providers/app-providers";
import { RouteErrorPage } from "@/routes/route-error-page";
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
const BatteriesPage = lazy(() =>
  import("@/pages/batteries").then((module) => ({ default: module.BatteriesPage })),
);
const BatteryDetailPage = lazy(() =>
  import("@/pages/batteries").then((module) => ({ default: module.BatteryDetailPage })),
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
const ToolsPage = lazy(() =>
  import("@/pages/tools").then((module) => ({ default: module.ToolsPage })),
);
const ToolSignOffsPage = lazy(() =>
  import("@/pages/tool-sign-offs").then((module) => ({ default: module.ToolSignOffsPage })),
);
const ToolReadersPage = lazy(() =>
  import("@/pages/tool-readers").then((module) => ({ default: module.ToolReadersPage })),
);
const SopEditorPage = lazy(() =>
  import("@/pages/sop-editor").then((module) => ({ default: module.SopEditorPage })),
);
const HomePage = lazy(() =>
  import("@/pages/home").then((module) => ({ default: module.HomePage })),
);
const LearningHomePage = lazy(() =>
  import("@/pages/learning-home").then((module) => ({ default: module.LearningHomePage })),
);
const LearningManagePage = lazy(() =>
  import("@/pages/learning-manage").then((module) => ({ default: module.LearningManagePage })),
);
const LearningSignoffsPage = lazy(() =>
  import("@/pages/learning-signoffs").then((module) => ({ default: module.LearningSignoffsPage })),
);
const LearningSkillPage = lazy(() =>
  import("@/pages/learning-skill").then((module) => ({ default: module.LearningSkillPage })),
);
const LearningTeamPage = lazy(() =>
  import("@/pages/learning-team").then((module) => ({ default: module.LearningTeamPage })),
);
const ManagementPlaceholderPage = lazy(() =>
  import("@/pages/management-placeholder").then((module) => ({
    default: module.ManagementPlaceholderPage,
  })),
);
const ReviewsPage = lazy(() =>
  import("@/pages/reviews").then((module) => ({ default: module.ReviewsPage })),
);
const ShopAttendancePage = lazy(() =>
  import("@/pages/shop-attendance").then((module) => ({
    default: module.ShopAttendancePage,
  })),
);
const SlackLinkPage = lazy(() =>
  import("@/pages/shop-attendance").then((module) => ({
    default: module.SlackLinkPage,
  })),
);
const PartsDashboardPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.DashboardRoute })),
);
const PartsListPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.PartsRoute })),
);
const PartDetailPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.PartDetailRoute })),
);
const PartsBomPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.BomRoute })),
);
const PartsSystemListPage = lazy(() =>
  import("@/pages/parts-app").then((module) => ({ default: module.SystemListRoute })),
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

/** Old /equipment/:id bookmarks keep working after the move to the Shop Tools app. */
function LegacyEquipmentRedirect() {
  const { equipmentId } = useParams();

  return <Navigate to={`/tools/${equipmentId}`} replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "training", element: <LearningHomePage /> },
      { path: "training/skills/:skillId", element: <LearningSkillPage /> },
      { path: "training/sign-offs", element: <LearningSignoffsPage /> },
      { path: "training/team", element: <LearningTeamPage /> },
      { path: "training/manage", element: <LearningManagePage /> },
      // Old track and lesson links from before the skills rebuild land on the Learning home.
      { path: "training/tracks/*", element: <Navigate to="/training" replace /> },
      { path: "training/lessons/*", element: <Navigate to="/training" replace /> },
      { path: "learning", element: <Navigate to="/training" replace /> },
      { path: "equipment", element: <Navigate to="/tools" replace /> },
      { path: "tools", element: <ToolsPage /> },
      { path: "tools/sign-offs", element: <ToolSignOffsPage /> },
      { path: "tools/readers", element: <ToolReadersPage /> },
      { path: "tools/:equipmentId", element: <EquipmentDetailPage /> },
      { path: "tools/:equipmentId/sop", element: <SopEditorPage /> },
      { path: "parts", element: <PartsListPage /> },
      { path: "parts/dashboard", element: <PartsDashboardPage /> },
      { path: "parts/new", element: <PartsListPage /> },
      { path: "parts/system-list", element: <PartsSystemListPage /> },
      { path: "parts/bom", element: <PartsBomPage /> },
      { path: "parts/manufacturing", element: <PartsManufacturingPage /> },
      { path: "parts/transmissions", element: <PartsTransmissionsPage /> },
      { path: "parts/orders", element: <PartsOrdersPage /> },
      { path: "parts/admin", element: <PartsAdminPage /> },
      { path: "parts/:partId", element: <PartDetailPage /> },
      { path: "batteries", element: <BatteriesPage /> },
      { path: "batteries/:batteryId", element: <BatteryDetailPage /> },
      { path: "shop", element: <ShopAttendancePage /> },
      { path: "shop/display", element: <ShopAttendancePage /> },
      { path: "shop/records", element: <ShopAttendancePage /> },
      { path: "shop/records/:studentUserId", element: <ShopAttendancePage /> },
      { path: "shop/review", element: <ShopAttendancePage /> },
      { path: "shop/review/:studentUserId", element: <ShopAttendancePage /> },
      { path: "shop/reports", element: <ShopAttendancePage /> },
      { path: "shop/reports/:studentUserId", element: <ShopAttendancePage /> },
      { path: "shop/link-slack", element: <SlackLinkPage /> },
      { path: "equipment/:equipmentId", element: <LegacyEquipmentRedirect /> },
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
      { path: "management/team", element: <Navigate to="/training/team" replace /> },
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


