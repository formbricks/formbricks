"use client";

import { ReactNode, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TResponse, TResponseWithQuotas } from "@formbricks/types/responses";
import { getNotShownElementIds } from "@formbricks/types/surveys/not-shown";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import type { TOutcomeActions } from "@/modules/analysis/response-outcome/lib/outcome";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { DecrementQuotasCheckbox } from "@/modules/ui/components/decrement-quotas-checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { ResponseTagsWrapper } from "./components/ResponseTagsWrapper";
import { SingleResponseCardBody } from "./components/SingleResponseCardBody";
import { SingleResponseCardHeader } from "./components/SingleResponseCardHeader";
import { deleteResponse, getResponseCard } from "./lib/api-client";
import { getResponseCardRows } from "./lib/card-rows";
import { isSubmissionTimeMoreThan5Minutes } from "./util";

export interface SingleResponseCardHeaderRenderProps {
  onDeleteClick: () => void;
  canResponseBeDeleted: boolean;
}

interface SingleResponseCardProps {
  survey: TSurvey;
  response: TResponseWithQuotas;
  user?: TUser;
  environmentTags: Pick<TTag, "id" | "name">[];
  updateResponse?: (responseId: string, responses: TResponse) => void;
  updateResponseList?: (responseIds: string[]) => void;
  isReadOnly: boolean;
  setSelectedResponseId?: (responseId: string | null) => void;
  locale: TUserLocale;
  renderHeader?: (props: SingleResponseCardHeaderRenderProps) => ReactNode;
  /** Set where the card can mark and restore Low quality (the responses page); omitted elsewhere. */
  outcomeActions?: TOutcomeActions;
}

export const SingleResponseCard = ({
  survey,
  response,
  user,
  environmentTags,
  updateResponse,
  updateResponseList,
  isReadOnly,
  setSelectedResponseId,
  locale,
  renderHeader,
  outcomeActions,
}: Readonly<SingleResponseCardProps>) => {
  const hasQuotas = (response?.quotas && response.quotas.length > 0) ?? false;
  const [decrementQuotas, setDecrementQuotas] = useState(hasQuotas);
  const { t } = useTranslation();
  const workspaceId = survey.workspaceId;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // What each question shows: an answer, a skipped or aborted run, or Not shown (ENG-6936).
  const rows = useMemo(
    () =>
      getResponseCardRows({
        elements: getElementsFromBlocks(survey.blocks),
        data: response.data,
        finished: response.finished,
        notShownElementIds: getNotShownElementIds(response.notShown, survey.blocks),
      }),
    [response.finished, response.data, response.notShown, survey.blocks]
  );

  const handleDeleteResponse = async () => {
    setIsDeleting(true);
    try {
      if (isReadOnly) {
        throw new Error(t("common.not_authorized"));
      }
      await deleteResponse(response.id, { decrementQuotas });
      updateResponseList?.([response.id]);
      if (setSelectedResponseId) setSelectedResponseId(null);
      toast.success(t("workspace.surveys.responses.response_deleted_successfully"));
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsDeleting(false);
    }
  };

  const updateFetchedResponses = async () => {
    let updatedResponse: TResponseWithQuotas;
    try {
      updatedResponse = await getResponseCard(response.id);
    } catch {
      // The tag change itself went through; the card keeps what it shows until the next read.
      return;
    }
    updateResponse?.(response.id, updatedResponse);
  };

  const canResponseBeDeleted = response.finished
    ? true
    : isSubmissionTimeMoreThan5Minutes(response.updatedAt);

  return (
    <div className="group relative">
      <div className="relative z-20 rounded-xl border border-slate-200 bg-white shadow-xs transition-all">
        {renderHeader ? (
          renderHeader({
            onDeleteClick: () => setDeleteDialogOpen(true),
            canResponseBeDeleted,
          })
        ) : (
          <SingleResponseCardHeader
            pageType="response"
            response={response}
            survey={survey}
            user={user}
            isReadOnly={isReadOnly}
            setDeleteDialogOpen={setDeleteDialogOpen}
            locale={locale}
            outcomeActions={outcomeActions}
          />
        )}

        <SingleResponseCardBody survey={survey} response={response} rows={rows} locale={locale} />

        <ResponseTagsWrapper
          key={response.id}
          workspaceId={workspaceId}
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
          text={t("workspace.surveys.responses.delete_response_confirmation")}>
          {hasQuotas && (
            <DecrementQuotasCheckbox
              title={t("workspace.surveys.responses.delete_response_quotas")}
              checked={decrementQuotas}
              onCheckedChange={setDecrementQuotas}
            />
          )}
        </DeleteDialog>
      </div>
    </div>
  );
};
