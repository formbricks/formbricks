"use client";

import TemplateList from "@/app/(app)/environments/[environmentId]/surveys/templates/TemplateList";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct } from "@formbricks/types/product";
import { TSurveyInput } from "@formbricks/types/surveys";
import { TTeam } from "@formbricks/types/teams";
import { TTemplate } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";

import { createSurveyAction } from "../actions";

export default function SurveyStarter({
  environmentId,
  environment,
  product,
  team,
  user,
}: {
  environmentId: string;
  environment: TEnvironment;
  product: TProduct;
  team: TTeam;
  user: TUser;
}) {
  const [isCreateSurveyLoading, setIsCreateSurveyLoading] = useState(false);
  const router = useRouter();
  const newSurveyFromTemplate = async (template: TTemplate) => {
    setIsCreateSurveyLoading(true);
    const surveyType = environment?.widgetSetupCompleted ? "web" : "link";
    const autoComplete = surveyType === "web" ? 50 : null;
    const augmentedTemplate = {
      ...template.preset,
      type: surveyType,
      autoComplete,
    } as TSurveyInput;
    try {
      const survey = await createSurveyAction(environmentId, augmentedTemplate);
      router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
    } catch (e) {
      toast.error("An error occured creating a new survey");
      setIsCreateSurveyLoading(false);
    }
  };
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col py-12">
      {isCreateSurveyLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="px-7 pb-4">
            <h1 className="text-3xl font-extrabold text-slate-700">
              You&apos;re all set! Time to create your first survey.
            </h1>
          </div>
          <TemplateList
            environmentId={environmentId}
            onTemplateClick={(template) => {
              newSurveyFromTemplate(template);
            }}
            environment={environment}
            product={product}
            team={team}
            user={user}
          />
        </>
      )}
    </div>
  );
}
