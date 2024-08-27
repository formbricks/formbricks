"use client";

import { formatTextWithSlashes } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { QUESTIONS_ICON_MAP, getTSurveyQuestionTypeEnumName } from "@/app/lib/questions";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, ChevronRightIcon, GripIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TProduct } from "@formbricks/types/product";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";
import { AddressQuestionForm } from "./AddressQuestionForm";
import { AdvancedSettings } from "./AdvancedSettings";
import { CTAQuestionForm } from "./CTAQuestionForm";
import { CalQuestionForm } from "./CalQuestionForm";
import { ConsentQuestionForm } from "./ConsentQuestionForm";
import { DateQuestionForm } from "./DateQuestionForm";
import { EditorCardMenu } from "./EditorCardMenu";
import { FileUploadQuestionForm } from "./FileUploadQuestionForm";
import { MatrixQuestionForm } from "./MatrixQuestionForm";
import { MultipleChoiceQuestionForm } from "./MultipleChoiceQuestionForm";
import { NPSQuestionForm } from "./NPSQuestionForm";
import { OpenQuestionForm } from "./OpenQuestionForm";
import { PictureSelectionForm } from "./PictureSelectionForm";
import { RatingQuestionForm } from "./RatingQuestionForm";

interface QuestionCardProps {
  localSurvey: TSurvey;
  product: TProduct;
  question: TSurveyQuestion;
  questionIdx: number;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
  duplicateQuestion: (questionIdx: number) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
  addQuestion: (question: any, index?: number) => void;
  isFormbricksCloud: boolean;
}

