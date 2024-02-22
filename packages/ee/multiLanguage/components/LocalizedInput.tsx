import { extractLanguageCodes, isLabelValidForAllLanguages } from "@formbricks/lib/i18n/utils";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
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
  updateQuestion?: (questionIdx: number, data: Partial<TSurveyQuestion>) => void;
  updateSurvey?: (data: Partial<TSurveyQuestion>) => void;
  updateChoice?: (choiceIdx: number, data: Partial<TSurveyChoice>) => void;
  questionIdx: number;
  setSelectedLanguage: (language: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
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
  maxLength,
  className,
}: LocalizedInputProps) => {
  const isThankYouCard = questionIdx === localSurvey.questions.length;
  const isWelcomeCard = questionIdx === -1;
  const surveyLanguageIds = extractLanguageCodes(localSurvey.languages);

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
      ? value["default"]?.trim() !== "" &&
        isInvalid &&
        !isLabelValidForAllLanguages(value, surveyLanguageIds) &&
        selectedLanguage === "default"
      : isInvalid &&
        !isLabelValidForAllLanguages(value, surveyLanguageIds) &&
        selectedLanguage === "default");

  return (
    <div className="relative w-full">
      <QuestionFormInput
        id={id}
        localSurvey={localSurvey}
        environmentId={localSurvey.environmentId}
        isInvalid={localSurvey.languages?.length > 1 && isInComplete}
        label={label}
        questionId={questionId()}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        updateSurvey={updateSurvey}
        updateChoice={updateChoice}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        maxLength={maxLength}
        placeholder={placeholder}
        onBlur={onBlur}
        className={className}
      />
      {value && selectedLanguage !== "default" && value["default"] && (
        <div className="mt-1 text-xs text-gray-500">
          <strong>Translate:</strong> {recallToHeadline(value, localSurvey, false, "default")["default"]}
        </div>
      )}
      {localSurvey.languages?.length > 1 && isInComplete && (
        <div className="mt-1 text-xs text-red-400">Contains Incomplete translations</div>
      )}
    </div>
  );
};

export default LocalizedInput;
