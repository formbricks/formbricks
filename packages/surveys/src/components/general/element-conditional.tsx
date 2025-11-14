import { useEffect, useRef } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurveyQuestionChoice } from "@formbricks/types/surveys/types";
import { AddressQuestion } from "@/components/questions/address-question";
import { CalQuestion } from "@/components/questions/cal-question";
import { ConsentQuestion } from "@/components/questions/consent-question";
import { ContactInfoQuestion } from "@/components/questions/contact-info-question";
import { CTAQuestion } from "@/components/questions/cta-question";
import { DateQuestion } from "@/components/questions/date-question";
import { FileUploadQuestion } from "@/components/questions/file-upload-question";
import { MatrixQuestion } from "@/components/questions/matrix-question";
import { MultipleChoiceMultiQuestion } from "@/components/questions/multiple-choice-multi-question";
import { MultipleChoiceSingleQuestion } from "@/components/questions/multiple-choice-single-question";
import { NPSQuestion } from "@/components/questions/nps-question";
import { OpenTextQuestion } from "@/components/questions/open-text-question";
import { PictureSelectionQuestion } from "@/components/questions/picture-selection-question";
import { RankingQuestion } from "@/components/questions/ranking-question";
import { RatingQuestion } from "@/components/questions/rating-question";
import { getLocalizedValue } from "@/lib/i18n";

interface ElementConditionalProps {
  element: TSurveyElement;
  value: TResponseDataValue;
  onChange: (responseData: TResponseData) => void;
  onBack: () => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  isFirstElement: boolean;
  isLastElement: boolean;
  languageCode: string;
  prefilledElementValue?: TResponseDataValue;
  skipPrefilled?: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  surveyId: string;
  autoFocusEnabled: boolean;
  currentElementId: string;
  isBackButtonHidden: boolean;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  dir?: "ltr" | "rtl" | "auto";
  formRef?: (ref: HTMLFormElement | null) => void; // Callback to expose the form element
}

export function ElementConditional({
  element,
  value,
  onChange,
  languageCode,
  prefilledElementValue,
  skipPrefilled,
  ttc,
  setTtc,
  surveyId,
  onFileUpload,
  autoFocusEnabled,
  currentElementId,
  onOpenExternalURL,
  dir,
  formRef,
}: ElementConditionalProps) {
  // Ref to the container div, used to find and expose the form element inside
  const containerRef = useRef<HTMLDivElement>(null);

  // Expose the form element to parent via callback
  useEffect(() => {
    if (formRef && containerRef.current) {
      const form = containerRef.current.querySelector("form");
      formRef(form);

      // Cleanup: pass null when unmounting
      return () => formRef(null);
    }
  }, [formRef]);

  const getResponseValueForRankingQuestion = (
    value: string[],
    choices: TSurveyQuestionChoice[]
  ): string[] => {
    return value
      .map((entry) => {
        // First check if entry is already a valid choice ID
        if (choices.some((c) => c.id === entry)) {
          return entry;
        }
        // Otherwise, treat it as a localized label and find the choice by label
        return choices.find((choice) => getLocalizedValue(choice.label, languageCode) === entry)?.id;
      })
      .filter((id): id is TSurveyQuestionChoice["id"] => id !== undefined);
  };

  useEffect(() => {
    if (value === undefined && (prefilledElementValue || prefilledElementValue === "")) {
      if (!skipPrefilled) {
        onChange({ [element.id]: prefilledElementValue });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we want to run this only once when the element renders for the first time
  }, []);

  return (
    <div ref={containerRef}>
      {element.type === TSurveyElementTypeEnum.OpenText ? (
        <OpenTextQuestion
          key={element.id}
          question={element}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ? (
        <MultipleChoiceSingleQuestion
          key={element.id}
          question={element}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ? (
        <MultipleChoiceMultiQuestion
          key={element.id}
          question={element}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.NPS ? (
        <NPSQuestion
          key={element.id}
          question={element}
          value={typeof value === "number" ? value : undefined}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.CTA ? (
        <CTAQuestion
          key={element.id}
          question={element}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          onOpenExternalURL={onOpenExternalURL}
        />
      ) : element.type === TSurveyElementTypeEnum.Rating ? (
        <RatingQuestion
          key={element.id}
          question={element}
          value={typeof value === "number" ? value : undefined}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.Consent ? (
        <ConsentQuestion
          key={element.id}
          question={element}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.Date ? (
        <DateQuestion
          key={element.id}
          question={element}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
        />
      ) : element.type === TSurveyElementTypeEnum.PictureSelection ? (
        <PictureSelectionQuestion
          key={element.id}
          question={element}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.FileUpload ? (
        <FileUploadQuestion
          key={element.id}
          surveyId={surveyId}
          question={element}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          onFileUpload={onFileUpload}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
        />
      ) : element.type === TSurveyElementTypeEnum.Cal ? (
        <CalQuestion
          key={element.id}
          question={element}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          currentQuestionId={currentElementId}
        />
      ) : element.type === TSurveyElementTypeEnum.Matrix ? (
        <MatrixQuestion
          question={element}
          value={typeof value === "object" && !Array.isArray(value) ? value : {}}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          currentQuestionId={currentElementId}
        />
      ) : element.type === TSurveyElementTypeEnum.Address ? (
        <AddressQuestion
          question={element}
          value={Array.isArray(value) ? value : undefined}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          currentQuestionId={currentElementId}
          autoFocusEnabled={autoFocusEnabled}
          dir={dir}
        />
      ) : element.type === TSurveyElementTypeEnum.Ranking ? (
        <RankingQuestion
          question={element}
          value={Array.isArray(value) ? getResponseValueForRankingQuestion(value, element.choices) : []}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          autoFocusEnabled={autoFocusEnabled}
          currentQuestionId={currentElementId}
        />
      ) : element.type === TSurveyElementTypeEnum.ContactInfo ? (
        <ContactInfoQuestion
          question={element}
          value={Array.isArray(value) ? value : undefined}
          onChange={onChange}
          languageCode={languageCode}
          ttc={ttc}
          setTtc={setTtc}
          currentQuestionId={currentElementId}
          autoFocusEnabled={autoFocusEnabled}
          dir={dir}
        />
      ) : null}
    </div>
  );
}
