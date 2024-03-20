"use client";

import {
  customSurvey,
  templates,
} from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import OnboardingTitle from "@/app/(app)/onboarding/components/OnboardingTitle";
import ChurnImage from "@/images/onboarding-churn.png";
import FeedbackImage from "@/images/onboarding-collect-feedback.png";
import NPSImage from "@/images/onboarding-nps.png";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TTemplate } from "@formbricks/types/templates";
import { Button } from "@formbricks/ui/Button";
import { OptionCard } from "@formbricks/ui/OptionCard";

import { createSurveyFromTemplate, finishOnboardingAction } from "../../actions";

interface CreateFirstSurveyProps {
  environmentId: string;
}

export function CreateFirstSurvey({ environmentId }: CreateFirstSurveyProps) {
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const templateOrder = ["Collect Feedback", "Net Promoter Score (NPS)", "Churn Survey"];
  const templateImages = {
    "Collect Feedback": FeedbackImage,
    "Net Promoter Score (NPS)": NPSImage,
    "Churn Survey": ChurnImage,
  };

  const filteredTemplates = templates
    .filter((template) => templateOrder.includes(template.name))
    .sort((a, b) => templateOrder.indexOf(a.name) - templateOrder.indexOf(b.name));

  const newSurveyFromTemplate = async (template: TTemplate) => {
    setLoadingTemplate(template.name);
    if (typeof localStorage !== undefined) {
      localStorage.removeItem("onboardingPathway");
      localStorage.removeItem("onboardingCurrentStep");
    }
    await finishOnboardingAction();
    try {
      const survey = await createSurveyFromTemplate(template, environmentId);
      router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
    } catch (e) {
      toast.error("An error occurred creating a new survey");
    }
  };

  return (
    <div className="flex flex-col items-center space-y-16">
      <OnboardingTitle title="Create your first survey" subtitle="Pick a template or start from scratch." />
      <div className="grid w-11/12 max-w-6xl grid-cols-3 grid-rows-1 gap-6">
        {filteredTemplates.map((template) => {
          const TemplateImage = templateImages[template.name];
          const cssId = `onboarding-link-template-${template.name.toLowerCase().replace(/ /g, "-")}`;
          return (
            <OptionCard
              cssId={cssId} // Use the generated cssId here
              size="md"
              key={template.name}
              title={template.name}
              description={template.description}
              onSelect={() => newSurveyFromTemplate(template)}
              loading={loadingTemplate === template.name}>
              <Image src={TemplateImage} alt={template.name} className="rounded-md border border-slate-300" />
            </OptionCard>
          );
        })}
      </div>

      <Button
        id="onboarding-start-from-scratch"
        size="lg"
        variant="secondary"
        loading={loadingTemplate === "Start from scratch"}
        onClick={() => {
          newSurveyFromTemplate(customSurvey);
        }}>
        Start from scratch <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
