"use client";

import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import { Bar, BarChart, CartesianGrid, Bar as RechartsBar, XAxis } from "recharts";
import { Button } from "@/modules/ui/components/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/modules/ui/components/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useAnalysisStore } from "../../store";

// --- Mock Chart Components for Widget Content ---

const MockBarChart = () => {
  const data = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 300 },
    { name: "Mar", value: 200 },
    { name: "Apr", value: 278 },
    { name: "May", value: 189 },
    { name: "Jun", value: 239 },
  ];
  return (
    <ChartContainer config={{ value: { label: "Value", color: "#6366f1" } }} className="h-full w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
};

const MockBigNumber = ({ title, value }: { title: string; value: string }) => (
  <div className="flex h-full flex-col items-center justify-center">
    <div className="text-4xl font-bold text-gray-900">{value}</div>
    <div className="mt-2 text-sm text-gray-500">{title}</div>
  </div>
);

// --- Widget Wrapper ---

const DashboardWidget = ({
  title,
  children,
  error,
}: {
  title: string;
  children: React.ReactNode;
  error?: string;
}) => {
  return (
    <div className="flex h-full flex-col rounded-sm border border-gray-200 bg-white shadow-sm ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Force refresh</DropdownMenuItem>
            <DropdownMenuItem>View as table</DropdownMenuItem>
            <DropdownMenuItem>Maximize</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body */}
      <div className="relative min-h-[300px] flex-1 p-4">
        {error ? (
          <div className="flex h-full w-full flex-col items-start justify-center rounded-md border border-red-100 bg-red-50 p-4">
            <div className="mb-1 flex items-center gap-2 font-semibold text-red-700">
              <div className="rounded-full bg-red-600 p-0.5">
                <span className="block h-3 w-3 text-center text-[10px] leading-3 text-white">✕</span>
              </div>
              Data error
            </div>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default function DashboardPage({
  params,
}: {
  params: Promise<{ environmentId: string; dashboardId: string }>;
}) {
  const { dashboardId } = use(params);
  const { dashboards } = useAnalysisStore();

  // Find dashboard
  // For the purpose of the demo/port, we might need to map the ID or just grab the first one if mock data logic is simple
  const dashboard = dashboards.find((d) => d.id === dashboardId) || dashboards[0]; // Fallback for demo flow

  if (!dashboard) {
    return notFound();
  }

  // Demo: Determine if empty based on ID or simple toggle mechanism
  // We'll fake an empty dashboard if ID suggests it or random chance for demo
  const isEmpty = dashboard.widgets.length === 0 && dashboard.id !== "d1" && dashboard.id !== "d2";

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gray-100 p-6">
      {/* Dashboard Header Context (Actions, filters) would go here */}
      <div className="mb-6 flex justify-end">
        <Button variant="outline" size="sm" className="text-brand-dark border-brand-dark/20 mr-2 bg-white">
          Draft
        </Button>
        <Button size="sm">Edit dashboard</Button>
      </div>

      {isEmpty ? (
        // Empty State
        <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white/50">
          <div className="mb-4 rounded-full bg-gray-100 p-4">
            <div className="h-12 w-12 rounded-md bg-gray-300 opacity-20" /> {/* Abstract File Icon */}
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
        // Grid Layout
        <div className="grid grid-cols-12 gap-6">
          {/* Row 1 */}
          <div className="col-span-12 md:col-span-3">
            <DashboardWidget
              title="Average NPS Score"
              error="Error: Datetime column not provided as part table configuration and is required by this type of chart">
              <MockBigNumber title="NPS" value="72" />
            </DashboardWidget>
          </div>

          <div className="col-span-12 md:col-span-9">
            <DashboardWidget title="NPS Trend">
              <MockBarChart />
            </DashboardWidget>
          </div>

          {/* Row 2 */}
          <div className="col-span-12 md:col-span-4">
            <DashboardWidget title="Total Responses">
              <MockBigNumber title="Total" value="1,293" />
            </DashboardWidget>
          </div>
        </div>
      )}
    </div>
  );
}
