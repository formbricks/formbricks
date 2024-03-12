import { useMemo } from "react";

import { extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TI18nString, TSurvey, TSurveyChoice, TSurveyQuestion } from "@formbricks/types/surveys";

import { QuestionFormInput } from "../QuestionFormInput";
import { determineQuestionId, isValueIncomplete } from "./lib/utils";

interface LocalizedInputProps {
  id: string;
  name: string;
  value: TI18nString | undefined;
  isInvalid: boolean;
  localSurvey: TSurvey;
  placeholder?: string;
  label?: string;
  selectedLanguageCode: string;
  updateQuestion?: (questionIdx: number, data: Partial<TSurveyQuestion>) => void;
  updateSurvey?: (data: Partial<TSurveyQuestion>) => void;
  updateChoice?: (choiceIdx: number, data: Partial<TSurveyChoice>) => void;
  questionIdx: number;
  setSelectedLanguageCode: (language: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  maxLength?: number;
  defaultValue?: string;
  className?: string;
}

export const LocalizedInput = ({
  id,
  value,
  isInvalid,
  localSurvey,
  placeholder,
  label,
  selectedLanguageCode,
  updateQuestion,
  updateSurvey,
  updateChoice,
  questionIdx,
  setSelectedLanguageCode,
  onBlur,
  maxLength,
  className,
}: LocalizedInputProps) => {
  const questionId = useMemo(() => determineQuestionId(questionIdx, localSurvey), [questionIdx, localSurvey]);
  const surveyLanguageCodes = useMemo(
    () => extractLanguageCodes(localSurvey.languages),
    [localSurvey.languages]
  );
  const isInComplete = useMemo(
    () => isValueIncomplete(id, isInvalid, surveyLanguageCodes, value),
    [value, id, isInvalid, surveyLanguageCodes]
  );

  return (
    <div className="relative w-full">
      <QuestionFormInput
        id={id}
        localSurvey={localSurvey}
        isInvalid={localSurvey.languages?.length > 1 && isInComplete}
        label={label}
        questionId={questionId}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        updateSurvey={updateSurvey}
        updateChoice={updateChoice}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        maxLength={maxLength}
        placeholder={placeholder}
        onBlur={onBlur}
        className={className}
      />
      {selectedLanguageCode !== "default" && value && value["default"] && (
        <div className="mt-1 text-xs text-gray-500">
          <strong>Translate:</strong> {recallToHeadline(value, localSurvey, false, "default")["default"]}
        </div>
      )}
      {selectedLanguageCode === "default" && localSurvey.languages?.length > 1 && isInComplete && (
        <div className="mt-1 text-xs text-red-400">Contains Incomplete translations</div>
      )}
    </div>
  );
};
