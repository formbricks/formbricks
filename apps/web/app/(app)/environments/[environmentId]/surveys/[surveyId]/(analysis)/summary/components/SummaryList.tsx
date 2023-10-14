import EmptyInAppSurveys from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/EmptyInAppSurveys";
import ConsentSummary from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ConsentSummary";
import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import EmptySpaceFiller from "@/app/components/shared/EmptySpaceFiller";
import { QuestionType } from "@formbricks/types/questions";
import type { QuestionSummary } from "@formbricks/types/responses";
import { TEnvironment } from "@formbricks/types/v1/environment";
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
import { ChatBubbleBottomCenterTextIcon, InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import CTASummary from "./CTASummary";
import MultipleChoiceSummary from "./MultipleChoiceSummary";
import NPSSummary from "./NPSSummary";
import OpenTextSummary from "./OpenTextSummary";
import RatingSummary from "./RatingSummary";
import { getPersonIdentifier } from "@formbricks/lib/people/helpers";
import Link from "next/link";
import { PersonAvatar } from "@formbricks/ui/Avatars";
import { timeSince } from "@formbricks/lib/time";

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

  const hiddenQuestionResponses = useMemo(
    () =>
      survey.hiddenQuestionCard?.questions?.map((question) => {
        const questionResponses = responses
          .filter((response) => question in response.data)
          .map((r) => ({
            id: r.id,
            value: r.data[question],
            updatedAt: r.updatedAt,
            person: r.person,
          }));
        return {
          question,
          responses: questionResponses,
        };
      }),
    [responses, survey.hiddenQuestionCard?.questions]
  );

  return (
    <>
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
            {survey.hiddenQuestionCard?.enabled &&
              survey.hiddenQuestionCard.questions &&
              survey.hiddenQuestionCard.questions.map((question) => {
                return (
                  <div key={question} className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                    <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
                      <Headline headline={question} />

                      <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
                        <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
                          <ChatBubbleBottomCenterTextIcon className="mr-2 h-4 w-4" />
                          Hidden Field
                        </div>
                        <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
                          <InboxStackIcon className="mr-2 h-4 w-4" />
                          {
                            hiddenQuestionResponses?.find((q) => q.question === question)?.responses?.length
                          }{" "}
                          Responses
                        </div>
                      </div>
                    </div>
                    <div className="rounded-b-lg bg-white">
                      <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
                        <div className="pl-4 md:pl-6">User</div>
                        <div className="col-span-2 pl-4 md:pl-6">Response</div>
                        <div className="px-4 md:px-6">Time</div>
                      </div>
                      {hiddenQuestionResponses
                        ?.find((q) => q.question === question)
                        ?.responses.map((response) => {
                          const displayIdentifier = getPersonIdentifier(response.person!);
                          return (
                            <div
                              key={response.id}
                              className="grid  grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
                              <div className="pl-4 md:pl-6">
                                {response.person ? (
                                  <Link
                                    className="ph-no-capture group flex items-center"
                                    href={`/environments/${environment.id}/people/${response.person.id}`}>
                                    <div className="hidden md:flex">
                                      <PersonAvatar personId={response.person.id} />
                                    </div>
                                    <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                                      {displayIdentifier}
                                    </p>
                                  </Link>
                                ) : (
                                  <div className="group flex items-center">
                                    <div className="hidden md:flex">
                                      <PersonAvatar personId="anonymous" />
                                    </div>
                                    <p className="break-all text-slate-600 md:ml-2">Anonymous</p>
                                  </div>
                                )}
                              </div>
                              <div className="ph-no-capture col-span-2 whitespace-pre-wrap pl-6 font-semibold">
                                {response.value}
                              </div>
                              <div className="px-4 text-slate-500 md:px-6">
                                {timeSince(response.updatedAt.toISOString())}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </>
  );
}
