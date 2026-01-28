"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/modules/ui/components/button";
import { updateDashboardAction } from "../../../actions";
import { TDashboard } from "../../../types/analysis";
import { DashboardWidget } from "./DashboardWidget";
import { EditDashboardDialog } from "./EditDashboardDialog";

interface DashboardDetailClientProps {
  dashboard: TDashboard;
  environmentId: string;
}

export function DashboardDetailClient({ dashboard: initialDashboard, environmentId }: DashboardDetailClientProps) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const isEmpty = dashboard.widgets.length === 0;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await updateDashboardAction({
        environmentId,
        dashboardId: dashboard.id,
        status: "published",
      });

      if (!result?.data) {
        toast.error(result?.serverError || "Failed to publish dashboard");
        return;
      }

      toast.success("Dashboard published successfully!");
      setDashboard({ ...dashboard, status: "published" });
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to publish dashboard");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleEditSuccess = () => {
    router.refresh();
  };

  // Calculate grid column span based on widget layout width
  const getColSpan = (w: number) => {
    // Assuming w is in a 12-column grid system
    // Map widget width to Tailwind col-span classes
    if (w <= 2) return "col-span-12 md:col-span-2";
    if (w <= 3) return "col-span-12 md:col-span-3";
    if (w <= 4) return "col-span-12 md:col-span-4";
    if (w <= 6) return "col-span-12 md:col-span-6";
    if (w <= 8) return "col-span-12 md:col-span-8";
    if (w <= 9) return "col-span-12 md:col-span-9";
    return "col-span-12";
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gray-100 p-6">
      {/* Dashboard Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="mt-1 text-sm text-gray-500">{dashboard.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-brand-dark border-brand-dark/20 bg-white">
            {dashboard.status === "published" ? "Published" : "Draft"}
          </Button>
          {dashboard.status === "draft" && (
            <Button size="sm" onClick={handlePublish} loading={isPublishing}>
              Publish
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(true)}>
            Edit dashboard
          </Button>
        </div>
      </div>

      {isEmpty ? (
        // Empty State
        <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white/50">
          <div className="mb-4 rounded-full bg-gray-100 p-4">
            <div className="h-12 w-12 rounded-md bg-gray-300 opacity-20" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No Data</h3>
          <p className="mt-2 max-w-sm text-center text-gray-500">
            There is currently no information to display. Add charts to build your dashboard.
          </p>
          <Link href="../chart-builder">
            <Button className="mt-6" variant="default">
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Chart
            </Button>
          </Link>
        </div>
      ) : (
        // Grid Layout - Render widgets dynamically
        <div className="grid grid-cols-12 gap-6">
          {dashboard.widgets.map((widget) => (
            <div key={widget.id} className={getColSpan(widget.layout.w)}>
              <DashboardWidget widget={widget} environmentId={environmentId} />
            </div>
          ))}
        </div>
      )}

      <EditDashboardDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        dashboardId={dashboard.id}
        environmentId={environmentId}
        initialName={dashboard.name}
        initialDescription={dashboard.description}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
