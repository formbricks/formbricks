"use client";

import {
  SelectedFilterValue,
  useResponseFilter,
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { EmptyAppSurveys } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { CTASummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CTASummary";
import { CalSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CalSummary";
import { ConsentSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import { DateQuestionSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/DateQuestionSummary";
import { FileUploadSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/FileUploadSummary";
import { HiddenFieldsSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/HiddenFieldsSummary";
import { MatrixQuestionSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MatrixQuestionSummary";
import { MultipleChoiceSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MultipleChoiceSummary";
import { NPSSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/NPSSummary";
import { OpenTextSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/OpenTextSummary";
import { PictureChoiceSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/PictureChoiceSummary";
import { RatingSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/RatingSummary";
import { constructToastMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { OptionsType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import { toast } from "react-hot-toast";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TI18nString, TSurveySummary } from "@formbricks/types/surveys/types";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TSurvey } from "@formbricks/types/surveys/types";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";
import { SkeletonLoader } from "@formbricks/ui/SkeletonLoader";
import { AddressSummary } from "./AddressSummary";

interface SummaryListProps {
  summary: TSurveySummary["summary"];
  responseCount: number | null;
  environment: TEnvironment;
  survey: TSurvey;
  totalResponseCount: number;
  attributeClasses: TAttributeClass[];
}

export const SummaryList = ({
  summary,
  environment,
  responseCount,
  survey,
  totalResponseCount,
  attributeClasses,
}: SummaryListProps) => {
  const { setSelectedFilter, selectedFilter } = useResponseFilter();
  const widgetSetupCompleted =
    survey.type === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted;

  const setFilter = (
    questionId: string,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => {
    const filterObject: SelectedFilterValue = { ...selectedFilter };
    const value = {
      id: questionId,
      label: getLocalizedValue(label, "default"),
      questionType: questionType,
      type: OptionsType.QUESTIONS,
    };

    // Find the index of the existing filter with the same questionId
    const existingFilterIndex = filterObject.filter.findIndex(
      (filter) => filter.questionType.id === questionId
    );

    if (existingFilterIndex !== -1) {
      // Replace the existing filter
      filterObject.filter[existingFilterIndex] = {
        questionType: value,
        filterType: {
          filterComboBoxValue: filterComboBoxValue,
          filterValue: filterValue,
        },
      };
      toast.success("Filter updated successfully", { duration: 5000 });
    } else {
      // Add new filter
      filterObject.filter.push({
        questionType: value,
        filterType: {
          filterComboBoxValue: filterComboBoxValue,
          filterValue: filterValue,
        },
      });
      toast.success(
        constructToastMessage(questionType, filterValue, survey, questionId, filterComboBoxValue) ??
          "Filter added successfully",
        { duration: 5000 }
      );
    }

    setSelectedFilter({
      filter: [...filterObject.filter],
      onlyComplete: filterObject.onlyComplete,
    });
  };

  return (
    <div className="mt-10 space-y-8">
      {(survey.type === "app" || survey.type === "website") &&
      responseCount === 0 &&
      !widgetSetupCompleted ? (
        <EmptyAppSurveys environment={environment} surveyType={survey.type} />
      ) : summary.length === 0 ? (
        <SkeletonLoader type="summary" />
      ) : responseCount === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
          emptyMessage={totalResponseCount === 0 ? undefined : "No response matches your filter"}
          widgetSetupCompleted={widgetSetupCompleted}
        />
      ) : (
        summary.map((questionSummary) => {
          if (questionSummary.type === TSurveyQuestionTypeEnum.OpenText) {
            return (
              <OpenTextSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                survey={survey}
                attributeClasses={attributeClasses}
              />
            );
          }
          if (
            questionSummary.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
            questionSummary.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
          ) {
            return (
              <MultipleChoiceSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                surveyType={survey.type}
                survey={survey}
                attributeClasses={attributeClasses}
                setFilter={setFilter}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.NPS) {
            return (
              <NPSSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                survey={survey}
                attributeClasses={attributeClasses}
                setFilter={setFilter}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.CTA) {
            return (
              <CTASummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                survey={survey}
                attributeClasses={attributeClasses}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.Rating) {
            return (
              <RatingSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                survey={survey}
                attributeClasses={attributeClasses}
                setFilter={setFilter}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.Consent) {
            return (
              <ConsentSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                survey={survey}
                attributeClasses={attributeClasses}
                setFilter={setFilter}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.PictureSelection) {
            return (
              <PictureChoiceSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                survey={survey}
                attributeClasses={attributeClasses}
                setFilter={setFilter}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.Date) {
            return (
              <DateQuestionSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                survey={survey}
                attributeClasses={attributeClasses}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.FileUpload) {
            return (
              <FileUploadSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                survey={survey}
                attributeClasses={attributeClasses}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.Cal) {
            return (
              <CalSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                survey={survey}
                attributeClasses={attributeClasses}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.Matrix) {
            return (
              <MatrixQuestionSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                survey={survey}
                attributeClasses={attributeClasses}
                setFilter={setFilter}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionTypeEnum.Address) {
            return (
              <AddressSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                survey={survey}
                attributeClasses={attributeClasses}
              />
            );
          }
          if (questionSummary.type === "hiddenField") {
            return (
              <HiddenFieldsSummary
                key={questionSummary.id}
                questionSummary={questionSummary}
                environment={environment}
              />
            );
          }

          return null;
        })
      )}
    </div>
  );
};
