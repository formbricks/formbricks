import { getOpenTextSummaryAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";
import Markdown from "markdown-to-jsx";
import Link from "next/link";
import { useState } from "react";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { timeSince } from "@formbricks/lib/time";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { PersonAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface OpenTextSummaryProps {
  questionSummary: TSurveyQuestionSummaryOpenText;
  environmentId: string;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
  isAiEnabled: boolean;
}

export const OpenTextSummary = ({
  questionSummary,
  environmentId,
  survey,
  attributeClasses,
  isAiEnabled,
}: OpenTextSummaryProps) => {
  const [visibleResponses, setVisibleResponses] = useState(10);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, questionSummary.samples.length)
    );
  };

  const getOpenTextSummary = async () => {
    setIsLoadingAiSummary(true);
    // This function is not implemented yet
    const res = await getOpenTextSummaryAction({
      surveyId: survey.id,
      questionId: questionSummary.question.id,
    });
    const openTextSummary = res?.data;
    if (openTextSummary) {
      setAiSummary(openTextSummary);
    } else {
      setAiSummary("No summary available");
    }
    setIsLoadingAiSummary(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      <div className="p-4">
        {isAiEnabled && (
          <>
            <Alert variant="info">
              <AlertTitle>✨ AI Summary</AlertTitle>
              {isLoadingAiSummary && <LoadingSpinner />}
              {!isLoadingAiSummary && aiSummary && (
                <>
                  <hr className="my-4 text-slate-200" />
                  <AlertDescription>
                    <Markdown>{aiSummary}</Markdown>
                  </AlertDescription>
                </>
              )}
              <hr className="my-4 text-slate-200" />
              {questionSummary.responseCount < 10 ? (
                <p className="text-sm">This question needs at least 10 responses to access AI summaries</p>
              ) : (
                <Button onClick={() => getOpenTextSummary()} disabled={isLoadingAiSummary}>
                  Generate Summary
                </Button>
              )}
            </Alert>
          </>
        )}
      </div>
      <div className="">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">User</div>
          <div className="col-span-2 pl-4 md:pl-6">Response</div>
          <div className="px-4 md:px-6">Time</div>
        </div>
        <div className="max-h-[62vh] w-full overflow-y-auto">
          {questionSummary.samples.slice(0, visibleResponses).map((response) => (
            <div
              key={response.id}
              className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 last:border-transparent md:text-base">
              <div className="pl-4 md:pl-6">
                {response.person ? (
                  <Link
                    className="ph-no-capture group flex items-center"
                    href={`/environments/${environmentId}/people/${response.person.id}`}>
                    <div className="hidden md:flex">
                      <PersonAvatar personId={response.person.id} />
                    </div>
                    <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                      {getPersonIdentifier(response.person, response.personAttributes)}
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
              <div className="ph-no-capture col-span-2 whitespace-pre-wrap pl-6 font-semibold" dir="auto">
                {response.value}
              </div>
              <div className="px-4 text-slate-500 md:px-6">
                {timeSince(new Date(response.updatedAt).toISOString())}
              </div>
            </div>
          ))}
        </div>
        {visibleResponses < questionSummary.samples.length && (
          <div className="flex justify-center py-4">
            <Button onClick={handleLoadMore} variant="secondary" size="sm">
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
