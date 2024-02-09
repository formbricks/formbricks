import { extractLanguageIds, isLabelValidForAllLanguages } from "@formbricks/lib/i18n/utils";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TLanguage } from "@formbricks/types/product";
import { TI18nString, TSurvey, TSurveyChoice, TSurveyQuestion } from "@formbricks/types/surveys";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";

interface LocalizedInputProps {
  id: string;
  name: string;
  value: TI18nString | undefined;
  isInvalid: boolean;
  localSurvey: TSurvey;
  placeholder?: string;
  label?: string;
  selectedLanguage: string;
  defaultLanguageId: string;
  updateQuestion?: (questionIdx: number, data: Partial<TSurveyQuestion>) => void;
  updateSurvey?: (data: Partial<TSurveyQuestion>) => void;
  updateChoice?: (choiceIdx: number, data: Partial<TSurveyChoice>) => void;
  questionIdx: number;
  setSelectedLanguage: (language: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  surveyLanguages: TLanguage[];
  maxLength?: number;
  defaultValue?: string;
  className?: string;
}
const LocalizedInput = ({
  id,
  value,
  isInvalid,
  localSurvey,
  placeholder,
  label,
  selectedLanguage,
  updateQuestion,
  updateSurvey,
  updateChoice,
  questionIdx,
  setSelectedLanguage,
  onBlur,
  surveyLanguages,
  maxLength,
  defaultLanguageId,
  className,
}: LocalizedInputProps) => {
  const isThankYouCard = questionIdx === localSurvey.questions.length;
  const isWelcomeCard = questionIdx === -1;
  const surveyLanguageIds = extractLanguageIds(surveyLanguages);

  const questionId = () => {
    if (isThankYouCard) return "end";
    else if (isWelcomeCard) return "start";
    else return localSurvey.questions[questionIdx].id;
  };

  const isInComplete =
    value !== undefined &&
    (id === "subheader" ||
    id === "lowerLabel" ||
    id === "upperLabel" ||
    id === "buttonLabel" ||
    id === "placeholder" ||
    id === "backButtonLabel"
      ? value[defaultLanguageId]?.trim() !== "" &&
        isInvalid &&
        !isLabelValidForAllLanguages(value, surveyLanguageIds) &&
        selectedLanguage === defaultLanguageId
      : isInvalid &&
        !isLabelValidForAllLanguages(value, surveyLanguageIds) &&
        selectedLanguage === defaultLanguageId);

  return (
    <div className="relative w-full">
      <QuestionFormInput
        id={id}
        localSurvey={localSurvey}
        environmentId={localSurvey.environmentId}
        isInvalid={surveyLanguages.length > 1 && isInComplete}
        label={label}
        questionId={questionId()}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        updateSurvey={updateSurvey}
        updateChoice={updateChoice}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        surveyLanguages={surveyLanguages}
        maxLength={maxLength}
        placeholder={placeholder}
        onBlur={onBlur}
        defaultLanguageId={defaultLanguageId}
        className={className}
      />
      {value && selectedLanguage !== defaultLanguageId && value[defaultLanguageId] && (
        <div className="mt-1 text-xs text-gray-500">
          <strong>Translate:</strong>{" "}
          {recallToHeadline(value, localSurvey, false, defaultLanguageId)[defaultLanguageId]}
        </div>
      )}
      {surveyLanguages.length > 1 && isInComplete && (
        <div className="mt-1 text-xs text-red-400">Contains Incomplete translations</div>
      )}
    </div>
  );
};

export default LocalizedInput;