export const QuestionCard = ({
  localSurvey,
  product,
  question,
  questionIdx,
  moveQuestion,
  updateQuestion,
  duplicateQuestion,
  deleteQuestion,
  activeQuestionId,
  setActiveQuestionId,
  lastQuestion,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  attributeClasses,
  addQuestion,
  isFormbricksCloud,
}: QuestionCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const open = activeQuestionId === question.id;
  const [openAdvanced, setOpenAdvanced] = useState(question.logic && question.logic.length > 0);

  const updateEmptyNextButtonLabels = (labelValue: TI18nString) => {
    localSurvey.questions.forEach((q, index) => {
      if (index === localSurvey.questions.length - 1) return;
      if (!q.buttonLabel || q.buttonLabel[selectedLanguageCode]?.trim() === "") {
        updateQuestion(index, { buttonLabel: labelValue });
      }
    });
  };

  const getIsRequiredToggleDisabled = (): boolean => {
    if (question.type === "address") {
      return [
        question.isAddressLine1Required,
        question.isAddressLine2Required,
        question.isCityRequired,
        question.isCountryRequired,
        question.isStateRequired,
        question.isZipRequired,
      ].some((condition) => condition === true);
    }
    return false;
  };

  const handleRequiredToggle = () => {
    // Fix for NPS and Rating questions having missing translations when buttonLabel is not removed
    if (!question.required && (question.type === "nps" || question.type === "rating")) {
      updateQuestion(questionIdx, { required: true, buttonLabel: undefined });
    } else {
      updateQuestion(questionIdx, { required: !question.required });
    }
  };

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      className={cn(
        open ? "shadow-lg" : "shadow-md",
        "flex w-full flex-row rounded-lg bg-white duration-300"
      )}
      ref={setNodeRef}
      style={style}
      id={question.id}>
      <div
        {...listeners}
        {...attributes}
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "top-0 w-10 rounded-l-lg p-2 text-center text-sm text-white hover:cursor-grab hover:bg-slate-600",
          isInvalid && "bg-red-400 hover:bg-red-600",
          "flex flex-col items-center justify-between"
        )}>
        <div className="mt-3 flex w-full justify-center">{QUESTIONS_ICON_MAP[question.type]}</div>

        <button className="opacity-0 hover:cursor-move group-hover:opacity-100">
          <GripIcon className="h-4 w-4" />
        </button>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={() => {
          if (activeQuestionId !== question.id) {
            setActiveQuestionId(question.id);
          } else {
            setActiveQuestionId(null);
          }
        }}
        className="w-[95%] flex-1 rounded-r-lg border border-slate-200">
        <Collapsible.CollapsibleTrigger
          asChild
          className={cn(
            open ? "" : " ",
            "flex cursor-pointer justify-between gap-4 rounded-r-lg p-4 hover:bg-slate-50"
          )}>
          <div>
            <div className="flex grow">
              {/*  <div className="-ml-0.5 mr-3 h-6 min-w-[1.5rem] text-slate-400">
                {QUESTIONS_ICON_MAP[question.type]}
              </div> */}
              <div className="grow" dir="auto">
                <p className="text-sm font-semibold">
                  {recallToHeadline(
                    question.headline,
                    localSurvey,
                    true,
                    selectedLanguageCode,
                    attributeClasses
                  )[selectedLanguageCode]
                    ? formatTextWithSlashes(
                        recallToHeadline(
                          question.headline,
                          localSurvey,
                          true,
                          selectedLanguageCode,
                          attributeClasses
                        )[selectedLanguageCode] ?? ""
                      )
                    : getTSurveyQuestionTypeEnumName(question.type)}
                </p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {question?.required ? "Required" : "Optional"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <EditorCardMenu
                survey={localSurvey}
                cardIdx={questionIdx}
                lastCard={lastQuestion}
                duplicateCard={duplicateQuestion}
                deleteCard={deleteQuestion}
                moveCard={moveQuestion}
                card={question}
                product={product}
                updateCard={updateQuestion}
                addCard={addQuestion}
                cardType="question"
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-4">
          {question.type === TSurveyQuestionTypeEnum.OpenText ? (
            <OpenQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ? (
            <MultipleChoiceQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ? (
            <MultipleChoiceQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.NPS ? (
            <NPSQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.CTA ? (
            <CTAQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Rating ? (
            <RatingQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Consent ? (
            <ConsentQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Date ? (
            <DateQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.PictureSelection ? (
            <PictureSelectionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.FileUpload ? (
            <FileUploadQuestionForm
              localSurvey={localSurvey}
              product={product}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
              isFormbricksCloud={isFormbricksCloud}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Cal ? (
            <CalQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Matrix ? (
            <MatrixQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Address ? (
            <AddressQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              attributeClasses={attributeClasses}
            />
          ) : null}
          <div className="mt-4">
            <Collapsible.Root open={openAdvanced} onOpenChange={setOpenAdvanced} className="mt-5">
              <Collapsible.CollapsibleTrigger className="flex items-center text-sm text-slate-700">
                {openAdvanced ? (
                  <ChevronDownIcon className="mr-1 h-4 w-3" />
                ) : (
                  <ChevronRightIcon className="mr-2 h-4 w-3" />
                )}
                {openAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
              </Collapsible.CollapsibleTrigger>

              <Collapsible.CollapsibleContent className="space-y-4">
                {question.type !== TSurveyQuestionTypeEnum.NPS &&
                question.type !== TSurveyQuestionTypeEnum.Rating &&
                question.type !== TSurveyQuestionTypeEnum.CTA ? (
                  <div className="mt-2 flex space-x-2">
                    <div className="w-full">
                      <QuestionFormInput
                        id="buttonLabel"
                        value={question.buttonLabel}
                        label={`"Next" Button Label`}
                        localSurvey={localSurvey}
                        questionIdx={questionIdx}
                        maxLength={48}
                        placeholder={lastQuestion ? "Finish" : "Next"}
                        isInvalid={isInvalid}
                        updateQuestion={updateQuestion}
                        selectedLanguageCode={selectedLanguageCode}
                        setSelectedLanguageCode={setSelectedLanguageCode}
                        onBlur={(e) => {
                          if (!question.buttonLabel) return;
                          let translatedNextButtonLabel = {
                            ...question.buttonLabel,
                            [selectedLanguageCode]: e.target.value,
                          };

                          if (questionIdx === localSurvey.questions.length - 1) return;
                          updateEmptyNextButtonLabels(translatedNextButtonLabel);
                        }}
                        attributeClasses={attributeClasses}
                      />
                    </div>
                    {questionIdx !== 0 && (
                      <QuestionFormInput
                        id="backButtonLabel"
                        value={question.backButtonLabel}
                        label={`"Back" Button Label`}
                        localSurvey={localSurvey}
                        questionIdx={questionIdx}
                        maxLength={48}
                        placeholder={"Back"}
                        isInvalid={isInvalid}
                        updateQuestion={updateQuestion}
                        selectedLanguageCode={selectedLanguageCode}
                        setSelectedLanguageCode={setSelectedLanguageCode}
                        attributeClasses={attributeClasses}
                      />
                    )}
                  </div>
                ) : null}
                {(question.type === TSurveyQuestionTypeEnum.Rating ||
                  question.type === TSurveyQuestionTypeEnum.NPS) &&
                  questionIdx !== 0 && (
                    <div className="mt-4">
                      <QuestionFormInput
                        id="backButtonLabel"
                        value={question.backButtonLabel}
                        label={`"Back" Button Label`}
                        localSurvey={localSurvey}
                        questionIdx={questionIdx}
                        maxLength={48}
                        placeholder={"Back"}
                        isInvalid={isInvalid}
                        updateQuestion={updateQuestion}
                        selectedLanguageCode={selectedLanguageCode}
                        setSelectedLanguageCode={setSelectedLanguageCode}
                        attributeClasses={attributeClasses}
                      />
                    </div>
                  )}

                <AdvancedSettings
                  question={question}
                  questionIdx={questionIdx}
                  localSurvey={localSurvey}
                  updateQuestion={updateQuestion}
                  attributeClasses={attributeClasses}
                />
              </Collapsible.CollapsibleContent>
            </Collapsible.Root>
          </div>
        </Collapsible.CollapsibleContent>

        {open && (
          <div className="mx-4 flex justify-end space-x-6 border-t border-slate-200">
            {question.type === "openText" && (
              <div className="my-4 flex items-center justify-end space-x-2">
                <Label htmlFor="longAnswer">Long Answer</Label>
                <Switch
                  id="longAnswer"
                  disabled={question.inputType !== "text"}
                  checked={question.longAnswer !== false}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuestion(questionIdx, {
                      longAnswer: typeof question.longAnswer === "undefined" ? false : !question.longAnswer,
                    });
                  }}
                />
              </div>
            )}
            {
              <div className="my-4 flex items-center justify-end space-x-2">
                <Label htmlFor="required-toggle">Required</Label>
                <Switch
                  id="required-toggle"
                  checked={question.required}
                  disabled={getIsRequiredToggleDisabled()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRequiredToggle();
                  }}
                />
              </div>
            }
          </div>
        )}
      </Collapsible.Root>
    </div>
  );
};
