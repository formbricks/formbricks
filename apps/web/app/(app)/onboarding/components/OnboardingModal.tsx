"use client";

import {
  customSurvey,
  templates,
} from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TTemplate } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/Button";
import { OptionCard } from "@formbricks/ui/OptionCard";

import { createSurveyFromTemplate } from "../actions";

interface OnboardingModalProps {
  environment: TEnvironment;
}

export function OnboardingModal({ environment }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const filteredTemplates = templates.filter(
    (template) =>
      template.name === "Churn Survey" ||
      template.name === "Feedback Box" ||
      template.name === "Improve Trial Conversion"
  );
  if (!isOpen) return null;

  const newSurveyFromTemplate = async (template: TTemplate) => {
    setLoadingTemplate(template.name);
    localStorage.removeItem("pathway");
    try {
      const survey = await createSurveyFromTemplate(template, environment);
      router.push(`/environments/${environment.id}/surveys/${survey.id}/edit`);
    } catch (e) {
      toast.error("An error occurred creating a new survey");
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-500 bg-opacity-30 backdrop-blur-md">
      <div className="relative w-[70rem] rounded-xl bg-slate-50 p-10">
        <X
          className="absolute right-0 top-0 m-4 h-6 w-6 cursor-pointer text-slate-500"
          onClick={() => {
            localStorage.removeItem("pathway");
            setIsOpen(false);
          }}
        />
        <div className="p-6">
          <div className="flex justify-between">
            <p className="text-2xl font-medium">Create your first survey</p>
            <Button
              loading={loadingTemplate === "Start from scratch"}
              onClick={() => {
                newSurveyFromTemplate(customSurvey);
              }}>
              Start from scratch <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid w-full grid-cols-3 grid-rows-1 gap-6">
            {filteredTemplates.map((template) => {
              return (
                <OptionCard
                  key={template.name}
                  title={template.name}
                  description={template.description}
                  onSelect={() => newSurveyFromTemplate(template)}
                  loading={loadingTemplate === template.name}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
