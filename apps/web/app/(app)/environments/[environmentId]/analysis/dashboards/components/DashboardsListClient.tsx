"use client";

import { formatDistanceToNow } from "date-fns";
import { MoreHorizontalIcon, PlusIcon, SearchIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { createDashboardAction } from "../../actions";
import { TDashboard } from "../../types/analysis";
import { CreateDashboardDialog } from "./CreateDashboardDialog";

interface DashboardsListClientProps {
  dashboards: TDashboard[];
  environmentId: string;
}

export function DashboardsListClient({
  dashboards: initialDashboards,
  environmentId,
}: DashboardsListClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboards] = useState(initialDashboards);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filteredDashboards = dashboards.filter((dashboard) =>
    dashboard.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDashboard = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!dashboardName.trim()) {
      toast.error("Please enter a dashboard name");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createDashboardAction({
        environmentId,
        name: dashboardName.trim(),
        description: dashboardDescription.trim() || undefined,
      });

      if (!result?.data) {
        toast.error(result?.serverError || "Failed to create dashboard");
        return;
      }

      toast.success("Dashboard created successfully!");
      setIsCreateDialogOpen(false);
      setDashboardName("");
      setDashboardDescription("");
      // Navigate to the new dashboard
      router.push(`/environments/${environmentId}/analysis/dashboard/${result.data.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create dashboard");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header / Actions */}
      <div className="flex items-center justify-between border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4"></div>
        <Button onClick={handleCreateDashboard}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto bg-gray-50 pt-6">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="border-b border-gray-200 px-6 py-3">Name</th>
                <th className="border-b border-gray-200 px-6 py-3">Status</th>
                <th className="border-b border-gray-200 px-6 py-3">Owners</th>
                <th className="border-b border-gray-200 px-6 py-3">Last Modified</th>
                <th className="border-b border-gray-200 px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDashboards.map((dashboard) => (
                <tr key={dashboard.id} className="group hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {/* Star Icon - Active state simulation */}
                      <StarIcon
                        className={`h-4 w-4 ${dashboard.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                      <Link href={`dashboard/${dashboard.id}`}>
                        <span className="cursor-pointer hover:underline">{dashboard.name}</span>
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      {dashboard.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-6 py-4">{dashboard.owners.map((u) => u.name).join(", ") || "-"}</td>
                  <td className="px-6 py-4">
                    {formatDistanceToNow(new Date(dashboard.lastModified), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDashboards.length === 0 && (
            <div className="p-12 text-center text-gray-500">No dashboards found.</div>
          )}
        </div>
      </div>

      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        dashboardName={dashboardName}
        onDashboardNameChange={setDashboardName}
        dashboardDescription={dashboardDescription}
        onDashboardDescriptionChange={setDashboardDescription}
        onCreate={handleCreate}
        isCreating={isCreating}
      />
    </div>
  );
}
