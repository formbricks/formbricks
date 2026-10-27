"use client";

import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { useWorkspaceContext } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { EmptyAppSurveys } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { useResponseTableFilters } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/hooks/use-response-table-filters";
import { isQuestionFilter } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/lib/response-table-filters";
import { CESSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/CESSummary";
import { CSATSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/CSATSummary";
import { CTASummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/CTASummary";
import { CalSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/CalSummary";
import { ConsentSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import { ContactInfoSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/ContactInfoSummary";
import { DateElementSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/DateElementSummary";
import { FileUploadSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/FileUploadSummary";
import { HiddenFieldsSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/HiddenFieldsSummary";
import { MatrixElementSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/MatrixElementSummary";
import { MultipleChoiceSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/MultipleChoiceSummary";
import { NPSSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/NPSSummary";
import { OpenTextSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/OpenTextSummary";
import { PictureChoiceSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/PictureChoiceSummary";
import { RankingSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/RankingSummary";
import { RatingSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/RatingSummary";
import { constructToastMessage } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { OptionsType } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { SkeletonLoader } from "@/modules/ui/components/skeleton-loader";
import { AddressSummary } from "./AddressSummary";

interface SummaryListProps {
  summary: TSurveySummary["summary"];
  responseCount: number | null;
  survey: TSurvey;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const SummaryList = ({
  summary,
  responseCount,
  survey,
  locale,
  isReadOnly,
}: Readonly<SummaryListProps>) => {
  const { workspace } = useWorkspaceContext();
  const { filters, applyQuestionFilter } = useResponseTableFilters(survey);
  const { t } = useTranslation();
  // "Filter by this answer" writes a rule to the shared toolbar filter, replacing the question's own.
  const setFilter = (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => {
    const hasFilter = filters.some((filter) => isQuestionFilter(filter, elementId));
    applyQuestionFilter({
      elementType: {
        id: elementId,
        label: getTextContent(getLocalizedValue(label, "default")),
        elementType,
        type: OptionsType.ELEMENTS,
      },
      filterType: { filterComboBoxValue, filterValue },
    });
    toast.success(
      hasFilter
        ? t("workspace.surveys.summary.filter_updated_successfully")
        : (constructToastMessage(elementType, filterValue, survey, elementId, t, filterComboBoxValue) ??
            t("workspace.surveys.summary.filter_added_successfully")),
      { duration: 5000 }
    );
  };

  return (
    <div className="mt-10 space-y-8">
      {survey.type === "app" && responseCount === 0 && !workspace.appSetupCompleted ? (
        <EmptyAppSurveys />
      ) : summary.length === 0 ? (
        <SkeletonLoader type="summary" />
      ) : responseCount === 0 ? (
        <EmptyState text={t("workspace.surveys.summary.no_responses_found")} />
      ) : (
        summary.map((elementSummary) => {
          if (elementSummary.type === TSurveyElementTypeEnum.OpenText) {
            return (
              <OpenTextSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                locale={locale}
                isReadOnly={isReadOnly}
              />
            );
          }
          if (
            elementSummary.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
            elementSummary.type === TSurveyElementTypeEnum.MultipleChoiceMulti
          ) {
            return (
              <MultipleChoiceSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                surveyType={survey.type}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.NPS) {
            return (
              <NPSSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.CTA) {
            return (
              <CTASummary key={elementSummary.element.id} elementSummary={elementSummary} survey={survey} />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Rating) {
            return (
              <RatingSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.CSAT) {
            return (
              <CSATSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.CES) {
            return (
              <CESSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Consent) {
            return (
              <ConsentSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.PictureSelection) {
            return (
              <PictureChoiceSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Date) {
            return (
              <DateElementSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                locale={locale}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.FileUpload) {
            return (
              <FileUploadSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                locale={locale}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Cal) {
            return (
              <CalSummary key={elementSummary.element.id} elementSummary={elementSummary} survey={survey} />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Matrix) {
            return (
              <MatrixElementSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                setFilter={setFilter}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Address) {
            return (
              <AddressSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                locale={locale}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Ranking) {
            return (
              <RankingSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                surveyType={survey.type}
                survey={survey}
              />
            );
          }
          if (elementSummary.type === "hiddenField") {
            return (
              <HiddenFieldsSummary key={elementSummary.id} elementSummary={elementSummary} locale={locale} />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.ContactInfo) {
            return (
              <ContactInfoSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                survey={survey}
                locale={locale}
              />
            );
          }

          return null;
        })
      )}
    </div>
  );
};
