"use client";

import { SendIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { InspectorSection } from "@/modules/workflows/components/inspector/workflow-inspector-section";

interface AiAssistantSectionProps {
  overviewText: string;
}

export const AiAssistantSection = ({ overviewText }: Readonly<AiAssistantSectionProps>) => {
  const { t } = useTranslation();

  return (
    <InspectorSection
      title={t("workspace.workflows.ai_assistant_title")}
      description={t("workspace.workflows.ai_assistant_description")}
      className="border-2 border-brand-dark">
      <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
        <p>{overviewText}</p>
      </div>
      <div className="flex items-center gap-2 px-4 pb-4">
        <Input
          type="text"
          placeholder={t("workspace.workflows.ai_assistant_placeholder")}
          className="bg-white"
        />
        <Button type="button" size="icon" aria-label={t("workspace.workflows.ai_assistant_send")}>
          <SendIcon />
        </Button>
      </div>
    </InspectorSection>
  );
};
