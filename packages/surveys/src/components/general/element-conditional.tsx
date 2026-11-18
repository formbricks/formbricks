import { useEffect, useRef } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";
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
import { SignatureElement } from "@/components/elements/signature-element";
import { type SubmitContributor } from "@/lib/block-submit";
import { type SignatureDraftStore } from "@/lib/signature-answer";

/** The answer if it is text. */
const asText = (value: TResponseDataValue): string | undefined =>
  typeof value === "string" ? value : undefined;

/** The answer if it is a number. */
const asNumber = (value: TResponseDataValue): number | undefined =>
  typeof value === "number" ? value : undefined;

/** The answer if it is a list. */
const asList = (value: TResponseDataValue): string[] | undefined =>
  Array.isArray(value) ? value : undefined;

/** The answer if it is a record (a matrix answer), else an empty one. */
const asRecord = (value: TResponseDataValue): Record<string, string> =>
  typeof value === "object" && !Array.isArray(value) ? value : {};

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
  errorMessage?: string; // Validation error message from centralized validation
  surveyLanguages: TSurveyLanguage[];
  signatureDrafts: SignatureDraftStore; // The survey's in-memory Signature drawings
  registerSubmitContributor: (elementId: string, contributor: SubmitContributor | null) => void; // Lets an element produce its answer on Next
  disabled?: boolean; // The block is submitting: elements a <fieldset disabled> cannot lock (a canvas) must lock themselves
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
  surveyLanguages,
  errorMessage,
  signatureDrafts,
  registerSubmitContributor,
  disabled,
}: Readonly<ElementConditionalProps>) {
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
    // Each element gets the answer in the shape it stores, or its empty value.
    const text = asText(value);
    const textOrEmpty = text ?? "";
    const list = asList(value);
    const listOrEmpty = list ?? [];
    const numberValue = asNumber(value);
    const recordOrEmpty = asRecord(value);

    // NOSONAR - This is readable enough and can't be changed
    switch (element.type) {
      case TSurveyElementTypeEnum.OpenText:
        return (
          <OpenTextElement
            key={element.id}
            element={element}
            value={textOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
        return (
          <MultipleChoiceSingleElement
            key={element.id}
            element={element}
            value={text}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        return (
          <MultipleChoiceMultiElement
            key={element.id}
            element={element}
            value={listOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.NPS:
        return (
          <NPSElement
            key={element.id}
            element={element}
            value={numberValue}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.CTA:
        return (
          <CTAElement
            key={element.id}
            element={element}
            value={textOrEmpty}
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
            value={numberValue}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.Consent:
        return (
          <ConsentElement
            key={element.id}
            element={element}
            value={textOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.Date:
        return (
          <DateElement
            key={element.id}
            element={element}
            value={textOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            errorMessage={errorMessage}
            surveyLanguages={surveyLanguages}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.PictureSelection:
        return (
          <PictureSelectionElement
            key={element.id}
            element={element}
            value={listOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.FileUpload:
        return (
          <FileUploadElement
            key={element.id}
            surveyId={surveyId}
            element={element}
            value={listOrEmpty}
            onChange={onChange}
            onFileUpload={onFileUpload}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.Signature:
        return (
          <SignatureElement
            key={element.id}
            surveyId={surveyId}
            element={element}
            value={textOrEmpty}
            onChange={onChange}
            onFileUpload={onFileUpload}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            errorMessage={errorMessage}
            dir={dir}
            signatureDrafts={signatureDrafts}
            registerSubmitContributor={registerSubmitContributor}
            disabled={disabled}
          />
        );
      case TSurveyElementTypeEnum.Cal:
        return (
          <CalElement
            key={element.id}
            element={element}
            value={value}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.Matrix:
        return (
          <MatrixElement
            element={element}
            value={recordOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            errorMessage={errorMessage}
            dir={dir}
          />
        );
      case TSurveyElementTypeEnum.Address:
        return (
          <AddressElement
            element={element}
            value={list}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            autoFocusEnabled={autoFocusEnabled}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.Ranking:
        return (
          <RankingElement
            dir={dir}
            element={element}
            value={listOrEmpty}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            autoFocusEnabled={autoFocusEnabled}
            currentElementId={currentElementId}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.CSAT:
      case TSurveyElementTypeEnum.CES:
        return (
          <RatingElement
            key={element.id}
            element={element}
            value={numberValue}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      case TSurveyElementTypeEnum.ContactInfo:
        return (
          <ContactInfoElement
            element={element}
            value={list}
            onChange={onChange}
            languageCode={languageCode}
            ttc={ttc}
            setTtc={wrappedSetTtc}
            currentElementId={currentElementId}
            autoFocusEnabled={autoFocusEnabled}
            dir={dir}
            errorMessage={errorMessage}
          />
        );
      default:
        return null;
    }
  };

  return <div ref={containerRef}>{renderElement()}</div>;
}
