"use client";

import { ChevronDownIcon, ChevronUpIcon, MessageSquareTextIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import {
  deleteResponseAction,
  getResponseAction,
} from "@/modules/analysis/components/SingleResponseCard/actions";
import { ResponseTagsWrapper } from "@/modules/analysis/components/SingleResponseCard/components/ResponseTagsWrapper";
import { SingleResponseCardBody } from "@/modules/analysis/components/SingleResponseCard/components/SingleResponseCardBody";
import {
  isSubmissionTimeMoreThan5Minutes,
  isValidValue,
} from "@/modules/analysis/components/SingleResponseCard/util";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import { DecrementQuotasCheckbox } from "@/modules/ui/components/decrement-quotas-checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ResponseSurveyCardProps {
  response: TResponseWithQuotas;
  survey: TSurvey;
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponseWithQuotas) => void;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const ResponseSurveyCard = ({
  response,
  survey,
  user,
  environmentTags,
  environment,
  updateResponseList,
  updateResponse,
  locale,
  isReadOnly,
}: Readonly<ResponseSurveyCardProps>) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasQuotas = (response?.quotas && response.quotas.length > 0) ?? false;
  const [decrementQuotas, setDecrementQuotas] = useState(hasQuotas);

  const surveyWithReplacedRecall = useMemo(
    () => replaceHeadlineRecall(survey, "default"),
    [survey]
  );

  const skippedQuestions: string[][] = useMemo(() => {
    const questions = getElementsFromBlocks(surveyWithReplacedRecall.blocks);

    const flushTemp = (temp: string[], result: string[][], shouldReverse = false) => {
      if (temp.length > 0) {
        if (shouldReverse) temp.reverse();
        result.push([...temp]);
        temp.length = 0;
      }
    };

    const processFinishedResponse = () => {
      const result: string[][] = [];
      const temp: string[] = [];
      for (const question of questions) {
        if (isValidValue(response.data[question.id])) {
          flushTemp(temp, result);
        } else {
          temp.push(question.id);
        }
      }
      flushTemp(temp, result);
      return result;
    };

    const processUnfinishedResponse = () => {
      const result: string[][] = [];
      const temp: string[] = [];
      for (let index = questions.length - 1; index >= 0; index--) {
        const question = questions[index];
        const hasNoData = !response.data[question.id];
        const shouldSkip =
          hasNoData && (result.length === 0 || !isValidValue(response.data[question.id]));
        if (shouldSkip) {
          temp.push(question.id);
        } else {
          flushTemp(temp, result, true);
        }
      }
      flushTemp(temp, result);
      return result;
    };

    return response.finished ? processFinishedResponse() : processUnfinishedResponse();
  }, [response.finished, response.data, surveyWithReplacedRecall.blocks]);

  const canResponseBeDeleted = response.finished
    ? true
    : isSubmissionTimeMoreThan5Minutes(response.updatedAt);

  const handleDeleteResponse = async () => {
    setIsDeleting(true);
    try {
      if (isReadOnly) {
        throw new Error(t("common.not_authorized"));
      }
      const result = await deleteResponseAction({ responseId: response.id, decrementQuotas });
      if (result?.serverError) {
        toast.error(getFormattedErrorMessage(result));
        return;
      }
      updateResponseList([response.id]);
      toast.success(t("environments.surveys.responses.response_deleted_successfully"));
      setDeleteDialogOpen(false);
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const updateFetchedResponses = async () => {
    const updatedResponse = await getResponseAction({ responseId: response.id });
    if (updatedResponse?.data) {
      updateResponse(response.id, updatedResponse.data as TResponseWithQuotas);
    }
  };

  const bodyId = `response-card-body-${response.id}`;
  const showDeleteButton = !!user && !isReadOnly;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
            <MessageSquareTextIcon className="h-4 w-4 text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {t("environments.contacts.survey_response_created")}
            </p>
            <Link
              href={`/environments/${environment.id}/surveys/${survey.id}/summary`}
              className="block truncate text-sm font-medium text-slate-700 hover:underline">
              {survey.name}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <time className="px-1" dateTime={response.createdAt.toString()}>
            {timeSince(response.createdAt.toString(), locale)}
          </time>
          {showDeleteButton &&
            (canResponseBeDeleted ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                aria-label={t("environments.surveys.responses.delete_response")}>
                <TrashIcon className="h-4 w-4" />
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled
                      className="text-slate-400"
                      aria-label={t("environments.surveys.responses.delete_response")}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {t("environments.surveys.responses.this_response_is_in_progress")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            aria-label={
              isExpanded
                ? t("environments.contacts.collapse_response")
                : t("environments.contacts.expand_response")
            }>
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-slate-400" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div id={bodyId}>
          <SingleResponseCardBody
            survey={surveyWithReplacedRecall}
            response={response}
            skippedQuestions={skippedQuestions}
            locale={locale}
          />

          <ResponseTagsWrapper
            key={response.id}
            environmentId={environment.id}
            responseId={response.id}
            tags={response.tags.map((tag) => ({ tagId: tag.id, tagName: tag.name }))}
            environmentTags={environmentTags}
            updateFetchedResponses={updateFetchedResponses}
            isReadOnly={isReadOnly}
            response={response}
            locale={locale}
          />
        </div>
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat={t("common.response")}
        onDelete={handleDeleteResponse}
        isDeleting={isDeleting}
        text={t("environments.surveys.responses.delete_response_confirmation")}>
        {hasQuotas && (
          <DecrementQuotasCheckbox
            title={t("environments.surveys.responses.delete_response_quotas")}
            checked={decrementQuotas}
            onCheckedChange={setDecrementQuotas}
          />
        )}
      </DeleteDialog>
    </div>
  );
};
