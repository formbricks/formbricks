"use client";

import { cn } from "@/lib/cn";
import { recallToHeadline } from "@/lib/utils/recall";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { AddressQuestionForm } from "@/modules/survey/editor/components/address-question-form";
import { AdvancedSettings } from "@/modules/survey/editor/components/advanced-settings";
import { CalQuestionForm } from "@/modules/survey/editor/components/cal-question-form";
import { ConsentQuestionForm } from "@/modules/survey/editor/components/consent-question-form";
import { ContactInfoQuestionForm } from "@/modules/survey/editor/components/contact-info-question-form";
import { CTAQuestionForm } from "@/modules/survey/editor/components/cta-question-form";
import { DateQuestionForm } from "@/modules/survey/editor/components/date-question-form";
import { EditorCardMenu } from "@/modules/survey/editor/components/editor-card-menu";
import { FileUploadQuestionForm } from "@/modules/survey/editor/components/file-upload-question-form";
import { MatrixQuestionForm } from "@/modules/survey/editor/components/matrix-question-form";
import { MultipleChoiceQuestionForm } from "@/modules/survey/editor/components/multiple-choice-question-form";
import { NPSQuestionForm } from "@/modules/survey/editor/components/nps-question-form";
import { OpenQuestionForm } from "@/modules/survey/editor/components/open-question-form";
import { PictureSelectionForm } from "@/modules/survey/editor/components/picture-selection-form";
import { RankingQuestionForm } from "@/modules/survey/editor/components/ranking-question-form";
import { RatingQuestionForm } from "@/modules/survey/editor/components/rating-question-form";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getQuestionIconMap, getTSurveyQuestionTypeEnumName } from "@/modules/survey/lib/questions";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon, ChevronRightIcon, GripIcon } from "lucide-react";
import { useState } from "react";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionId,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface QuestionCardProps {
  localSurvey: TSurvey;
  project: Project;
  question: TSurveyQuestion;
  questionIdx: number;
  moveQuestion: (questionIndex: number, up: boolean) => void;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  deleteQuestion: (questionIdx: number) => void;
  duplicateQuestion: (questionIdx: number) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  addQuestion: (question: any, index?: number) => void;
  isFormbricksCloud: boolean;
  isCxMode: boolean;
  locale: TUserLocale;
  responseCount: number;
  onAlertTrigger: () => void;
}

