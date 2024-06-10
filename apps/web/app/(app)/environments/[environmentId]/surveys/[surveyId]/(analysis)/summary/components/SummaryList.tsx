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
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveySummary } from "@formbricks/types/surveys";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys";
import { TSurvey } from "@formbricks/types/surveys";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";
import { SkeletonLoader } from "@formbricks/ui/SkeletonLoader";
import { AddressSummary } from "./AddressSummary";

interface SummaryListProps {
  summary: TSurveySummary["summary"];
  responseCount: number | null;
  environment: TEnvironment;
  survey: TSurvey;
  fetchingSummary: boolean;
  totalResponseCount: number;
  attributeClasses: TAttributeClass[];
}

export const SummaryList = ({
  summary,
  environment,
  responseCount,
  survey,
  fetchingSummary,
  totalResponseCount,
  attributeClasses,
}: SummaryListProps) => {
  const widgetSetupCompleted = environment?.appSetupCompleted || environment?.websiteSetupCompleted;

  return (
    <div className="mt-10 space-y-8">
      {(survey.type === "app" || survey.type === "website") &&
      responseCount === 0 &&
      !widgetSetupCompleted ? (
        <EmptyAppSurveys environment={environment} surveyType={survey.type} />
      ) : fetchingSummary ? (
        <SkeletonLoader type="summary" />
      ) : responseCount === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
          emptyMessage={totalResponseCount === 0 ? undefined : "No response matches your filter"}
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
