"use client";

import { PreviewSurvey } from "@/app/(app)/environments/[environmentId]/surveys/components/PreviewSurvey";
import { TemplateList } from "@/app/(app)/environments/[environmentId]/surveys/templates/TemplateList";
import { replacePresetPlaceholders } from "@/app/lib/templates";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct } from "@formbricks/types/product";
import type { TTemplate } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { SearchBox } from "@formbricks/ui/SearchBox";

import { minimalSurvey, templates } from "./templates";

type TemplateContainerWithPreviewProps = {
  environmentId: string;
  product: TProduct;
  environment: TEnvironment;
  user: TUser;
};

export default function TemplateContainerWithPreview({
  environmentId,
  product,
  environment,
  user,
}: TemplateContainerWithPreviewProps) {
  const [activeTemplate, setActiveTemplate] = useState<TTemplate | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState<string | null>(null);
  useEffect(() => {
    if (product && templates?.length) {
      const newTemplate = replacePresetPlaceholders(templates[0], product);
      setActiveTemplate(newTemplate);
      setActiveQuestionId(newTemplate.preset.questions[0].id);
    }
  }, [product]);

  return (
    <div className="flex h-screen flex-col">
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <div className="flex-1 flex-col overflow-auto bg-slate-50">
          <div className="ml-6 mt-6 flex flex-col items-center justify-between md:flex-row md:items-start">
            <div className=" flex space-x-4">
              <Button variant="secondary" StartIcon={ArrowLeftIcon} size="sm">
                Back
              </Button>
              <h1 className="text-2xl font-bold text-slate-800">Create a new survey</h1>
            </div>
            <div className="px-6">
              <SearchBox
                autoFocus
                value={templateSearch ?? ""}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder={"Search..."}
                className="block rounded-md border border-slate-100 bg-white shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm md:w-auto "
                type="search"
                name="search"
              />
            </div>
          </div>

          <TemplateList
            environmentId={environmentId}
            environment={environment}
            product={product}
            user={user}
            templateSearch={templateSearch ?? ""}
            onTemplateClick={(template) => {
              setActiveQuestionId(template.preset.questions[0].id);
              setActiveTemplate(template);
            }}
          />
        </div>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 md:flex md:flex-col">
          {activeTemplate && (
            <div className="my-6 flex h-[90%] w-full flex-col items-center justify-center">
              <PreviewSurvey
                survey={{ ...minimalSurvey, ...activeTemplate.preset }}
                questionId={activeQuestionId}
                product={product}
                environment={environment}
                languageCode={"default"}
                onFileUpload={async (file) => file.name}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
