import { createFileRoute } from "@tanstack/react-router";
import { AdminProjects } from "@/components/AdminProjects";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: Page,
});

function Page() {
  return <AdminProjects />;
}
