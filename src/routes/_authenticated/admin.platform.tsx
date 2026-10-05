import { createFileRoute } from "@tanstack/react-router";
import { AdminMarketplace } from "@/components/AdminMarketplace";

export const Route = createFileRoute("/_authenticated/admin/platform")({
  component: Page,
});

function Page() {
  return <AdminMarketplace defaultTab="settings" />;
}
