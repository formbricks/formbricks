"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyElement, TSurveyFileUploadElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Button } from "@/modules/ui/components/button";

interface FileUploadFormProps {
  readonly localSurvey: TSurvey;
  readonly element: TSurveyFileUploadElement;
  readonly elementIdx: number;
  readonly updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyElement>) => void;
  readonly isInvalid: boolean;
  readonly locale: TUserLocale;
  readonly isStorageConfigured: boolean;
  readonly isExternalUrlsAllowed?: boolean;
}

export const FileUploadElementForm = ({
  localSurvey,
  element,
  elementIdx,
  updateElement,
  isInvalid,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: FileUploadFormProps): JSX.Element => {
  const { t } = useTranslation();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

  const [parent] = useAutoAnimate();

  return (
    <form>
      <ElementFormInput
        id="headline"
        value={element.headline}
        label={t("workspace.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        elementIdx={elementIdx}
        isInvalid={isInvalid}
        updateElement={updateElement}
        locale={locale}
        isStorageConfigured={isStorageConfigured}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
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
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                autoFocus={!element.subheader?.default || element.subheader.default.trim() === ""}
                isExternalUrlsAllowed={isExternalUrlsAllowed}
              />
            </div>
          </div>
        )}
        {element.subheader === undefined && (
          <Button
            size="sm"
            className="mt-3"
            variant="secondary"
            type="button"
            onClick={() => {
              updateElement(elementIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 size-4" />
            {t("workspace.surveys.edit.add_description")}
          </Button>
        )}
      </div>
    </form>
  );
};
