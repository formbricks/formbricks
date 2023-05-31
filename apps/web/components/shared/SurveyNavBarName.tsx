"use client";

import { useProduct } from "@/lib/products/products";
import { useSurvey } from "@/lib/surveys/surveys";

interface SurveyNavBarNameProps {
  surveyId: string;
  environmentId: string;
}

export default function SurveyNavBarName({ surveyId, environmentId }: SurveyNavBarNameProps) {
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  if (isLoadingSurvey || isLoadingProduct) {
    return null;
  }

  if (isErrorProduct || isErrorSurvey) {
    return null;
  }

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
