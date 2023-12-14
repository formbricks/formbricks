import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import ConsentSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import HiddenFieldsSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/HiddenFieldsSummary";

import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyQuestionType } from "@formbricks/types/surveys";
import type {
  TSurveyDateQuestion,
  TSurveyFileUploadQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionSummary,
} from "@formbricks/types/surveys";
import {
  TSurvey,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyQuestion,
  TSurveyRatingQuestion,
} from "@formbricks/types/surveys";
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
  environment: TEnvironment;
  survey: TSurvey;
  responses: TResponse[];
  responsesPerPage: number;
}

export default function SummaryList({ environment, survey, responses, responsesPerPage }: SummaryListProps) {
  const getSummaryData = (): TSurveyQuestionSummary<TSurveyQuestion>[] =>
    survey.questions.map((question) => {
      const questionResponses = responses
        .filter((response) => question.id in response.data)
        .map((r) => ({
          id: r.id,
          value: r.data[question.id],
          updatedAt: r.updatedAt,
          person: r.person,
        }));

      return {
        question,
        responses: questionResponses,
      };
    });

  return (
    <div className="mt-10 space-y-8">
      {survey.type === "web" && responses.length === 0 && !environment.widgetSetupCompleted ? (
        <EmptyInAppSurveys environment={environment} />
      ) : responses.length === 0 ? (
        <EmptySpaceFiller
          type="response"
          environment={environment}
          noWidgetRequired={survey.type === "link"}
        />
      ) : (
        <>
          {getSummaryData().map((questionSummary) => {
            if (questionSummary.question.type === TSurveyQuestionType.OpenText) {
              return (
                <OpenTextSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyOpenTextQuestion>}
                  environmentId={environment.id}
                  responsesPerPage={responsesPerPage}
                />
              );
            }
            if (
              questionSummary.question.type === TSurveyQuestionType.MultipleChoiceSingle ||
              questionSummary.question.type === TSurveyQuestionType.MultipleChoiceMulti
            ) {
              return (
                <MultipleChoiceSummary
                  key={questionSummary.question.id}
                  questionSummary={
                    questionSummary as TSurveyQuestionSummary<
                      TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion
                    >
                  }
                  environmentId={environment.id}
                  surveyType={survey.type}
                  responsesPerPage={responsesPerPage}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.NPS) {
              return (
                <NPSSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyNPSQuestion>}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.CTA) {
              return (
                <CTASummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyCTAQuestion>}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.Rating) {
              return (
                <RatingSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyRatingQuestion>}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.Consent) {
              return (
                <ConsentSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyConsentQuestion>}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.PictureSelection) {
              return (
                <PictureChoiceSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyPictureSelectionQuestion>}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.Date) {
              return (
                <DateQuestionSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyDateQuestion>}
                  environmentId={environment.id}
                  responsesPerPage={responsesPerPage}
                />
              );
            }
            if (questionSummary.question.type === TSurveyQuestionType.FileUpload) {
              return (
                <FileUploadSummary
                  key={questionSummary.question.id}
                  questionSummary={questionSummary as TSurveyQuestionSummary<TSurveyFileUploadQuestion>}
                  environmentId={environment.id}
                />
              );
            }

            return null;
          })}

          {survey.hiddenFields?.enabled &&
            survey.hiddenFields.fieldIds?.map((question) => {
              return (
                <HiddenFieldsSummary
                  environment={environment}
                  question={question}
                  responses={responses}
                  survey={survey}
                  key={question}
                />
              );
            })}
        </>
      )}
    </div>
  );
}
