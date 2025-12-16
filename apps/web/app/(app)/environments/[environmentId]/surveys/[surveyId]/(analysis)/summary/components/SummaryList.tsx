"use client";

import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurveySummary } from "@formbricks/types/surveys/types";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { EmptyAppSurveys } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import {
  SelectedFilterValue,
  useResponseFilter,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { CTASummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CTASummary";
import { CalSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CalSummary";
import { ConsentSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import { ContactInfoSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ContactInfoSummary";
import { DateElementSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/DateElementSummary";
import { FileUploadSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/FileUploadSummary";
import { HiddenFieldsSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/HiddenFieldsSummary";
import { MatrixElementSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MatrixElementSummary";
import { MultipleChoiceSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/MultipleChoiceSummary";
import { NPSSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/NPSSummary";
import { OpenTextSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/OpenTextSummary";
import { PictureChoiceSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/PictureChoiceSummary";
import { RankingSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/RankingSummary";
import { RatingSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/RatingSummary";
import { constructToastMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { OptionsType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ElementsComboBox";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { SkeletonLoader } from "@/modules/ui/components/skeleton-loader";
import { AddressSummary } from "./AddressSummary";

interface SummaryListProps {
  summary: TSurveySummary["summary"];
  responseCount: number | null;
  environment: TEnvironment;
  survey: TSurvey;
  locale: TUserLocale;
}

export const SummaryList = ({ summary, environment, responseCount, survey, locale }: SummaryListProps) => {
  const { setSelectedFilter, selectedFilter } = useResponseFilter();
  const { t } = useTranslation();
  const setFilter = (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => {
    const filterObject: SelectedFilterValue = { ...selectedFilter };
    const value = {
      id: elementId,
      label: getTextContent(getLocalizedValue(label, "default")),
      elementType,
      type: OptionsType.ELEMENTS,
    };

    // Find the index of the existing filter with the same elementId
    const existingFilterIndex = filterObject.filter.findIndex(
      (filter) => filter.elementType.id === elementId
    );

    if (existingFilterIndex !== -1) {
      // Replace the existing filter
      filterObject.filter[existingFilterIndex] = {
        elementType: value,
        filterType: {
          filterComboBoxValue: filterComboBoxValue,
          filterValue: filterValue,
        },
      };
      toast.success(t("environments.surveys.summary.filter_updated_successfully"), { duration: 5000 });
    } else {
      // Add new filter
      filterObject.filter.push({
        elementType: value,
        filterType: {
          filterComboBoxValue: filterComboBoxValue,
          filterValue: filterValue,
        },
      });
      toast.success(
        constructToastMessage(elementType, filterValue, survey, elementId, t, filterComboBoxValue) ??
          t("environments.surveys.summary.filter_added_successfully"),
        { duration: 5000 }
      );
    }

    setSelectedFilter({
      filter: [...filterObject.filter],
      responseStatus: filterObject.responseStatus,
    });
  };

  return (
    <div className="mt-10 space-y-8">
      {survey.type === "app" && responseCount === 0 && !environment.appSetupCompleted ? (
        <EmptyAppSurveys environment={environment} />
      ) : summary.length === 0 ? (
        <SkeletonLoader type="summary" />
      ) : responseCount === 0 ? (
        <EmptyState text={t("environments.surveys.summary.no_responses_found")} />
      ) : (
        summary.map((elementSummary) => {
          if (elementSummary.type === TSurveyElementTypeEnum.OpenText) {
            return (
              <OpenTextSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                environmentId={environment.id}
                survey={survey}
                locale={locale}
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
                environmentId={environment.id}
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
                environmentId={environment.id}
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
                environmentId={environment.id}
                survey={survey}
                locale={locale}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.Cal) {
            return (
              <CalSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                environmentId={environment.id}
                survey={survey}
              />
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
                environmentId={environment.id}
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
                survey={survey}
              />
            );
          }
          if (elementSummary.type === "hiddenField") {
            return (
              <HiddenFieldsSummary
                key={elementSummary.id}
                elementSummary={elementSummary}
                environment={environment}
                locale={locale}
              />
            );
          }
          if (elementSummary.type === TSurveyElementTypeEnum.ContactInfo) {
            return (
              <ContactInfoSummary
                key={elementSummary.element.id}
                elementSummary={elementSummary}
                environmentId={environment.id}
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
