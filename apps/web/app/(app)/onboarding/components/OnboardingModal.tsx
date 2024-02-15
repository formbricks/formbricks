"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TTemplate } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/Button";

import { createSurveyFromTemplate } from "../actions";
import { customSurvey, templates } from "./templates";

interface OnboardingModalProps {
  environment: TEnvironment;
}

interface TemplateOptionProps {
  template: TTemplate;
}

export function OnboardingModal({ environment }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const router = useRouter();

  function TemplateOption({ template }: TemplateOptionProps) {
    const isLoading = loadingStates[template.name] || false;
    return (
      <div
        className="cursor-pointer space-y-4 rounded-xl border bg-white p-3 transition ease-in-out hover:scale-105"
        onClick={() => {
          newSurveyFromTemplate(template);
        }}>
        <div className="h-40 rounded-xl bg-black"></div>
        <p className="text-lg font-medium">{template.name}</p>
        <p className="text-xs">{template.description}</p>
        <Button variant="minimal" className="w-full justify-center border border-black" loading={isLoading}>
          Start with template
        </Button>
      </div>
    );
  }

  if (!isOpen) return null;

  const newSurveyFromTemplate = async (template: TTemplate) => {
    setLoadingStates((prev) => ({ ...prev, [template.name]: true }));
    localStorage.removeItem("isNewUser");
    try {
      const survey = await createSurveyFromTemplate(template, environment, "link");
      router.push(`/environments/${environment.id}/surveys/${survey.id}/edit`);
    } catch (e) {
      toast.error("An error occurred creating a new survey");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [template.name]: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-500 bg-opacity-30 backdrop-blur-md">
      <div className="relative w-[70rem] rounded-xl bg-slate-50 p-10">
        <X
          className="absolute right-0 top-0 m-4 h-6 w-6 cursor-pointer text-slate-500"
          onClick={() => {
            localStorage.removeItem("isNewUser");
            setIsOpen(false);
          }}
        />
        <div className="p-6">
          <div className="flex justify-between">
            <p className="text-2xl font-medium">Create your first survey</p>
            <Button
              onClick={() => {
                newSurveyFromTemplate(customSurvey);
              }}>
              Start from scratch <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid w-full grid-cols-3 grid-rows-1 gap-6">
            {templates.map((template) => (
              <TemplateOption key={template.name} template={template} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
