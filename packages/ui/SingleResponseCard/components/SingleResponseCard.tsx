"use client";
import { RatingResponse } from "../../../../apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/RatingResponse";
import ResponseNotes from "../../../../apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseNote";
import ResponseTagsWrapper from "../../../../apps/web/app//(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTagsWrapper";
import { deleteResponseAction } from "../../../../apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/actions";
import DeleteDialog from "/shared/DeleteDialog";
import QuestionSkip from "@/components/shared/QuestionSkip";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { timeSince } from "@formbricks/lib/time";
import { QuestionType } from "@formbricks/types/questions";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { PersonAvatar, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import toast from "react-hot-toast";
import { getPersonIdentifier } from "@formbricks/lib/people/helpers";
import { TTag } from "@formbricks/types/v1/tags";
import { TEnvironment } from "@formbricks/types/v1/environment";

export interface SingleResponseCardProps {
  survey: TSurvey;
  response: TResponse;
  pageType: string;
  environmentTags: TTag[];
  environment: TEnvironment;
}

interface TooltipRendererProps {
  shouldRender: boolean;
  tooltipContent: ReactNode;
  children: ReactNode;
}

function TooltipRenderer(props: TooltipRendererProps) {
  const { children, shouldRender, tooltipContent } = props;
  if (shouldRender) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>{children}</TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{children}</>;
}

export default function SingleResponseCard({
  survey,
  response,
  pageType,
  environmentTags,
  environment,
}: SingleResponseCardProps) {
  const environmentId = survey.environmentId;
  const router = useRouter();
  const displayIdentifier = response.person ? getPersonIdentifier(response.person) : null;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isSubmissionFresh = isSubmissionTimeLessThan5Minutes(response.updatedAt);
  let skippedQuestions: string[][] = [];
  let temp: string[] = [];

  function isValidValue(value) {
    return (
      (typeof value === "string" && value.trim() !== "") ||
      (Array.isArray(value) && value.length > 0) ||
      typeof value === "number"
    );
  }

  if (response.finished) {
    survey.questions.forEach((question) => {
      if (!response.data[question.id]) {
        temp.push(question.id);
      } else {
        if (temp.length > 0) {
          skippedQuestions.push([...temp]);
          temp = [];
        }
      }
    });
  } else {
    for (let index = survey.questions.length - 1; index >= 0; index--) {
      const question = survey.questions[index];
      if (!response.data[question.id]) {
        if (skippedQuestions.length === 0) {
          temp.push(question.id);
        } else if (skippedQuestions.length > 0 && !isValidValue(response.data[question.id])) {
          temp.push(question.id);
        }
      } else {
        if (temp.length > 0) {
          temp.reverse();
          skippedQuestions.push([...temp]);
          temp = [];
        }
      }
    }
  }
  // Handle the case where the last entries are empty
  if (temp.length > 0) {
    skippedQuestions.push(temp);
  }

  function handleArray(data: string | number | string[]): string {
    if (Array.isArray(data)) {
      return data.join(", ");
    } else {
      return String(data);
    }
  }

  const handleDeleteSubmission = async () => {
    setIsDeleting(true);
    try {
      await deleteResponseAction(response.id);
      router.refresh();
      toast.success("Submission deleted successfully.");
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderTooltip = Boolean(
    (response.personAttributes && Object.keys(response.personAttributes).length > 0) ||
      (response.meta?.userAgent && Object.keys(response.meta.userAgent).length > 0)
  );

  function isSubmissionTimeLessThan5Minutes(submissionTimeISOString: Date) {
    const submissionTime: Date = new Date(submissionTimeISOString);
    const currentTime: Date = new Date();
    const timeDifference: number = (currentTime.getTime() - submissionTime.getTime()) / (1000 * 60); // Convert milliseconds to minutes
    return timeDifference < 5;
  }

  const tooltipContent = (
    <>
      {response.singleUseId && (
        <div>
          <p className="py-1 font-bold text-slate-700">SingleUse ID:</p>
          <span>{response.singleUseId}</span>
        </div>
      )}
      {response.personAttributes && Object.keys(response.personAttributes).length > 0 && (
        <div>
          <p className="py-1 font-bold text-slate-700">Person attributes:</p>
          {Object.keys(response.personAttributes).map((key) => (
            <p key={key}>
              {key}:{" "}
              <span className="font-bold">{response.personAttributes && response.personAttributes[key]}</span>
            </p>
          ))}
        </div>
      )}

      {response.meta?.userAgent && Object.keys(response.meta.userAgent).length > 0 && (
        <div className="text-slate-600">
          {response.personAttributes && Object.keys(response.personAttributes).length > 0 && (
            <hr className="my-2 border-slate-200" />
          )}
          <p className="py-1 font-bold text-slate-700">Device info:</p>
          {response.meta?.userAgent?.browser && <p>Browser: {response.meta.userAgent.browser}</p>}
          {response.meta?.userAgent?.os && <p>OS: {response.meta.userAgent.os}</p>}
          {response.meta?.userAgent && (
            <p>
              Device:{" "}
              {response.meta.userAgent.device ? response.meta.userAgent.device : "PC / Generic device"}
            </p>
          )}
        </div>
      )}
    </>
  );
  const deleteSubmissionToolTip = <>This submission is in progress.</>;

  return (
    <div className={clsx("group relative", isOpen && "min-h-[300px]")}>
      <div
        className={clsx(
          "relative z-10 my-6 rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition-all",
          pageType === "response" &&
            (isOpen ? "w-3/4" : response.notes.length ? "w-[96.5%]" : "w-full group-hover:w-[96.5%]")
        )}>
        <div className="space-y-2 px-6 pb-5 pt-6">
          <div className="flex items-center justify-between">
            {pageType === "response" && (
              <div>
                {response.person?.id ? (
                  <Link
                    className="group flex items-center"
                    href={`/environments/${environmentId}/people/${response.person.id}`}>
                    <TooltipRenderer shouldRender={renderTooltip} tooltipContent={tooltipContent}>
                      <PersonAvatar personId={response.person.id} />
                    </TooltipRenderer>
                    <h3 className="ph-no-capture ml-4 pb-1 font-semibold text-slate-600 hover:underline">
                      {displayIdentifier}
                    </h3>
                  </Link>
                ) : (
                  <div className="group flex items-center">
                    <TooltipRenderer shouldRender={renderTooltip} tooltipContent={tooltipContent}>
                      <PersonAvatar personId="anonymous" />
                    </TooltipRenderer>
                    <h3 className="ml-4 pb-1 font-semibold text-slate-600">Anonymous</h3>
                  </div>
                )}
              </div>
            )}

            {pageType === "people" && (
              <div className="flex items-center justify-center space-x-2 rounded-full bg-slate-100 p-1 px-2 text-sm text-slate-600">
                {(survey.type === "link" || environment.widgetSetupCompleted) && (
                  <SurveyStatusIndicator status={survey.status} />
                )}
                <Link
                  className="hover:underline"
                  href={`/environments/${environmentId}/surveys/${survey.id}/summary`}>
                  {survey.name}
                </Link>
              </div>
            )}

            <div className="flex space-x-4 text-sm">
              <time className="text-slate-500" dateTime={timeSince(response.updatedAt.toISOString())}>
                {timeSince(response.updatedAt.toISOString())}
              </time>
              <TooltipRenderer shouldRender={isSubmissionFresh} tooltipContent={deleteSubmissionToolTip}>
                <TrashIcon
                  onClick={() => {
                    if (!isSubmissionFresh) {
                      setDeleteDialogOpen(true);
                    }
                  }}
                  className={`h-4 w-4 ${
                    isSubmissionFresh
                      ? "cursor-not-allowed text-gray-400"
                      : "text-slate-500 hover:text-red-700"
                  } `}
                />
              </TooltipRenderer>
            </div>
          </div>
        </div>
        <div className="space-y-6 rounded-b-lg bg-white p-6">
          {survey.questions.map((question) => {
            const skipped = skippedQuestions.find((skippedQuestionElement) =>
              skippedQuestionElement.includes(question.id)
            );

            // If found, remove it from the list
            if (skipped) {
              skippedQuestions = skippedQuestions.filter((item) => item !== skipped);
            }

            return (
              <div key={`${question.id}`}>
                {isValidValue(response.data[question.id]) ? (
                  <p className="text-sm text-slate-500">{question.headline}</p>
                ) : (
                  <QuestionSkip
                    skippedQuestions={skipped}
                    questions={survey.questions}
                    status={
                      response.finished ||
                      (skippedQuestions.length > 0 &&
                        !skippedQuestions[skippedQuestions.length - 1].includes(question.id))
                        ? "skipped"
                        : "aborted"
                    }
                  />
                )}
                {typeof response.data[question.id] !== "object" ? (
                  question.type === QuestionType.Rating ? (
                    <div>
                      <RatingResponse
                        scale={question.scale}
                        answer={response.data[question.id]}
                        range={question.range}
                      />
                    </div>
                  ) : (
                    <p className="ph-no-capture my-1 font-semibold text-slate-700">
                      {response.data[question.id]}
                    </p>
                  )
                ) : (
                  <p className="ph-no-capture my-1 font-semibold text-slate-700">
                    {handleArray(response.data[question.id])}
                  </p>
                )}
              </div>
            );
          })}
          {response.finished && (
            <div className="flex">
              <CheckCircleIcon className="h-6 w-6 text-slate-400" />
              <p className="mx-2 rounded-lg bg-slate-100 px-2 text-slate-700">Completed</p>
            </div>
          )}
        </div>

        <ResponseTagsWrapper
          environmentId={environmentId}
          responseId={response.id}
          tags={response.tags.map((tag) => ({ tagId: tag.id, tagName: tag.name }))}
          environmentTags={environmentTags}
        />

        <DeleteDialog
          open={deleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          deleteWhat="response"
          onDelete={handleDeleteSubmission}
          isDeleting={isDeleting}
        />
      </div>
      {pageType === "response" && (
        <ResponseNotes
          responseId={response.id}
          notes={response.notes}
          environmentId={environmentId}
          surveyId={survey.id}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      )}
    </div>
  );
}
