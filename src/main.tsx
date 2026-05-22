import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";

import { AppProviders } from "@/providers/app-providers";
import { RootLayout } from "@/routes/root-layout";
import { AdminPage } from "@/pages/admin";
import { AuthPage } from "@/pages/auth";
import { BadgesPage } from "@/pages/badges";
import { DashboardPage } from "@/pages/dashboard";
import { EquipmentPage } from "@/pages/equipment";
import { HomePage } from "@/pages/home";
import { TrainingPage } from "@/pages/training";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "training", element: <TrainingPage /> },
      { path: "equipment", element: <EquipmentPage /> },
      { path: "badges", element: <BadgesPage /> },
      { path: "admin", element: <AdminPage /> },
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
