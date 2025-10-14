"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { TFunction } from "i18next";
import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyQuota, TSurveyQuotaInput } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createQuotaAction,
  deleteQuotaAction,
  getQuotaResponseCountAction,
} from "@/modules/ee/quotas/actions";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { QuotaList } from "./quota-list";
import { QuotaModal } from "./quota-modal";

interface QuotasCardProps {
  localSurvey: TSurvey;
  isQuotasAllowed: boolean;
  isFormbricksCloud?: boolean;
  quotas: TSurveyQuota[];
  hasResponses: boolean;
}

const AddQuotaButton = ({
  setIsQuotaModalOpen,
  setActiveQuota,
  t,
  hasResponses,
  setOpenCreateQuotaConfirmationModal,
}: {
  setIsQuotaModalOpen: (open: boolean) => void;
  setActiveQuota: (quota: TSurveyQuota | null) => void;
  t: TFunction;
  hasResponses: boolean;
  setOpenCreateQuotaConfirmationModal: (open: boolean) => void;
}) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        if (hasResponses) {
          setOpenCreateQuotaConfirmationModal(true);
        } else {
          setIsQuotaModalOpen(true);
          setActiveQuota(null);
        }
      }}>
      {t("environments.surveys.edit.quotas.add_quota")}
    </Button>
  );
};

