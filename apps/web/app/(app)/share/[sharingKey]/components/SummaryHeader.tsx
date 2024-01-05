"use client";

import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

interface SummaryHeaderProps {
  survey: TSurvey;
  product: TProduct;
}
const SummaryHeader = ({ survey, product }: SummaryHeaderProps) => {
  return (
    <div className="mb-11 mt-6 flex flex-wrap items-center justify-between">
      <div>
        <p className="text-3xl font-bold text-slate-800">{survey.name}</p>
        <span className="text-base font-extralight text-slate-600">{product.name}</span>
      </div>
    </div>
  );
};

export default SummaryHeader;
