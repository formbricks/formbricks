"use client";

import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct, TProductIndustry } from "@formbricks/types/product";
import { TSurveyType } from "@formbricks/types/surveys";
import { TTemplateRole } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { TemplateList } from "@formbricks/ui/TemplateList";

interface SurveyStarterProps {
  environmentId: string;
  environment: TEnvironment;
  product: TProduct;
  user: TUser;
  prefilledFilters: (TSurveyType | TProductIndustry | TTemplateRole | null)[];
}

export const SurveyStarter = ({
  environmentId,
  environment,
  product,
  user,
  prefilledFilters,
}: SurveyStarterProps) => {
  return (
    <>
      <h1 className="px-6 text-3xl font-extrabold text-slate-700">
        You&apos;re all set! Time to create your first survey.
      </h1>

      <TemplateList
        environmentId={environmentId}
        onTemplateClick={() => {}}
        environment={environment}
        product={product}
        user={user}
        prefilledFilters={prefilledFilters}
      />
    </>
  );
};
