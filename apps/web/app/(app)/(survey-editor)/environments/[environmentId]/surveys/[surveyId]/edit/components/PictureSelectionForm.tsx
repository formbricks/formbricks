import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@formbricks/lib/cn";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { FileInput } from "@formbricks/ui/components/FileInput";
import { Label } from "@formbricks/ui/components/Label";
import { QuestionFormInput } from "@formbricks/ui/components/QuestionFormInput";
import { Switch } from "@formbricks/ui/components/Switch";

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
  locale: TUserLocale;
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
  locale,
}: PictureSelectionFormProps): JSX.Element => {
  const environmentId = localSurvey.environmentId;
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const t = useTranslations();
  const handleChoiceDeletion = (choiceValue: string) => {
    // Filter out the deleted choice from the choices array
    const newChoices = question.choices?.filter((choice) => choice.id !== choiceValue) || [];

    // Update the question with new choices and logic
    updateQuestion(questionIdx, {
      choices: newChoices,
    });
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
  // Auto animate
  const [parent] = useAutoAnimate();
  return (
    <form>
      <QuestionFormInput
        id="headline"
        label={t("environments.surveys.edit.question") + "*"}
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
        locale={locale}
      />
      <div ref={parent}>
        {question.subheader !== undefined && (
          <div className="mt-2 inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
                locale={locale}
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
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>
      <div className="mt-2">
        <Label htmlFor="Images">
          {t("common.images")}{" "}
          <span
            className={cn("text-slate-400", {
              "text-red-600": isInvalid && question.choices?.length < 2,
            })}>
            ({t("environments.surveys.edit.upload_at_least_2_images")})
          </span>
        </Label>
        <div className="mt-3 flex w-full items-center justify-center">
          <FileInput
            id="choices-file-input"
            allowedFileExtensions={["png", "jpeg", "jpg", "webp"]}
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
            <h3 className="text-sm font-semibold text-slate-700">
              {t("environments.surveys.edit.allow_multi_select")}
            </h3>
            <p className="text-xs font-normal text-slate-500">
              {t("environments.surveys.edit.allow_users_to_select_more_than_one_image")}
            </p>
          </div>
        </Label>
      </div>
    </form>
  );
};
