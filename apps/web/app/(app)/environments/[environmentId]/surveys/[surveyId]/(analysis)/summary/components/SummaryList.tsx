import ConsentSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { QuestionType } from "@formbricks/types/questions";
import type { QuestionSummary } from "@formbricks/types/responses";
import { TResponse } from "@formbricks/types/v1/responses";
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
} from "@formbricks/types/v1/surveys";
import CTASummary from "./CTASummary";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import NPSSummary from "./NPSSummary";
import OpenTextSummary from "./OpenTextSummary";
import RatingSummary from "./RatingSummary";
import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import { TEnvironment } from "@formbricks/types/v1/environment";

interface SummaryListProps {
  environment: TEnvironment;
  survey: TSurvey;
  responses: TResponse[];
}

export default function SummaryList({ environment, survey, responses }: SummaryListProps) {
  const getSummaryData = (): QuestionSummary<TSurveyQuestion>[] =>
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
    <>
      <div className="mt-10 space-y-8">
        {survey.type === "web" && responses.length === 0 && (
          <EmptyInAppSurveys environmentId={environment.id} />
        )}

        {survey.type !== "web" && responses.length === 0 ? (
          <EmptySpaceFiller
            type="response"
            environment={environment}
            noWidgetRequired={survey.type === "link"}
          />
        ) : (
          <>
            {getSummaryData().map((questionSummary) => {
              if (questionSummary.question.type === QuestionType.OpenText) {
                return (
                  <OpenTextSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<TSurveyOpenTextQuestion>}
                    environmentId={environment.id}
                  />
                );
              }
              if (
                questionSummary.question.type === QuestionType.MultipleChoiceSingle ||
                questionSummary.question.type === QuestionType.MultipleChoiceMulti
              ) {
                return (
                  <MultipleChoiceSummary
                    key={questionSummary.question.id}
                    questionSummary={
                      questionSummary as QuestionSummary<
                        TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion
                      >
                    }
                    environmentId={environment.id}
                    surveyType={survey.type}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.NPS) {
                return (
                  <NPSSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<TSurveyNPSQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.CTA) {
                return (
                  <CTASummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<TSurveyCTAQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.Rating) {
                return (
                  <RatingSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<TSurveyRatingQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.Consent) {
                return (
                  <ConsentSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<TSurveyConsentQuestion>}
                  />
                );
              }
              return null;
            })}
          </>
        )}
      </div>
    </>
  );
}
