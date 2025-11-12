import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ConditionalLogic } from "@/modules/survey/editor/components/conditional-logic";
import { OptionIds } from "@/modules/survey/editor/components/option-ids";
import { UpdateQuestionId } from "@/modules/survey/editor/components/update-question-id";

interface AdvancedSettingsProps {
  question: TSurveyElement;
  questionIdx: number;
  localSurvey: TSurvey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (questionIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (questionIdx: number, logicFallback: string | undefined) => void;
  selectedLanguageCode: string;
}

export const AdvancedSettings = ({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
  updateBlockLogic,
  updateBlockLogicFallback,
  selectedLanguageCode,
}: AdvancedSettingsProps) => {
  const showOptionIds =
    question.type === TSurveyElementTypeEnum.PictureSelection ||
    question.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    question.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
    question.type === TSurveyElementTypeEnum.Ranking;

  return (
    <div className="flex flex-col gap-4">
      {/* TODO: Re-enable ConditionalLogic in post-MVP */}
      {/* <ConditionalLogic
        question={question}
        updateQuestion={updateQuestion}
        updateBlockLogic={updateBlockLogic}
        updateBlockLogicFallback={updateBlockLogicFallback}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
      /> */}

      <UpdateQuestionId
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        updateQuestion={updateQuestion}
      />

      {showOptionIds && <OptionIds question={question} selectedLanguageCode={selectedLanguageCode} />}
    </div>
  );
};
