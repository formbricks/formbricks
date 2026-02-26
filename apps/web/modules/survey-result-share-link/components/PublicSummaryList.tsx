"use client";

import { useTranslation } from "react-i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveySummary } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AddressSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/AddressSummary";
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
import { EmptyState } from "@/modules/ui/components/empty-state";
import { SkeletonLoader } from "@/modules/ui/components/skeleton-loader";

interface PublicSummaryListProps {
  summary: TSurveySummary["summary"];
  responseCount: number | null;
  survey: TSurvey;
  locale: TUserLocale;
}

// A no-op filter setter for public view (filtering is disabled)
const noopSetFilter = () => {};

export const PublicSummaryList = ({ summary, responseCount, survey, locale }: PublicSummaryListProps) => {
  const { t } = useTranslation();

  const renderContent = () => {
    if (summary.length === 0) {
      return <SkeletonLoader type="summary" />;
    }
    if (responseCount === 0) {
      return <EmptyState text={t("environments.surveys.summary.no_responses_found")} />;
    }
    return summary.map((elementSummary) => {
      if (elementSummary.type === TSurveyElementTypeEnum.OpenText) {
        return (
          <OpenTextSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            environmentId=""
            survey={survey}
            locale={locale}
            isPublic={true}
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
            environmentId=""
            surveyType={survey.type}
            survey={survey}
            setFilter={noopSetFilter}
            isPublic={true}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.NPS) {
        return (
          <NPSSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            survey={survey}
            setFilter={noopSetFilter}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.CTA) {
        return <CTASummary key={elementSummary.element.id} elementSummary={elementSummary} survey={survey} />;
      }
      if (elementSummary.type === TSurveyElementTypeEnum.Rating) {
        return (
          <RatingSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            survey={survey}
            setFilter={noopSetFilter}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.Consent) {
        return (
          <ConsentSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            survey={survey}
            setFilter={noopSetFilter}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.PictureSelection) {
        return (
          <PictureChoiceSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            survey={survey}
            setFilter={noopSetFilter}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.Date) {
        return (
          <DateElementSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            environmentId=""
            survey={survey}
            locale={locale}
            isPublic={true}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.FileUpload) {
        return (
          <FileUploadSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            environmentId=""
            survey={survey}
            locale={locale}
            isPublic={true}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.Cal) {
        return (
          <CalSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            environmentId=""
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
            setFilter={noopSetFilter}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.Address) {
        return (
          <AddressSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            environmentId=""
            survey={survey}
            locale={locale}
            isPublic={true}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.Ranking) {
        return (
          <RankingSummary key={elementSummary.element.id} elementSummary={elementSummary} survey={survey} />
        );
      }
      if (elementSummary.type === "hiddenField") {
        return (
          <HiddenFieldsSummary
            key={elementSummary.id}
            elementSummary={elementSummary}
            environment={null}
            locale={locale}
            isPublic={true}
          />
        );
      }
      if (elementSummary.type === TSurveyElementTypeEnum.ContactInfo) {
        return (
          <ContactInfoSummary
            key={elementSummary.element.id}
            elementSummary={elementSummary}
            environmentId=""
            survey={survey}
            locale={locale}
            isPublic={true}
          />
        );
      }

      return null;
    });
  };

  return <div className="mt-10 space-y-8">{renderContent()}</div>;
};