export const QuestionCard = ({
  localSurvey,
  project,
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
  addQuestion,
  isFormbricksCloud,
  isCxMode,
  locale,
  responseCount,
  onAlertTrigger,
}: QuestionCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const { t } = useTranslate();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);
  const open = activeQuestionId === question.id;
  const [openAdvanced, setOpenAdvanced] = useState(question.logic && question.logic.length > 0);
  const [parent] = useAutoAnimate();

  const updateEmptyButtonLabels = (
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString,
    skipIndex: number
  ) => {
    localSurvey.questions.forEach((q, index) => {
      if (index === skipIndex) return;
      const currentLabel = q[labelKey];
      if (!currentLabel || currentLabel[selectedLanguageCode]?.trim() === "") {
        updateQuestion(index, { [labelKey]: labelValue });
      }
    });
  };

  const getIsRequiredToggleDisabled = (): boolean => {
    if (question.type === TSurveyQuestionTypeEnum.Address) {
      const allFieldsAreOptional = [
        question.addressLine1,
        question.addressLine2,
        question.city,
        question.state,
        question.zip,
        question.country,
      ]
        .filter((field) => field.show)
        .every((field) => !field.required);

      if (allFieldsAreOptional) {
        return true;
      }

      return [
        question.addressLine1,
        question.addressLine2,
        question.city,
        question.state,
        question.zip,
        question.country,
      ]
        .filter((field) => field.show)
        .some((condition) => condition.required === true);
    }

    if (question.type === TSurveyQuestionTypeEnum.ContactInfo) {
      const allFieldsAreOptional = [
        question.firstName,
        question.lastName,
        question.email,
        question.phone,
        question.company,
      ]
        .filter((field) => field.show)
        .every((field) => !field.required);

      if (allFieldsAreOptional) {
        return true;
      }

      return [question.firstName, question.lastName, question.email, question.phone, question.company]
        .filter((field) => field.show)
        .some((condition) => condition.required === true);
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
              <div className="flex grow flex-col justify-center" dir="auto">
                <p className="text-sm font-semibold">
                  {recallToHeadline(question.headline, localSurvey, true, selectedLanguageCode)[
                    selectedLanguageCode
                  ]
                    ? formatTextWithSlashes(
                        recallToHeadline(question.headline, localSurvey, true, selectedLanguageCode)[
                          selectedLanguageCode
                        ] ?? ""
                      )
                    : getTSurveyQuestionTypeEnumName(question.type, t)}
                </p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {question?.required
                      ? t("environments.surveys.edit.required")
                      : t("environments.surveys.edit.optional")}
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
                project={project}
                updateCard={updateQuestion}
                addCard={addQuestion}
                cardType="question"
                isCxMode={isCxMode}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "pb-4"}`}>
          {responseCount > 0 &&
          [
            TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            TSurveyQuestionTypeEnum.MultipleChoiceMulti,
            TSurveyQuestionTypeEnum.PictureSelection,
            TSurveyQuestionTypeEnum.Rating,
            TSurveyQuestionTypeEnum.NPS,
            TSurveyQuestionTypeEnum.Ranking,
            TSurveyQuestionTypeEnum.Matrix,
          ].includes(question.type) ? (
            <Alert variant="warning" size="small" className="w-fill">
              <AlertTitle>{t("environments.surveys.edit.caution_text")}</AlertTitle>
              <AlertButton onClick={() => onAlertTrigger()}>{t("common.learn_more")}</AlertButton>
            </Alert>
          ) : null}
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
              locale={locale}
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
              locale={locale}
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
              locale={locale}
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
              locale={locale}
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
              locale={locale}
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
              locale={locale}
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
              locale={locale}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Date ? (
            <DateQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              locale={locale}
            />
          ) : question.type === TSurveyQuestionTypeEnum.PictureSelection ? (
            <PictureSelectionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              locale={locale}
            />
          ) : question.type === TSurveyQuestionTypeEnum.FileUpload ? (
            <FileUploadQuestionForm
              localSurvey={localSurvey}
              project={project}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              isFormbricksCloud={isFormbricksCloud}
              locale={locale}
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
              locale={locale}
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
              locale={locale}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Address ? (
            <AddressQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              locale={locale}
            />
          ) : question.type === TSurveyQuestionTypeEnum.Ranking ? (
            <RankingQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              locale={locale}
            />
          ) : question.type === TSurveyQuestionTypeEnum.ContactInfo ? (
            <ContactInfoQuestionForm
              localSurvey={localSurvey}
              question={question}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              lastQuestion={lastQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isInvalid={isInvalid}
              locale={locale}
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
                {openAdvanced
                  ? t("environments.surveys.edit.hide_advanced_settings")
                  : t("environments.surveys.edit.show_advanced_settings")}
              </Collapsible.CollapsibleTrigger>

              <Collapsible.CollapsibleContent className="flex flex-col gap-4" ref={parent}>
                {question.type !== TSurveyQuestionTypeEnum.NPS &&
                question.type !== TSurveyQuestionTypeEnum.Rating &&
                question.type !== TSurveyQuestionTypeEnum.CTA ? (
                  <div className="mt-2 flex space-x-2">
                    {questionIdx !== 0 && (
                      <QuestionFormInput
                        id="backButtonLabel"
                        value={question.backButtonLabel}
                        label={t("environments.surveys.edit.back_button_label")}
                        localSurvey={localSurvey}
                        questionIdx={questionIdx}
                        maxLength={48}
                        placeholder={t("common.back")}
                        isInvalid={isInvalid}
                        updateQuestion={updateQuestion}
                        selectedLanguageCode={selectedLanguageCode}
                        setSelectedLanguageCode={setSelectedLanguageCode}
                        locale={locale}
                        onBlur={(e) => {
                          if (!question.backButtonLabel) return;
                          let translatedBackButtonLabel = {
                            ...question.backButtonLabel,
                            [selectedLanguageCode]: e.target.value,
                          };
                          updateEmptyButtonLabels("backButtonLabel", translatedBackButtonLabel, 0);
                        }}
                      />
                    )}
                    <div className="w-full">
                      <QuestionFormInput
                        id="buttonLabel"
                        value={question.buttonLabel}
                        label={t("environments.surveys.edit.next_button_label")}
                        localSurvey={localSurvey}
                        questionIdx={questionIdx}
                        maxLength={48}
                        placeholder={lastQuestion ? t("common.finish") : t("common.next")}
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
                          updateEmptyButtonLabels(
                            "buttonLabel",
                            translatedNextButtonLabel,
                            localSurvey.questions.length - 1
                          );
                        }}
                        locale={locale}
                      />
                    </div>
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
                        locale={locale}
                      />
                    </div>
                  )}

                <AdvancedSettings
                  question={question}
                  questionIdx={questionIdx}
                  localSurvey={localSurvey}
                  updateQuestion={updateQuestion}
                />
              </Collapsible.CollapsibleContent>
            </Collapsible.Root>
          </div>
        </Collapsible.CollapsibleContent>

        {open && (
          <div className="mx-4 flex justify-end space-x-6 border-t border-slate-200">
            {question.type === "openText" && (
              <div className="my-4 flex items-center justify-end space-x-2">
                <Label htmlFor="longAnswer">{t("environments.surveys.edit.long_answer")}</Label>
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
                <Label htmlFor="required-toggle">{t("environments.surveys.edit.required")}</Label>
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
