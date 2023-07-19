"use client";
import { Template } from "@/../../packages/types/templates";
import { createSurveyAction } from "@/app/environments/[environmentId]/actions";
import TemplateList from "@/app/environments/[environmentId]/surveys/templates/TemplateList";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import type { TEnvironment } from "@formbricks/types/v1/environment";
import type { TProduct } from "@formbricks/types/v1/product";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

export default function SurveyStarter({
  environmentId,
  environment,
  product,
}: {
  environmentId: string;
  environment: TEnvironment;
  product: TProduct;
}) {
  const [isCreateSurveyLoading, setIsCreateSurveyLoading] = useState(false);
  const router = useRouter();
  const newSurveyFromTemplate = async (template: Template) => {
    setIsCreateSurveyLoading(true);
    const augmentedTemplate = {
      ...template.preset,
      type: environment?.widgetSetupCompleted ? "web" : "link",
    };
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
          />
        </>
      )}
    </div>
  );
}
