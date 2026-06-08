"use client";

import { Workspace } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyCreateInput, TSurveyType } from "@formbricks/types/surveys/types";
import { TTemplate, TTemplateFilter, ZTemplateRole } from "@formbricks/types/templates";
import { TUserLocale } from "@formbricks/types/user";
import { ZWorkspaceConfigChannel, ZWorkspaceConfigIndustry } from "@formbricks/types/workspace";
import { customSurveyTemplate, templates } from "@/app/lib/templates";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { createSurveyAction } from "./actions";
import { CreateWithAITemplate } from "./components/create-with-ai-template";
import { StartFromScratchTemplate } from "./components/start-from-scratch-template";
import { Template } from "./components/template";
import { TemplateFilters } from "./components/template-filters";

interface TemplateListProps {
  userId: string;
  workspaceId: string;
  workspace: Workspace;
  templateSearch?: string;
  showFilters?: boolean;
  onTemplateClick?: (template: TTemplate) => void;
  noPreview?: boolean; // single click to create survey
  showAICreateCard?: boolean;
  language?: TUserLocale;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export const TemplateList = ({
  userId,
  workspace,
  workspaceId,
  showFilters = true,
  templateSearch,
  onTemplateClick = () => {},
  noPreview,
  showAICreateCard = false,
  language = "en-US",
  isAIAvailable = false,
  aiUnavailableReason,
}: TemplateListProps) => {
  const workspaceBasePath = `/workspaces/${workspace.id}`;
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTemplate, setActiveTemplate] = useState<TTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TTemplateFilter[]>([null, null, null]);
  const surveyType: TSurveyType = useMemo(() => {
    if (workspace.config.channel) {
      if (workspace.config.channel === "website") {
        return "app";
      }

      return workspace.config.channel;
    }

    return "link";
  }, [workspace.config.channel]);

  const createSurvey = async (activeTemplate: TTemplate) => {
    setLoading(true);
    const augmentedTemplate: TSurveyCreateInput = {
      ...activeTemplate.preset,
      type: surveyType,
      createdBy: userId,
    };
    const isBlank = activeTemplate.name === customSurveyTemplate(t).name;
    const createSurveyResponse = await createSurveyAction({
      workspaceId: workspaceId,
      surveyBody: augmentedTemplate,
      createdFrom: isBlank ? "blank" : "template",
    });

    if (createSurveyResponse?.data) {
      router.push(`${workspaceBasePath}/surveys/${createSurveyResponse.data.id}/edit`);
    } else {
      const errorMessage = getFormattedErrorMessage(createSurveyResponse);
      toast.error(errorMessage);
    }
  };

  const filteredTemplates = () => {
    return templates(t).filter((template) => {
      if (templateSearch) {
        return template.name.toLowerCase().includes(templateSearch.toLowerCase());
      }

      // Parse and validate the filters
      const channelParseResult = ZWorkspaceConfigChannel.nullable().safeParse(selectedFilter[0]);
      const industryParseResult = ZWorkspaceConfigIndustry.nullable().safeParse(selectedFilter[1]);
      const roleParseResult = ZTemplateRole.nullable().safeParse(selectedFilter[2]);

      // Ensure all validations are successful
      if (!channelParseResult.success || !industryParseResult.success || !roleParseResult.success) {
        // If any validation fails, skip this template
        return true;
      }

      // Access the validated data from the parse results
      const validatedChannel = channelParseResult.data;
      const validatedIndustry = industryParseResult.data;
      const validatedRole = roleParseResult.data;

      // Perform the filtering
      const channelMatch = validatedChannel === null || template.channels?.includes(validatedChannel);
      const industryMatch = validatedIndustry === null || template.industries?.includes(validatedIndustry);
      const roleMatch = validatedRole === null || template.role === validatedRole;

      return channelMatch && industryMatch && roleMatch;
    });
  };

  return (
    <main className="relative z-0 flex-1 overflow-y-auto px-6 pb-6 pt-2 focus:outline-none">
      {showFilters && !templateSearch && (
        <TemplateFilters
          selectedFilter={selectedFilter}
          setSelectedFilter={setSelectedFilter}
          templateSearch={templateSearch}
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StartFromScratchTemplate
          activeTemplate={activeTemplate}
          setActiveTemplate={setActiveTemplate}
          onTemplateClick={onTemplateClick}
          workspace={workspace}
          createSurvey={createSurvey}
          loading={loading}
          noPreview={noPreview}
        />
        {showAICreateCard && (
          <CreateWithAITemplate
            workspaceId={workspaceId}
            language={language}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
          />
        )}
        {(process.env.NODE_ENV === "development" ? [...filteredTemplates()] : filteredTemplates()).map(
          (template: TTemplate) => {
            return (
              <Template
                key={template.name}
                template={template}
                activeTemplate={activeTemplate}
                setActiveTemplate={setActiveTemplate}
                onTemplateClick={onTemplateClick}
                workspace={workspace}
                createSurvey={createSurvey}
                loading={loading}
                selectedFilter={selectedFilter}
                noPreview={noPreview}
              />
            );
          }
        )}
      </div>
    </main>
  );
};
