import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/maxis/DashboardSidebar";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  ),
});
