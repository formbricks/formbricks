"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyElement, TSurveySignatureElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import {
  isTypedSignatureAllowed,
  shouldWarnTypedSignatureOff,
} from "@/modules/survey/editor/lib/signature-element";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";

interface SignatureElementFormProps {
  localSurvey: TSurvey;
  element: TSurveySignatureElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyElement>) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const SignatureElementForm = ({
  element,
  elementIdx,
  updateElement,
  isInvalid,
  localSurvey,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: SignatureElementFormProps): JSX.Element => {
  const { t } = useTranslation();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const [parent] = useAutoAnimate();

  const allowTypedSignature = isTypedSignatureAllowed(element);

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
            variant="secondary"
            className="mt-3"
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

      <div className="mt-6 space-y-3">
        <AdvancedOptionToggle
          isChecked={allowTypedSignature}
          onToggle={(checked) => updateElement(elementIdx, { allowTypedSignature: checked })}
          htmlId={`allow-typed-signature-${element.id}`}
          title={t("workspace.surveys.edit.allow_typed_signature")}
          description={t("workspace.surveys.edit.allow_typed_signature_description")}
          childBorder
          customContainerClass="p-0"
        />
        {shouldWarnTypedSignatureOff(element) && (
          <Alert variant="warning" role="status">
            <AlertTitle>{t("workspace.surveys.edit.typed_signature_off_warning_title")}</AlertTitle>
            <AlertDescription>
              {t("workspace.surveys.edit.typed_signature_off_warning_description")}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </form>
  );
};
