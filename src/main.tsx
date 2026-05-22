import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";

import { AppProviders } from "@/providers/app-providers";
import { RootLayout } from "@/routes/root-layout";
import { AdminPeoplePage } from "@/pages/admin-people";
import { AdminPage } from "@/pages/admin";
import { AuthPage } from "@/pages/auth";
import { BadgesPage } from "@/pages/badges";
import { DashboardPage } from "@/pages/dashboard";
import { EquipmentDetailPage } from "@/pages/equipment-detail";
import { EquipmentPage } from "@/pages/equipment";
import { HomePage } from "@/pages/home";
import { LearningTrackEditorPage } from "@/pages/learning-track-editor";
import { LessonEditorPage } from "@/pages/lesson-editor";
import { LessonViewPage } from "@/pages/lesson-view";
import { TrainingPage } from "@/pages/training";
import { TrainingTrackPage } from "@/pages/training-track";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "training", element: <TrainingPage /> },
      { path: "training/tracks/new", element: <LearningTrackEditorPage /> },
      { path: "training/tracks/:trackId", element: <TrainingTrackPage /> },
      { path: "training/tracks/:trackId/edit", element: <LearningTrackEditorPage /> },
      { path: "training/lessons/:lessonId/edit", element: <LessonEditorPage /> },
      { path: "training/lessons/:lessonId", element: <LessonViewPage /> },
      { path: "equipment", element: <EquipmentPage /> },
      { path: "equipment/:equipmentId", element: <EquipmentDetailPage /> },
      { path: "badges", element: <BadgesPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "admin/people", element: <AdminPeoplePage /> },
      { path: "auth", element: <AuthPage /> },
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
