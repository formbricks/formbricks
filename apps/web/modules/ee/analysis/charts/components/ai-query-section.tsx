"use client";

import { ActivityIcon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateAIChartAction } from "@/modules/ee/analysis/charts/actions";
import {
  type TAIUnavailableActionType,
  type TAIUnavailableReason,
  getAIUnavailableAction,
} from "@/modules/ee/analysis/charts/lib/ai-availability";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

interface AIQuerySectionProps {
  workspaceId: string;
  onChartGenerated: (data: AnalyticsResponse) => void;
  feedbackDirectoryId: string;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export function AIQuerySection({
  workspaceId,
  onChartGenerated,
  feedbackDirectoryId,
  isAIAvailable = true,
  aiUnavailableReason,
}: Readonly<AIQuerySectionProps>) {
  const [userQuery, setUserQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { t } = useTranslation();

  const translateAIUnavailableMessage = (reason: TAIUnavailableReason | undefined): string => {
    switch (reason) {
      case "not_in_plan":
        return t("workspace.analysis.charts.ai_not_in_plan");
      case "not_enabled":
        return t("workspace.analysis.charts.ai_not_enabled");
      case "instance_not_configured":
        return t("workspace.analysis.charts.ai_instance_not_configured");
      default:
        return t("workspace.analysis.charts.ai_not_available");
    }
  };

  const translateAIUnavailableAction = (actionType: TAIUnavailableActionType): string => {
    switch (actionType) {
      case "enable_ai":
        return t("workspace.analysis.charts.ai_enable_in_settings");
      case "upgrade_plan":
        return t("workspace.analysis.charts.ai_upgrade_plan");
    }
  };

  const aiUnavailableMessage = translateAIUnavailableMessage(aiUnavailableReason);
  const aiUnavailableAction = getAIUnavailableAction(aiUnavailableReason, workspaceId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateAIChartAction({
        workspaceId,
        prompt: userQuery.trim(),
        feedbackDirectoryId,
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
    <div className="space-y-3">
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark/10">
            <ActivityIcon className="h-5 w-5 text-brand-dark" />
          </div>
          <h2 className="font-semibold text-gray-900">
            {t("workspace.analysis.charts.ai_query_section_title")}
          </h2>
          <p className="text-sm text-gray-500">
            {t("workspace.analysis.charts.ai_query_section_description")}
          </p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <Input
            autoFocus
            placeholder={t("workspace.analysis.charts.ai_query_placeholder")}
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            maxLength={2000}
            disabled={!isAIAvailable || isGenerating}
          />
          <Button
            type="submit"
            variant="default"
            className="w-full"
            disabled={!isAIAvailable || !userQuery.trim() || isGenerating}
            loading={isGenerating}>
            <WandSparklesIcon className="h-4 w-4" />
            {t("workspace.analysis.charts.create_chart_with_ai")}
          </Button>
          {!isAIAvailable && (
            <Alert variant="info" size="small">
              <AlertDescription className="overflow-visible whitespace-normal">
                <span>{aiUnavailableMessage}</span>
              </AlertDescription>
              {aiUnavailableAction && (
                <AlertButton asChild>
                  <Link href={aiUnavailableAction.href}>
                    {translateAIUnavailableAction(aiUnavailableAction.type)}
                  </Link>
                </AlertButton>
              )}
            </Alert>
          )}
        </form>
      </div>
    </div>
  );
}
