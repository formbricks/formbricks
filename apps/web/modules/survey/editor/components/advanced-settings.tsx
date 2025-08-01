import { ConditionalLogic } from "@/modules/survey/editor/components/conditional-logic";
import { OptionIds } from "@/modules/survey/editor/components/option-ids";
import { UpdateQuestionId } from "@/modules/survey/editor/components/update-question-id";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

interface AdvancedSettingsProps {
  question: TSurveyQuestion;
  questionIdx: number;
  localSurvey: TSurvey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  selectedLanguageCode: string;
}

export const AdvancedSettings = ({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
  selectedLanguageCode,
}: AdvancedSettingsProps) => {
  const showOptionIds =
    question.type === TSurveyQuestionTypeEnum.PictureSelection ||
    question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
    question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
    question.type === TSurveyQuestionTypeEnum.Ranking;

  return (
    <div className="flex flex-col gap-4">
      <ConditionalLogic
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
      />

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
