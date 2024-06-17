"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { templates, testTemplate } from "@formbricks/lib/templates";
import type { TEnvironment } from "@formbricks/types/environment";
import { type TProduct, type TProductIndustry, ZProductIndustry } from "@formbricks/types/product";
import { TSurveyInput, TSurveyType, ZSurveyType } from "@formbricks/types/surveys";
import { TTemplate, TTemplateRole, ZTemplateRole } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { createSurveyAction } from "./actions";
import { StartFromScratchTemplate } from "./components/StartFromScratchTemplate";
import { Template } from "./components/Template";
import { TemplateFilters } from "./components/TemplateFilters";

const channels: { value: TSurveyType; label: string }[] = [
  { value: "website", label: "Website Survey" },
  { value: "app", label: "App Survey" },
  { value: "email", label: "Email Survey" },
  { value: "link", label: "Link Survey" },
];
const industries: { value: TProductIndustry; label: string }[] = [
  { value: "eCommerce", label: "E-Commerce" },
  { value: "saas", label: "SaaS" },
  { value: "other", label: "Other" },
];
const roles: { value: TTemplateRole; label: string }[] = [
  { value: "productManager", label: "Product Manager" },
  { value: "customerSuccess", label: "Customer Success" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "other", label: "Other" },
];

interface TemplateListProps {
  environmentId: string;
  user: TUser;
  environment: TEnvironment;
  product: TProduct;
  templateSearch?: string;
  prefilledFilters: (TSurveyType | TProductIndustry | TTemplateRole | null)[];
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
    useState<(TSurveyType | TProductIndustry | TTemplateRole | null)[]>(prefilledFilters);
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
      const channelParseResult = ZSurveyType.nullable().safeParse(selectedFilter[0]);
      const industryParseResult = ZProductIndustry.nullable().safeParse(selectedFilter[1]);
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
          allFilters={[channels, industries, roles]}
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
              channelMapping={channels}
              industryMapping={industries}
              roleMapping={roles}
            />
          );
        })}
      </div>
    </main>
  );
};
