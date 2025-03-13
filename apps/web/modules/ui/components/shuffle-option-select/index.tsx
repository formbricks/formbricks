"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import {
  TShuffleOption,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyRankingQuestion,
} from "@formbricks/types/surveys/types";

interface ShuffleOptionType {
  id: string;
  label: string;
  show: boolean;
}

interface ShuffleOptionsTypes {
  none?: ShuffleOptionType;
  all?: ShuffleOptionType;
  exceptLast?: ShuffleOptionType;
  exceptLastTwo?: ShuffleOptionType;
}

interface ShuffleOptionSelectProps {
  shuffleOption: TShuffleOption | undefined;
  updateQuestion: (
    questionIdx: number,
    updatedAttributes: Partial<TSurveyMatrixQuestion | TSurveyMultipleChoiceQuestion | TSurveyRankingQuestion>
  ) => void;
  questionIdx: number;
  shuffleOptionsTypes: ShuffleOptionsTypes;
}

export const ShuffleOptionSelect: React.FC<ShuffleOptionSelectProps> = ({
  questionIdx,
  shuffleOption,
  updateQuestion,
  shuffleOptionsTypes,
}) => {
  const { t } = useTranslate();
  return (
    <Select
      defaultValue={shuffleOption}
      value={shuffleOption}
      onValueChange={(e: TShuffleOption) => {
        updateQuestion(questionIdx, { shuffleOption: e });
      }}>
      <SelectTrigger className="w-fit space-x-2 overflow-hidden border-0 font-medium text-slate-600">
        <SelectValue placeholder={t("environments.surveys.edit.select_ordering")} />
      </SelectTrigger>
      <SelectContent>
        {Object.values(shuffleOptionsTypes).map(
          (shuffleOptionsType) =>
            shuffleOptionsType.show && (
              <SelectItem
                key={shuffleOptionsType.id}
                value={shuffleOptionsType.id}
                title={shuffleOptionsType.label}>
                {shuffleOptionsType.label}
              </SelectItem>
            )
        )}
      </SelectContent>
    </Select>
  );
};
