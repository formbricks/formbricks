"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse, TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { DecrementQuotasCheckbox } from "@/modules/ui/components/decrement-quotas-checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { deleteResponseAction, getResponseAction } from "./actions";
import { ResponseTagsWrapper } from "./components/ResponseTagsWrapper";
import { SingleResponseCardBody } from "./components/SingleResponseCardBody";
import { SingleResponseCardHeader } from "./components/SingleResponseCardHeader";
import { isValidValue } from "./util";

interface SingleResponseCardProps {
  survey: TSurvey;
  response: TResponseWithQuotas;
  user?: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  updateResponse?: (responseId: string, responses: TResponse) => void;
  updateResponseList?: (responseIds: string[]) => void;
  isReadOnly: boolean;
  setSelectedResponseId?: (responseId: string | null) => void;
  locale: TUserLocale;
}

export const SingleResponseCard = ({
  survey,
  response,
  user,
  environmentTags,
  environment,
  updateResponse,
  updateResponseList,
  isReadOnly,
  setSelectedResponseId,
  locale,
}: SingleResponseCardProps) => {
  const hasQuotas = (response?.quotas && response.quotas.length > 0) ?? false;
  const [decrementQuotas, setDecrementQuotas] = useState(hasQuotas);
  const { t } = useTranslation();
  const environmentId = survey.environmentId;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const skippedQuestions: string[][] = useMemo(() => {
    // Derive questions from blocks
    const questions = getElementsFromBlocks(survey.blocks);

    const flushTemp = (temp: string[], result: string[][], shouldReverse = false) => {
      if (temp.length > 0) {
        if (shouldReverse) temp.reverse();
        result.push([...temp]);
        temp.length = 0;
      }
    };

    const processFinishedResponse = () => {
      const result: string[][] = [];
      let temp: string[] = [];

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
      let temp: string[] = [];

      for (let index = questions.length - 1; index >= 0; index--) {
        const question = questions[index];
        const hasNoData = !response.data[question.id];
        const shouldSkip = hasNoData && (result.length === 0 || !isValidValue(response.data[question.id]));

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
  }, [response.finished, response.data, survey.blocks]);

  const handleDeleteResponse = async () => {
    setIsDeleting(true);
    try {
      if (isReadOnly) {
        throw new Error(t("common.not_authorized"));
      }
      await deleteResponseAction({ responseId: response.id, decrementQuotas });
      updateResponseList?.([response.id]);
      if (setSelectedResponseId) setSelectedResponseId(null);
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
    if (updatedResponse?.data && updatedResponse.data !== null && updateResponse) {
      updateResponse(response.id, updatedResponse.data);
    }
  };

  return (
    <div className="group relative">
      <div className="relative z-20 my-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-all">
        <SingleResponseCardHeader
          pageType="response"
          response={response}
          survey={survey}
          environment={environment}
          user={user}
          isReadOnly={isReadOnly}
          setDeleteDialogOpen={setDeleteDialogOpen}
          locale={locale}
        />

        <SingleResponseCardBody survey={survey} response={response} skippedQuestions={skippedQuestions} />

        <ResponseTagsWrapper
          key={response.id}
          environmentId={environmentId}
          responseId={response.id}
          tags={response.tags.map((tag) => ({ tagId: tag.id, tagName: tag.name }))}
          environmentTags={environmentTags}
          updateFetchedResponses={updateFetchedResponses}
          isReadOnly={isReadOnly}
          response={response}
          locale={locale}
        />

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
    </div>
  );
};
