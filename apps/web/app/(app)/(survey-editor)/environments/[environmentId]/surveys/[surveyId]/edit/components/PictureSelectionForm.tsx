import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { FileInput } from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";

interface PictureSelectionFormProps {
  localSurvey: TSurvey;
  question: TSurveyPictureSelectionQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyPictureSelectionQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
}

export const PictureSelectionForm = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  attributeClasses,
}: PictureSelectionFormProps): JSX.Element => {
  const environmentId = localSurvey.environmentId;
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

  const handleChoiceDeletion = (choiceValue: string) => {
    // Filter out the deleted choice from the choices array
    const newChoices = question.choices?.filter((choice) => choice.id !== choiceValue) || [];

    // Update the logic, removing the deleted choice value
    const newLogic =
      question.logic?.map((logic) => {
        let updatedValue = logic.value;

        if (Array.isArray(logic.value)) {
          updatedValue = logic.value.filter((value) => value !== choiceValue);
        } else if (logic.value === choiceValue) {
          updatedValue = undefined;
        }

        return { ...logic, value: updatedValue };
      }) || [];

    // Update the question with new choices and logic
    updateQuestion(questionIdx, { choices: newChoices, logic: newLogic });
  };

  const handleFileInputChanges = (urls: string[]) => {
    // Handle choice deletion
    if (urls.length < question.choices.length) {
      const deletedChoice = question.choices.find((choice) => !urls.includes(choice.imageUrl));
      if (deletedChoice) {
        handleChoiceDeletion(deletedChoice.id);
      }
    }

    // Handle choice addition
    const updatedChoices = urls.map((url) => {
      const existingChoice = question.choices.find((choice) => choice.imageUrl === url);
      return existingChoice ? { ...existingChoice } : { imageUrl: url, id: createId() };
    });

    updateQuestion(questionIdx, {
      choices: updatedChoices,
    });
  };

  return (
    <form>
      <QuestionFormInput
        id="headline"
        label={"Question*"}
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />
      <div>
        {question.subheader !== undefined && (
          <div className="mt-2 inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      <div className="mt-2">
        <Label htmlFor="Images">
          Images{" "}
          <span
            className={cn("text-slate-400", {
              "text-red-600": isInvalid && question.choices?.length < 2,
            })}>
            (Upload at least 2 images)
          </span>
        </Label>
        <div className="mt-3 flex w-full items-center justify-center">
          <FileInput
            id="choices-file-input"
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={handleFileInputChanges}
            fileUrl={question?.choices?.map((choice) => choice.imageUrl)}
            multiple={true}
          />
        </div>
      </div>

      <div className="my-4 flex items-center space-x-2">
        <Switch
          id="multi-select-toggle"
          checked={question.allowMulti}
          onClick={(e) => {
            e.stopPropagation();
            updateQuestion(questionIdx, { allowMulti: !question.allowMulti });
          }}
        />
        <Label htmlFor="multi-select-toggle" className="cursor-pointer">
          <div className="ml-2">
            <h3 className="text-sm font-semibold text-slate-700">Allow Multi Select</h3>
            <p className="text-xs font-normal text-slate-500">Allow users to select more than one image.</p>
          </div>
        </Label>
      </div>
    </form>
  );
};
