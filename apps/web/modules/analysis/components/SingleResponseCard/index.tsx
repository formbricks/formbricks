"use client";

import SendModal from "@/modules/alchemy-wallet/components/common/send-modal";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import clsx from "clsx";
import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TransactionLike } from "zksync-ethers/build/types";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { deleteResponseAction, getResponseAction } from "./actions";
import { createResponseNoteAction } from "./actions";
import { ResponseNotes } from "./components/ResponseNote";
// import { ResponseTagsWrapper } from "./components/ResponseTagsWrapper";
import { SingleResponseCardBody } from "./components/SingleResponseCardBody";
import { SingleResponseCardHeader } from "./components/SingleResponseCardHeader";
import { isValidValue } from "./util";

interface SingleResponseCardProps {
  balances?: TokenBalance[] | null;
  survey: TSurvey;
  response: TResponse;
  user?: TUser;
  pageType: "people" | "response";
  environmentTags: TTag[];
  environment: TEnvironment;
  updateResponse?: (responseId: string, responses: TResponse) => void;
  deleteResponses?: (responseIds: string[]) => void;
  isReadOnly: boolean;
  setSelectedResponseId?: (responseId: string | null) => void;
}

export const SingleResponseCard = ({
  balances,
  survey,
  response,
  user,
  pageType,
  environment,
  updateResponse,
  deleteResponses,
  isReadOnly,
  setSelectedResponseId,
}: SingleResponseCardProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [showSendModal, setShowSendModal] = useState(false);
  const verifiedAddress = response.data["verifiedAddress"];
  const reward = survey.reward;
  const initialBalance = useMemo(() => {
    if (!balances || !reward) return null;
    return balances.find((balance) => balance.token.address == reward.contractAddress) || null;
  }, [balances, reward]);
  const [selectedBalance, setSelectedBalance] = useState<TokenBalance | null>(initialBalance);
  const openSendModal = useCallback(() => {
    setShowSendModal(true);
  }, []);

  let skippedQuestions: string[][] = [];
  let temp: string[] = [];

  if (response.finished) {
    survey.questions.forEach((question) => {
      if (!isValidValue(response.data[question.id])) {
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

  const handleDeleteResponse = async () => {
    setIsDeleting(true);
    try {
      if (isReadOnly) {
        throw new Error(t("common.not_authorized"));
      }
      await deleteResponseAction({ responseId: response.id });
      deleteResponses?.([response.id]);
      router.refresh();
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

  const handlePayReward = useCallback(async (tx: TransactionLike) => {
    try {
      const noteText = `${t("environments.surveys.responses.paid_reward_to")} ${tx.to}\n${t("environments.surveys.responses.transaction_hash")} ${tx.hash}`;
      await createResponseNoteAction({ responseId: response.id, text: noteText });
      await updateFetchedResponses();
    } catch (e) {
      toast.error(t("environments.surveys.responses.an_error_occurred_creating_a_new_note"));
    }
  }, []);

  return (
    <div className={clsx("group relative", isOpen && "min-h-[300px]")}>
      <div
        className={clsx(
          "relative z-20 my-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-all",
          pageType === "response" &&
            (isOpen
              ? "w-3/4"
              : user && response.notes.length
                ? "w-[96.5%]"
                : cn("w-full", user ? "group-hover:w-[96.5%]" : ""))
        )}>
        <SingleResponseCardHeader
          pageType="response"
          response={response}
          survey={survey}
          environment={environment}
          user={user}
          isReadOnly={isReadOnly}
          setDeleteDialogOpen={setDeleteDialogOpen}
        />

        <SingleResponseCardBody survey={survey} response={response} skippedQuestions={skippedQuestions} />

        {/* <ResponseTagsWrapper
          key={response.id}
          environmentId={environmentId}
          responseId={response.id}
          tags={response.tags.map((tag) => ({ tagId: tag.id, tagName: tag.name }))}
          environmentTags={environmentTags}
          updateFetchedResponses={updateFetchedResponses}
          isReadOnly={isReadOnly}
        /> */}

        <DeleteDialog
          open={deleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          deleteWhat="response"
          onDelete={handleDeleteResponse}
          isDeleting={isDeleting}
        />
      </div>
      {user && pageType === "response" && (
        <ResponseNotes
          user={user}
          responseId={response.id}
          notes={response.notes}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          updateFetchedResponses={updateFetchedResponses}
        />
      )}
      <div>
        {balances && reward && (
          <>
            <Button
              variant="secondary"
              onClick={() => openSendModal()}
              className="inline-flex flex-nowrap items-center gap-2">
              <SendIcon className="h-4 w-4" strokeWidth={2} />
              {t("common.pay_reward")}
            </Button>
            <SendModal
              balances={balances}
              onSelectBalance={setSelectedBalance}
              address={verifiedAddress.toString()}
              balance={selectedBalance}
              amount={Number(reward.amount)}
              onModalSubmit={handlePayReward}
              setOpen={setShowSendModal}
              open={showSendModal}
            />
          </>
        )}
      </div>
    </div>
  );
};
