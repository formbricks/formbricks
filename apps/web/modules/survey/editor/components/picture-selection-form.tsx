"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyPictureSelectionElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Button } from "@/modules/ui/components/button";
import { FileInput } from "@/modules/ui/components/file-input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface PictureSelectionFormProps {
  localSurvey: TSurvey;
  element: TSurveyPictureSelectionElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyPictureSelectionElement>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
}

export const PictureSelectionForm = ({
  localSurvey,
  element,
  elementIdx,
  updateElement,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  locale,
  isStorageConfigured = true,
}: PictureSelectionFormProps): JSX.Element => {
  const environmentId = localSurvey.environmentId;
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const { t } = useTranslation();
  const handleChoiceDeletion = (choiceValue: string) => {
    // Filter out the deleted choice from the choices array
    const newChoices = element.choices?.filter((choice) => choice.id !== choiceValue) || [];

    // Update the element with new choices and logic
    updateElement(elementIdx, {
      choices: newChoices,
    });
  };

  const handleFileInputChanges = (urls: string[]) => {
    // Handle choice deletion
    if (urls.length < element.choices.length) {
      const deletedChoice = element.choices.find((choice) => !urls.includes(choice.imageUrl));
      if (deletedChoice) {
        handleChoiceDeletion(deletedChoice.id);
      }
    }

    // Handle choice addition
    const updatedChoices = urls.map((url) => {
      const existingChoice = element.choices.find((choice) => choice.imageUrl === url);
      return existingChoice ? { ...existingChoice } : { imageUrl: url, id: createId() };
    });

    updateElement(elementIdx, {
      choices: updatedChoices,
    });
  };

  const [parent] = useAutoAnimate();
  return (
    <form>
      <ElementFormInput
        id="headline"
        value={element.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        elementIdx={elementIdx}
        isInvalid={isInvalid}
        updateElement={updateElement}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        isStorageConfigured={isStorageConfigured}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
      />
      <div ref={parent}>
        {element.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <ElementFormInput
                id="subheader"
                value={element.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                elementIdx={elementIdx}
                isInvalid={isInvalid}
                updateElement={updateElement}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                autoFocus={!element.subheader?.default || element.subheader.default.trim() === ""}
              />
            </div>
          </div>
        )}
        {element.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => {
              updateElement(elementIdx, {
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
              "text-red-600": isInvalid && element.choices?.length < 2,
            })}>
            ({t("environments.surveys.edit.upload_at_least_2_images")})
          </span>
        </Label>
        <div className="mt-3 flex w-full items-center justify-center">
          <FileInput
            id="choices-file-input"
            allowedFileExtensions={["png", "jpeg", "jpg", "webp", "heic"]}
            environmentId={environmentId}
            onFileUpload={handleFileInputChanges}
            fileUrl={element?.choices?.map((choice) => choice.imageUrl)}
            multiple={true}
            maxSizeInMB={5}
            isStorageConfigured={isStorageConfigured}
          />
        </div>
      </div>

      <div className="my-4 flex items-center space-x-2">
        <Switch
          id="multi-select-toggle"
          checked={element.allowMulti}
          onClick={(e) => {
            e.stopPropagation();
            updateElement(elementIdx, { allowMulti: !element.allowMulti });
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
