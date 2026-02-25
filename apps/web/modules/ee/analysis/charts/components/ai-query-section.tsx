"use client";

import { ActivityIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateAIChartAction } from "@/modules/ee/analysis/charts/actions";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

interface AIQuerySectionProps {
  environmentId: string;
  onChartGenerated: (data: AnalyticsResponse) => void;
}

export function AIQuerySection({ environmentId, onChartGenerated }: Readonly<AIQuerySectionProps>) {
  const [userQuery, setUserQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateAIChartAction({
        environmentId,
        prompt: userQuery.trim(),
      });

      if (result?.data) {
        onChartGenerated(result.data);
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("common.something_went_wrong_please_try_again");
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
          <h2 className="font-semibold text-gray-900">
            {t("environments.analysis.charts.ai_query_section_title")}
          </h2>
          <p className="text-sm text-gray-500">
            {t("environments.analysis.charts.ai_query_section_description")}
          </p>
        </div>
      </div>

      <form className="flex gap-4" onSubmit={handleSubmit}>
        <Input
          placeholder={t("environments.analysis.charts.ai_query_placeholder")}
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          className="flex-1"
          disabled={isGenerating}
        />
        <Button
          type="submit"
          disabled={!userQuery.trim() || isGenerating}
          loading={isGenerating}
          className="bg-brand-dark hover:bg-brand-dark/90">
          {t("common.generate")}
        </Button>
      </form>
    </div>
  );
}
