import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import {
  QuestionType,
  type CTAQuestion,
  type MultipleChoiceMultiQuestion,
  type MultipleChoiceSingleQuestion,
  type NPSQuestion,
  type OpenTextQuestion,
  type RatingQuestion,
  type ConsentQuestion,
} from "@formbricks/types/questions";
import type { QuestionSummary } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/v1/surveys";
import { Session } from "next-auth";
import CTASummary from "./CTASummary";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import NPSSummary from "./NPSSummary";
import OpenTextSummary from "./OpenTextSummary";
import RatingSummary from "./RatingSummary";
import ConsentSummary from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/ConsentSummary";

interface SummaryListProps {
  environmentId: string;
  surveyId: string;
  session: Session;
}

export default async function SummaryList({ environmentId, surveyId, session }: SummaryListProps) {
  const { survey, responses } = await getAnalysisData(session, surveyId);

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
        {responses.length === 0 ? (
          <EmptySpaceFiller
            type="response"
            environmentId={environmentId}
            noWidgetRequired={survey.type === "link"}
          />
        ) : (
          <>
            {getSummaryData().map((questionSummary) => {
              if (questionSummary.question.type === QuestionType.OpenText) {
                return (
                  <OpenTextSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<OpenTextQuestion>}
                    environmentId={environmentId}
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
                        MultipleChoiceMultiQuestion | MultipleChoiceSingleQuestion
                      >
                    }
                    environmentId={environmentId}
                    surveyType={survey.type}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.NPS) {
                return (
                  <NPSSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<NPSQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.CTA) {
                return (
                  <CTASummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<CTAQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.Rating) {
                return (
                  <RatingSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<RatingQuestion>}
                  />
                );
              }
              if (questionSummary.question.type === QuestionType.Consent) {
                return (
                  <ConsentSummary
                    key={questionSummary.question.id}
                    questionSummary={questionSummary as QuestionSummary<ConsentQuestion>}
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
