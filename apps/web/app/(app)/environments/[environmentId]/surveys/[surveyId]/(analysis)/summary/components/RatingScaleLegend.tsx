"use client";

import { TSurveyRatingQuestion } from "@formbricks/types/surveys/types";
import { RatingResponse } from "@/modules/ui/components/rating-response";

interface RatingScaleLegendProps {
  scale: TSurveyRatingQuestion["scale"];
  range: number;
}

export const RatingScaleLegend = ({ scale, range }: RatingScaleLegendProps) => {
  return (
    <div className="mt-3 flex w-full items-start justify-between px-1">
      <div className="flex items-center space-x-1">
        <RatingResponse scale={scale} answer={1} range={range} addColors={false} variant="scale" />
        <span className="text-xs text-slate-500">1</span>
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-xs text-slate-500">{range}</span>
        <RatingResponse scale={scale} answer={range} range={range} addColors={false} variant="scale" />
      </div>
    </div>
  );
};
