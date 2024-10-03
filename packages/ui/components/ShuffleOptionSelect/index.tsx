import {
  TShuffleOption,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyRankingQuestion,
} from "@formbricks/types/surveys/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Select";

type ShuffleOptionType = {
  id: string;
  label: string;
  show: boolean;
};

type ShuffleOptionsTypes = {
  none?: ShuffleOptionType;
  all?: ShuffleOptionType;
  exceptLast?: ShuffleOptionType;
};

interface ShuffleOptionSelectInterface {
  shuffleOption: TShuffleOption | undefined;
  updateQuestion: (
    questionIdx: number,
    updatedAttributes: Partial<TSurveyMatrixQuestion | TSurveyMultipleChoiceQuestion | TSurveyRankingQuestion>
  ) => void;
  questionIdx: number;
  shuffleOptionsTypes: ShuffleOptionsTypes;
}

export const ShuffleOptionSelect: React.FC<ShuffleOptionSelectInterface> = ({
  questionIdx,
  shuffleOption,
  updateQuestion,
  shuffleOptionsTypes,
}) => {
  return (
    <Select
      defaultValue={shuffleOption}
      value={shuffleOption}
      onValueChange={(e: TShuffleOption) => {
        updateQuestion(questionIdx, { shuffleOption: e });
      }}>
      <SelectTrigger className="w-fit space-x-2 overflow-hidden border-0 font-medium text-slate-600">
        <SelectValue placeholder="Select ordering" />
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
