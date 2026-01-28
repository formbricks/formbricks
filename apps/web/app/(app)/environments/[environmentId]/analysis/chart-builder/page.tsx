"use client";

import {
  ActivityIcon,
  AreaChartIcon,
  BarChart3Icon,
  LineChartIcon,
  MapIcon,
  PieChartIcon,
  ScatterChart,
  SearchIcon,
  TableIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

// --- Mock Data ---

const DATASETS = ["FCC 2018 Survey", "users_channels", "messages", "new_members_daily", "users"];

const CHART_TYPES = [
  { id: "area", name: "Area Chart", icon: AreaChartIcon },
  { id: "bar", name: "Bar Chart", icon: BarChart3Icon },
  { id: "line", name: "Line Chart", icon: LineChartIcon },
  { id: "pie", name: "Pie Chart", icon: PieChartIcon },
  { id: "table", name: "Table", icon: TableIcon },
  { id: "big_number", name: "Big Number", icon: ActivityIcon }, // Fallback icon
  { id: "scatter", name: "Scatter Plot", icon: ScatterChart }, // Fallback icon
  { id: "map", name: "World Map", icon: MapIcon },
];

export default function ChartBuilderPage() {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedChartType, setSelectedChartType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");

  const filteredChartTypes = CHART_TYPES.filter((type) =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Create a new chart</h1>
      </div>

      <div className="grid gap-8">
        {/* Option 1: Ask AI */}
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-brand-dark/10 flex h-8 w-8 items-center justify-center rounded-full">
              <ActivityIcon className="text-brand-dark h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Ask your data</h2>
              <p className="text-sm text-gray-500">
                Describe what you want to see and let AI build the chart.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Input
              placeholder="e.g. How many users signed up last week?"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              disabled={!userQuery}
              className="bg-brand-dark hover:bg-brand-dark/90"
              onClick={async () => {
                const response = await fetch("/api/analytics/query", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prompt: userQuery }),
                });
                const data = await response.json();
                if (data.data) {
                  console.log("Chart Data:", data);
                  alert("Chart generated! Check console for data. (Visualization implementation pending)");
                }
              }}>
              Generate
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-50 px-2 text-sm text-gray-500">OR</span>
          </div>
        </div>

        {/* Option 2: Build Manually */}
        <div className="space-y-8 opacity-75 transition-opacity hover:opacity-100">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                1
              </span>
              <h2 className="font-medium text-gray-900">Choose a dataset</h2>
            </div>

            <div className="ml-8 max-w-md">
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Choose a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((ds) => (
                    <SelectItem key={ds} value={ds}>
                      {ds}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                2
              </span>
              <h2 className="font-medium text-gray-900">Choose chart type</h2>
            </div>

            <div className="ml-8 rounded-lg border border-gray-200 bg-white p-4">
              <div className="relative mb-4">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search all charts"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {filteredChartTypes.map((chart) => {
                  const isSelected = selectedChartType === chart.id;
                  return (
                    <div
                      key={chart.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedChartType(chart.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedChartType(chart.id);
                      }}
                      className={cn(
                        "focus:ring-brand-dark cursor-pointer rounded-md border p-4 text-center transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2",
                        isSelected
                          ? "border-brand-dark ring-brand-dark bg-brand-dark/5 ring-1"
                          : "border-gray-200 hover:border-gray-300"
                      )}>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-gray-100">
                        <chart.icon className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{chart.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              disabled={!selectedDataset || !selectedChartType}
              variant="outline"
              onClick={() => {
                alert("Manual chart creation triggered");
              }}>
              Create Manually
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
