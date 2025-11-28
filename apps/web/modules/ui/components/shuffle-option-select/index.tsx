"use client";

import { useTranslation } from "react-i18next";
import {
  TSurveyMatrixElement,
  TSurveyMultipleChoiceElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { TShuffleOption } from "@formbricks/types/surveys/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface ShuffleOptionType {
  id: string;
  label: string;
  show: boolean;
}

interface ShuffleOptionsTypes {
  none?: ShuffleOptionType;
  all?: ShuffleOptionType;
  exceptLast?: ShuffleOptionType;
}

interface ShuffleOptionSelectProps {
  shuffleOption: TShuffleOption | undefined;
  updateElement: (
    elementIdx: number,
    updatedAttributes: Partial<TSurveyMatrixElement | TSurveyMultipleChoiceElement | TSurveyRankingElement>
  ) => void;
  elementIdx: number;
  shuffleOptionsTypes: ShuffleOptionsTypes;
}

export const ShuffleOptionSelect: React.FC<ShuffleOptionSelectProps> = ({
  elementIdx,
  shuffleOption,
  updateElement,
  shuffleOptionsTypes,
}) => {
  const { t } = useTranslation();
  return (
    <Select
      defaultValue={shuffleOption}
      value={shuffleOption}
      onValueChange={(e: TShuffleOption) => {
        updateElement(elementIdx, { shuffleOption: e });
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
