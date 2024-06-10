"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { templates, testTemplate } from "@formbricks/lib/templates";
import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct } from "@formbricks/types/product";
import { TSurveyInput } from "@formbricks/types/surveys";
import {
  TTemplate,
  TTemplateChannel,
  TTemplateIndustry,
  TTemplateRole,
  ZTemplateChannel,
  ZTemplateIndustry,
  ZTemplateRole,
} from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { createSurveyAction } from "./actions";
import { StartFromScratchTemplate } from "./components/StartFromScratchTemplate";
import { Template } from "./components/Template";
import { TemplateFilters } from "./components/TemplateFilters";

interface TemplateListProps {
  environmentId: string;
  user: TUser;
  environment: TEnvironment;
  product: TProduct;
  templateSearch?: string;
  prefilledFilters: (TTemplateChannel | TTemplateIndustry | TTemplateRole | null)[];
  onTemplateClick: (template: TTemplate) => void;
}

export const TemplateList = ({
  environmentId,
  user,
  product,
  environment,
  templateSearch,
  prefilledFilters,
  onTemplateClick,
}: TemplateListProps) => {
  const router = useRouter();
  const [activeTemplate, setActiveTemplate] = useState<TTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] =
    useState<(TTemplateChannel | TTemplateIndustry | TTemplateRole | null)[]>(prefilledFilters);
  const createSurvey = async (activeTemplate: TTemplate) => {
    setLoading(true);
    const surveyType = environment?.widgetSetupCompleted ? "app" : "link";
    const augmentedTemplate: TSurveyInput = {
      ...activeTemplate.preset,
      type: surveyType,
      createdBy: user.id,
    };
    const survey = await createSurveyAction(environmentId, augmentedTemplate);
    router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (templateSearch) {
        return template.name.toLowerCase().startsWith(templateSearch.toLowerCase());
      }
      // Parse and validate the filters
      const channelParseResult = ZTemplateChannel.nullable().safeParse(selectedFilter[0]);
      const industryParseResult = ZTemplateIndustry.nullable().safeParse(selectedFilter[1]);
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
  }, [templates, selectedFilter, templateSearch]);

  return (
    <main className="relative z-0 flex-1 overflow-y-auto px-6 pb-6 pt-3 focus:outline-none">
      {!templateSearch && (
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
          product={product}
          createSurvey={createSurvey}
          loading={loading}
        />
        {(process.env.NODE_ENV === "development"
          ? [...filteredTemplates, testTemplate]
          : filteredTemplates
        ).map((template: TTemplate) => {
          return (
            <Template
              template={template}
              activeTemplate={activeTemplate}
              setActiveTemplate={setActiveTemplate}
              onTemplateClick={onTemplateClick}
              product={product}
              createSurvey={createSurvey}
              loading={loading}
            />
          );
        })}
      </div>
    </main>
  );
};
