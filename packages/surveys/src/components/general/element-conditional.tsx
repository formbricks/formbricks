import { useEffect, useRef } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import {
  TSurveyElement,
  TSurveyElementChoice,
  TSurveyElementTypeEnum,
} from "@formbricks/types/surveys/elements";
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

  const getResponseValueForRankingQuestion = (value: string[], choices: TSurveyElementChoice[]): string[] => {
    return value
      .map((entry) => {
        // First check if entry is already a valid choice ID
        if (choices.some((c) => c.id === entry)) {
          return entry;
        }
        // Otherwise, treat it as a localized label and find the choice by label
        return choices.find((choice) => getLocalizedValue(choice.label, languageCode) === entry)?.id;
      })
      .filter((id): id is TSurveyElementChoice["id"] => id !== undefined);
  };

  useEffect(() => {
    if (value === undefined && (prefilledElementValue || prefilledElementValue === "")) {
      if (!skipPrefilled) {
        onChange({ [element.id]: prefilledElementValue });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we want to run this only once when the element renders for the first time
  }, []);

  const isRecognizedType = Object.values(TSurveyElementTypeEnum).includes(element.type);

  useEffect(() => {
    if (!isRecognizedType) {
      console.warn(
        `[Formbricks] Unrecognized element type "${element.type}" for element with id "${element.id}". No component will be rendered.`
      );
    }
  }, [element.type, element.id, isRecognizedType]);

  if (!isRecognizedType) {
    return null;
  }

  const renderElement = () => {
    switch (element.type) {
      case TSurveyElementTypeEnum.OpenText:
        return (
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
        );
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
        return (
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
        );
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        return (
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
        );
      case TSurveyElementTypeEnum.NPS:
        return (
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
        );
      case TSurveyElementTypeEnum.CTA:
        return (
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
        );
      case TSurveyElementTypeEnum.Rating:
        return (
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
        );
      case TSurveyElementTypeEnum.Consent:
        return (
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
        );
      case TSurveyElementTypeEnum.Date:
        return (
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
        );
      case TSurveyElementTypeEnum.PictureSelection:
        return (
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
        );
      case TSurveyElementTypeEnum.FileUpload:
        return (
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
        );
      case TSurveyElementTypeEnum.Cal:
        return (
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
        );
      case TSurveyElementTypeEnum.Matrix:
        return (
          <MatrixQuestion
            question={element}
            value={typeof value === "object" && !Array.isArray(value) ? value : {}}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={setTtc}
            currentQuestionId={currentElementId}
          />
        );
      case TSurveyElementTypeEnum.Address:
        return (
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
        );
      case TSurveyElementTypeEnum.Ranking:
        return (
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
        );
      case TSurveyElementTypeEnum.ContactInfo:
        return (
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
        );
      default:
        return null;
    }
  };

  return <div ref={containerRef}>{renderElement()}</div>;
}
