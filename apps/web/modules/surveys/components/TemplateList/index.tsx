"use client";

import { templates } from "@/app/lib/templates";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { TEnvironment } from "@formbricks/types/environment";
import { type TProject, ZProjectConfigChannel, ZProjectConfigIndustry } from "@formbricks/types/project";
import { TSurveyCreateInput, TSurveyType } from "@formbricks/types/surveys/types";
import { TTemplate, TTemplateFilter, ZTemplateRole } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { createSurveyAction } from "./actions";
import { StartFromScratchTemplate } from "./components/StartFromScratchTemplate";
import { Template } from "./components/Template";
import { TemplateFilters } from "./components/TemplateFilters";

interface TemplateListProps {
  user: TUser;
  environment: TEnvironment;
  project: TProject;
  templateSearch?: string;
  showFilters?: boolean;
  prefilledFilters: TTemplateFilter[];
  onTemplateClick?: (template: TTemplate) => void;
  noPreview?: boolean; // single click to create survey
}

export const TemplateList = ({
  user,
  project,
  environment,
  showFilters = true,
  templateSearch,
  prefilledFilters,
  onTemplateClick = () => {},
  noPreview,
}: TemplateListProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [activeTemplate, setActiveTemplate] = useState<TTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TTemplateFilter[]>(prefilledFilters);
  const surveyType: TSurveyType = useMemo(() => {
    if (project.config.channel) {
      if (project.config.channel === "website") {
        return "app";
      }

      return project.config.channel;
    }

    return "link";
  }, [project.config.channel]);

  const createSurvey = async (activeTemplate: TTemplate) => {
    setLoading(true);
    const augmentedTemplate: TSurveyCreateInput = {
      ...activeTemplate.preset,
      type: surveyType,
      createdBy: user.id,
    };
    const createSurveyResponse = await createSurveyAction({
      environmentId: environment.id,
      surveyBody: augmentedTemplate,
    });

    if (createSurveyResponse?.data) {
      router.push(`/environments/${environment.id}/surveys/${createSurveyResponse.data.id}/edit`);
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
      const channelParseResult = ZProjectConfigChannel.nullable().safeParse(selectedFilter[0]);
      const industryParseResult = ZProjectConfigIndustry.nullable().safeParse(selectedFilter[1]);
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
          prefilledFilters={prefilledFilters}
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StartFromScratchTemplate
          activeTemplate={activeTemplate}
          setActiveTemplate={setActiveTemplate}
          onTemplateClick={onTemplateClick}
          project={project}
          createSurvey={createSurvey}
          loading={loading}
          noPreview={noPreview}
        />
        {(process.env.NODE_ENV === "development" ? [...filteredTemplates()] : filteredTemplates()).map(
          (template: TTemplate) => {
            return (
              <Template
                key={template.name}
                template={template}
                activeTemplate={activeTemplate}
                setActiveTemplate={setActiveTemplate}
                onTemplateClick={onTemplateClick}
                project={project}
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
