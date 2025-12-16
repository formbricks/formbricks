import { useEffect, useRef } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import {
  TSurveyElement,
  TSurveyElementChoice,
  TSurveyElementTypeEnum,
} from "@formbricks/types/surveys/elements";
import { AddressElement } from "@/components/elements/address-element";
import { CalElement } from "@/components/elements/cal-element";
import { ConsentElement } from "@/components/elements/consent-element";
import { ContactInfoElement } from "@/components/elements/contact-info-element";
import { CTAElement } from "@/components/elements/cta-element";
import { DateElement } from "@/components/elements/date-element";
import { FileUploadElement } from "@/components/elements/file-upload-element";
import { MatrixElement } from "@/components/elements/matrix-element";
import { MultipleChoiceMultiElement } from "@/components/elements/multiple-choice-multi-element";
import { MultipleChoiceSingleElement } from "@/components/elements/multiple-choice-single-element";
import { NPSElement } from "@/components/elements/nps-element";
import { OpenTextElement } from "@/components/elements/open-text-element";
import { PictureSelectionElement } from "@/components/elements/picture-selection-element";
import { RankingElement } from "@/components/elements/ranking-element";
import { RatingElement } from "@/components/elements/rating-element";
import { getLocalizedValue } from "@/lib/i18n";

interface ElementConditionalProps {
  element: TSurveyElement;
  value: TResponseDataValue;
  onChange: (responseData: TResponseData) => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  surveyId: string;
  autoFocusEnabled: boolean;
  currentElementId: string;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  dir?: "ltr" | "rtl" | "auto";
  formRef?: (ref: HTMLFormElement | null) => void; // Callback to expose the form element
  onTtcCollect?: (elementId: string, ttc: number) => void; // Callback to collect TTC synchronously
}

export function ElementConditional({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  surveyId,
  onFileUpload,
  autoFocusEnabled,
  currentElementId,
  onOpenExternalURL,
  dir,
  formRef,
  onTtcCollect,
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

  // Wrap setTtc to also call onTtcCollect synchronously
  // This allows the block to collect TTC values without waiting for async state updates
  const wrappedSetTtc = (newTtc: TResponseTtc) => {
    setTtc(newTtc);
    // Extract this element's TTC and call the collector if provided
    if (onTtcCollect && newTtc[element.id] !== undefined) {
      onTtcCollect(element.id, newTtc[element.id]);
    }
  };

  const getResponseValueForRankingElement = (value: string[], choices: TSurveyElementChoice[]): string[] => {
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
    // NOSONAR - This is readable enough and can't be changed
    switch (element.type) {
      case TSurveyElementTypeEnum.OpenText:
        return (
          <OpenTextElement
            key={element.id}
            element={element}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
        return (
          <MultipleChoiceSingleElement
            key={element.id}
            element={element}
            value={typeof value === "string" ? value : undefined}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        return (
          <MultipleChoiceMultiElement
            key={element.id}
            element={element}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.NPS:
        return (
          <NPSElement
            key={element.id}
            element={element}
            value={typeof value === "number" ? value : undefined}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.CTA:
        return (
          <CTAElement
            key={element.id}
            element={element}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            onOpenExternalURL={onOpenExternalURL}
          />
        );
      case TSurveyElementTypeEnum.Rating:
        return (
          <RatingElement
            key={element.id}
            element={element}
            value={typeof value === "number" ? value : undefined}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.Consent:
        return (
          <ConsentElement
            key={element.id}
            element={element}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.Date:
        return (
          <DateElement
            key={element.id}
            element={element}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
          />
        );
      case TSurveyElementTypeEnum.PictureSelection:
        return (
          <PictureSelectionElement
            key={element.id}
            element={element}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.FileUpload:
        return (
          <FileUploadElement
            key={element.id}
            surveyId={surveyId}
            element={element}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
            onFileUpload={onFileUpload}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
          />
        );
      case TSurveyElementTypeEnum.Cal:
        return (
          <CalElement
            key={element.id}
            element={element}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
          />
        );
      case TSurveyElementTypeEnum.Matrix:
        return (
          <MatrixElement
            element={element}
            value={typeof value === "object" && !Array.isArray(value) ? value : {}}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
          />
        );
      case TSurveyElementTypeEnum.Address:
        return (
          <AddressElement
            element={element}
            value={Array.isArray(value) ? value : undefined}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            autoFocusEnabled={autoFocusEnabled}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.Ranking:
        return (
          <RankingElement
            element={element}
            value={Array.isArray(value) ? getResponseValueForRankingElement(value, element.choices) : []}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
          />
        );
      case TSurveyElementTypeEnum.ContactInfo:
        return (
          <ContactInfoElement
            element={element}
            value={Array.isArray(value) ? value : undefined}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
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
