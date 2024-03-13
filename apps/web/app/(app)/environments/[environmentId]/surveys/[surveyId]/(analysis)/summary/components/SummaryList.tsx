import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import CalSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/CalSummary";
import ConsentSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import HiddenFieldsSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/HiddenFieldsSummary";

import { TEnvironment } from "@formbricks/types/environment";
import { TSurveySummary } from "@formbricks/types/responses";
import { TSurveyQuestionType } from "@formbricks/types/surveys";
import { TSurvey } from "@formbricks/types/surveys";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";

import CTASummary from "./CTASummary";
import DateQuestionSummary from "./DateQuestionSummary";
import FileUploadSummary from "./FileUploadSummary";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import NPSSummary from "./NPSSummary";
import OpenTextSummary from "./OpenTextSummary";
import PictureChoiceSummary from "./PictureChoiceSummary";
import RatingSummary from "./RatingSummary";

interface SummaryListProps {
  summary: TSurveySummary["summary"];
  responseCount: number | null;
  environment: TEnvironment;
  survey: TSurvey;
}

export default function SummaryList({ summary, environment, responseCount, survey }: SummaryListProps) {
  return (
    <div className="mt-10 space-y-8">
      {survey.type === "web" && responseCount === 0 && !environment.widgetSetupCompleted ? (
        <EmptyInAppSurveys environment={environment} />
      ) : !responseCount ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
        />
      ) : !summary.length ? (
        <EmptySpaceFiller type="summary" environment={environment} />
      ) : (
        summary.map((questionSummary) => {
          if (questionSummary.type === TSurveyQuestionType.OpenText) {
            return (
              <OpenTextSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
              />
            );
          }
          if (
            questionSummary.type === TSurveyQuestionType.MultipleChoiceSingle ||
            questionSummary.type === TSurveyQuestionType.MultipleChoiceMulti
          ) {
            return (
              <MultipleChoiceSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
                surveyType={survey.type}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionType.NPS) {
            return <NPSSummary key={questionSummary.question.id} questionSummary={questionSummary} />;
          }
          if (questionSummary.type === TSurveyQuestionType.CTA) {
            return <CTASummary key={questionSummary.question.id} questionSummary={questionSummary} />;
          }
          if (questionSummary.type === TSurveyQuestionType.Rating) {
            return <RatingSummary key={questionSummary.question.id} questionSummary={questionSummary} />;
          }
          if (questionSummary.type === TSurveyQuestionType.Consent) {
            return <ConsentSummary key={questionSummary.question.id} questionSummary={questionSummary} />;
          }
          if (questionSummary.type === TSurveyQuestionType.PictureSelection) {
            return (
              <PictureChoiceSummary key={questionSummary.question.id} questionSummary={questionSummary} />
            );
          }
          if (questionSummary.type === TSurveyQuestionType.Date) {
            return (
              <DateQuestionSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionType.FileUpload) {
            return (
              <FileUploadSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
              />
            );
          }
          if (questionSummary.type === TSurveyQuestionType.Cal) {
            return (
              <CalSummary
                key={questionSummary.question.id}
                questionSummary={questionSummary}
                environmentId={environment.id}
              />
            );
          }
          if (questionSummary.type === "hiddenField") {
            return (
              <HiddenFieldsSummary
                key={questionSummary.question}
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
}
