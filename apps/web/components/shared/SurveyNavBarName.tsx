"use client";

import { useSurvey } from "@/lib/surveys/surveys";
import { TProduct } from "@formbricks/types/v1/product";

interface SurveyNavBarNameProps {
  surveyId: string;
  environmentId: string;
  product: TProduct;
}

export default function SurveyNavBarName({ surveyId, environmentId, product }: SurveyNavBarNameProps) {
  const { survey } = useSurvey(environmentId, surveyId);

  return (
    <div className="hidden items-center space-x-2 whitespace-nowrap md:flex">
      {/*       <Button
        variant="secondary"
        StartIcon={ArrowLeftIcon}
        onClick={() => {
          router.back();
        }}>
        Back
      </Button> */}
      <p className="pl-4 font-semibold">{product.name} / </p>
      <span>{survey.name}</span>
    </div>
  );
}
