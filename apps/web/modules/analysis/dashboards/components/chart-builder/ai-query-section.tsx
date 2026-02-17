"use client";

import { ActivityIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface AIQuerySectionProps {
  onChartGenerated: (data: AnalyticsResponse) => void;
}

export function AIQuerySection({ onChartGenerated }: AIQuerySectionProps) {
  const [userQuery, setUserQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!userQuery.trim()) return;

    setIsGenerating(true);

    try {
      const response = await fetch("/api/analytics/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userQuery }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.data) {
        onChartGenerated(data);
      } else {
        toast.error("No data returned from query");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate chart";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="bg-brand-dark/10 flex h-8 w-8 items-center justify-center rounded-full">
          <ActivityIcon className="text-brand-dark h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Ask your data</h2>
          <p className="text-sm text-gray-500">Describe what you want to see and let AI build the chart.</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="e.g. How many users signed up last week?"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && userQuery.trim() && !isGenerating) {
              handleGenerate();
            }
          }}
          className="flex-1"
          disabled={isGenerating}
        />
        <Button
          disabled={!userQuery.trim() || isGenerating}
          loading={isGenerating}
          className="bg-brand-dark hover:bg-brand-dark/90"
          onClick={handleGenerate}>
          Generate
        </Button>
      </div>

      {isGenerating && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner className="h-8 w-8" />
          <span className="ml-3 text-sm text-gray-500">Generating chart...</span>
        </div>
      )}
    </div>
  );
}
