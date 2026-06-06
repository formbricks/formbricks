"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateWithAIForm } from "@/modules/survey/components/template-list/components/create-with-ai-form";
import { Header } from "@/modules/ui/components/header";

interface CreateSurveyWithAIOnboardingProps {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export const CreateSurveyWithAIOnboarding = ({
  workspaceId,
  language,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<CreateSurveyWithAIOnboardingProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isAIAvailable) return;

    globalThis.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
    });
  }, [isAIAvailable]);

  const handleSuccess = (surveyId: string) => {
    router.push(`/workspaces/${workspaceId}/surveys/${surveyId}/edit?mode=cx`);
  };

  return (
    <div className="flex min-h-full w-full max-w-xl flex-col items-center gap-y-8 px-4">
      <Header
        title={t("workspace.surveys.ai_create.dialog_title")}
        subtitle={t("workspace.surveys.ai_create.dialog_description")}
      />
      <CreateWithAIForm
        workspaceId={workspaceId}
        language={language}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
        onSuccess={handleSuccess}
        promptInputRef={promptInputRef}
        showCancel={false}
        showSurveyType={false}
      />
    </div>
  );
};