export const QuotasCard = ({
  localSurvey,
  isQuotasAllowed,
  isFormbricksCloud,
  quotas,
  hasResponses,
}: QuotasCardProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [activeQuota, setActiveQuota] = useState<TSurveyQuota | null>(null);
  const environmentId = localSurvey.environmentId;
  const [quotaToDelete, setQuotaToDelete] = useState<TSurveyQuota | null>(null);
  const [quotaResponseCount, setQuotaResponseCount] = useState(0);
  const [isDeletingQuota, setIsDeletingQuota] = useState(false);
  const [openCreateQuotaConfirmationModal, setOpenCreateQuotaConfirmationModal] = useState(false);
  const router = useRouter();

  const [parent] = useAutoAnimate();

  const handleQuotaDelete = async (quotaId: string) => {
    setIsDeletingQuota(true);
    const deleteQuotaActionResult = await deleteQuotaAction({
      quotaId: quotaId,
      surveyId: localSurvey.id,
    });
    if (deleteQuotaActionResult?.data) {
      toast.success(t("environments.surveys.edit.quotas.quota_deleted_successfull_toast"));
      // Clear activeQuota if we're deleting the currently active quota
      if (activeQuota?.id === quotaId) {
        setActiveQuota(null);
      }
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(deleteQuotaActionResult);
      toast.error(errorMessage);
    }
    setQuotaToDelete(null);
    setIsDeletingQuota(false);
    setActiveQuota(null);
    setQuotaResponseCount(0);
    setIsQuotaModalOpen(false);
  };

  const duplicateQuota = async (quota: TSurveyQuota) => {
    const { id, createdAt, updatedAt, ...rest } = quota;
    const quotaInput: TSurveyQuotaInput = {
      ...rest,
      name: `${quota.name} (Copy)`,
    };
    const duplicateQuotaActionResult = await createQuotaAction({
      quota: quotaInput,
    });
    if (duplicateQuotaActionResult?.data) {
      toast.success(t("environments.surveys.edit.quotas.quota_duplicated_successfull_toast"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(duplicateQuotaActionResult);
      toast.error(errorMessage);
    }
  };

  const openEditQuotaModal = async (quota: TSurveyQuota) => {
    const quotaResponseCountActionResult = await getQuotaResponseCountAction({
      quotaId: quota.id,
    });
    if (quotaResponseCountActionResult?.data) {
      setQuotaResponseCount(quotaResponseCountActionResult.data.count);
    } else {
      const errorMessage = getFormattedErrorMessage(quotaResponseCountActionResult);
      toast.error(errorMessage);
      return;
    }
    setActiveQuota(quota);
    setIsQuotaModalOpen(true);
  };

  const hasQuotas = quotas.length > 0;

  return (
    <>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="w-full rounded-lg border border-slate-300 bg-white">
        <Collapsible.Trigger
          asChild
          className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50"
          id="quotasCardTrigger">
          <div className="inline-flex px-4 py-4">
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>

            <div>
              <p className="font-semibold text-slate-800">{t("common.quotas")}</p>
              <p className="mt-1 text-sm text-slate-500">{t("common.quotas_description")}</p>
            </div>
          </div>
        </Collapsible.Trigger>

        <Collapsible.Content className="flex flex-col" ref={parent}>
          <hr className="py-1 text-slate-600" />
          <div className="px-3 pb-3 pt-1">
            {!isQuotasAllowed ? (
              <UpgradePrompt
                title={t("environments.surveys.edit.quotas.upgrade_prompt_title")}
                description={t("common.quotas_description")}
                buttons={[
                  {
                    text: isFormbricksCloud
                      ? t("common.start_free_trial")
                      : t("common.request_trial_license"),
                    href: isFormbricksCloud
                      ? `/environments/${environmentId}/settings/billing`
                      : "https://formbricks.com/upgrade-self-hosting-license",
                  },
                  {
                    text: t("common.learn_more"),
                    href: isFormbricksCloud
                      ? `/environments/${environmentId}/settings/billing`
                      : "https://formbricks.com/learn-more-self-hosting-license",
                  },
                ]}
              />
            ) : (
              <div className="space-y-4">
                {hasQuotas ? (
                  <QuotaList
                    quotas={quotas}
                    onEdit={openEditQuotaModal}
                    deleteQuota={setQuotaToDelete}
                    duplicateQuota={duplicateQuota}
                  />
                ) : (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="mb-4 text-sm text-slate-500">{t("common.quotas_description")}</p>
                    <AddQuotaButton
                      setIsQuotaModalOpen={setIsQuotaModalOpen}
                      setActiveQuota={setActiveQuota}
                      t={t}
                      hasResponses={hasResponses}
                      setOpenCreateQuotaConfirmationModal={setOpenCreateQuotaConfirmationModal}
                    />
                  </div>
                )}

                {hasQuotas && (
                  <div>
                    <AddQuotaButton
                      setIsQuotaModalOpen={setIsQuotaModalOpen}
                      setActiveQuota={setActiveQuota}
                      t={t}
                      hasResponses={hasResponses}
                      setOpenCreateQuotaConfirmationModal={setOpenCreateQuotaConfirmationModal}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {isQuotasAllowed && (
        <QuotaModal
          open={isQuotaModalOpen}
          onOpenChange={setIsQuotaModalOpen}
          survey={localSurvey}
          quota={activeQuota}
          setQuotaToDelete={setQuotaToDelete}
          duplicateQuota={duplicateQuota}
          onClose={() => {
            setIsQuotaModalOpen(false);
            setActiveQuota(null);
            setQuotaResponseCount(0);
          }}
          hasResponses={hasResponses}
          quotaResponseCount={quotaResponseCount}
        />
      )}
      <DeleteDialog
        open={!!quotaToDelete}
        setOpen={(open) => !open && setQuotaToDelete(null)}
        deleteWhat={t("common.quota")}
        text={t("environments.surveys.edit.quotas.delete_quota_confirmation_text", {
          quotaName: `"${quotaToDelete?.name}"`,
        })}
        onDelete={() => quotaToDelete && handleQuotaDelete(quotaToDelete.id)}
        isDeleting={isDeletingQuota}
      />
      <ConfirmationModal
        title={t("environments.surveys.edit.quotas.create_quota_for_public_survey")}
        description={t("environments.surveys.edit.quotas.create_quota_for_public_survey_description")}
        body={t("environments.surveys.edit.quotas.create_quota_for_public_survey_text")}
        open={openCreateQuotaConfirmationModal}
        setOpen={setOpenCreateQuotaConfirmationModal}
        onConfirm={() => {
          setOpenCreateQuotaConfirmationModal(false);
          setIsQuotaModalOpen(true);
          setActiveQuota(null);
          setQuotaResponseCount(0);
        }}
        buttonVariant="default"
        buttonText={t("common.continue")}
      />
    </>
  );
};
