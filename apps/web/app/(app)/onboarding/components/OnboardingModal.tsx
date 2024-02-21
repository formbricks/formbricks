"use client";

import {
  customSurvey,
  templates,
} from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TTemplate } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/Button";
import { OptionCard } from "@formbricks/ui/OptionCard";

import { createSurveyFromTemplate, finishOnboardingAction } from "../actions";

interface OnboardingModalProps {
  environmentId: string;
}

export function OnboardingModal({ environmentId }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRouting, setIsRouting] = useState(false);
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
    await finishOnboardingAction();
    try {
      const survey = await createSurveyFromTemplate(template, environmentId);
      router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
    } catch (e) {
      toast.error("An error occurred creating a new survey");
    }
  };

  const finishOnboardingAndNavigate = async () => {
    try {
      setIsRouting(true);
      router.push(`/`);
      await finishOnboardingAction();
      setIsOpen(false);
      setIsRouting(false);
    } catch (error) {
      toast.error("Some error occured");
      setIsRouting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-800 bg-opacity-80 backdrop-blur-sm">
      <div className="shadow-card-lg relative flex h-[85vh] w-[85vw] flex-col items-center justify-center rounded-xl bg-slate-50 p-10">
        <div className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md p-1 text-slate-500 hover:bg-slate-200">
          <Button
            onClick={finishOnboardingAndNavigate}
            variant="minimal"
            loading={isRouting}
            className="border-none">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-medium">Create your first survey</p>
            <Button
              size="lg"
              variant="darkCTA"
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
                  size="sm"
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
