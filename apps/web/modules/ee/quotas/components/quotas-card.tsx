"use client";

import { deleteQuotaAction } from "@/modules/ee/quotas/actions";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuotaList } from "./quota-list";
import { QuotaModal } from "./quota-modal";

interface QuotasCardProps {
  localSurvey: TSurvey;
  isQuotasEnabled: boolean;
  isFormbricksCloud?: boolean;
  quotas: TSurveyQuota[];
}

export const QuotasCard = ({ localSurvey, isQuotasEnabled, isFormbricksCloud, quotas }: QuotasCardProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [activeQuota, setActiveQuota] = useState<TSurveyQuota | null>(null);
  const environmentId = localSurvey.environmentId;
  const [quotaToDelete, setQuotaToDelete] = useState<TSurveyQuota | null>(null);
  const [isDeletingQuota, setIsDeletingQuota] = useState(false);
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
      router.refresh();
    } else {
      toast.error(t("environments.surveys.edit.quotas.failed_to_delete_quota_toast"));
    }
    setQuotaToDelete(null);
    setIsDeletingQuota(false);
  };

  const handleEditQuota = (quota: TSurveyQuota) => {
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
        <Collapsible.CollapsibleTrigger
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
        </Collapsible.CollapsibleTrigger>

        <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
          <hr className="py-1 text-slate-600" />
          <div className="px-3 pb-3 pt-1">
            {!isQuotasEnabled ? (
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
                  <QuotaList quotas={quotas} onEdit={handleEditQuota} deleteQuota={setQuotaToDelete} />
                ) : (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="mb-4 text-sm text-slate-600">
                      {t("environments.surveys.edit.quotas.no_quotas_description")}
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setIsQuotaModalOpen(true)}>
                      <PlusIcon className="mr-2 h-4 w-4" />
                      {t("environments.surveys.edit.quotas.add_quota")}
                    </Button>
                  </div>
                )}

                {hasQuotas && (
                  <div className="border-t pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIsQuotaModalOpen(true);
                        setActiveQuota(null);
                      }}>
                      <PlusIcon className="mr-2 h-4 w-4" />
                      {t("environments.surveys.edit.quotas.add_quota")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>

      {isQuotasEnabled && (
        <QuotaModal
          open={isQuotaModalOpen}
          onOpenChange={setIsQuotaModalOpen}
          survey={localSurvey}
          quota={activeQuota}
          deleteQuota={setQuotaToDelete}
          onClose={() => {
            setIsQuotaModalOpen(false);
            setActiveQuota(null);
          }}
        />
      )}
      <ConfirmationModal
        open={!!quotaToDelete}
        setOpen={(open) => !open && setQuotaToDelete(null)}
        title={t("environments.surveys.edit.quotas.delete_quota_confirmation_title")}
        text={t("environments.surveys.edit.quotas.delete_quota_confirmation_text", {
          quotaName: `"${quotaToDelete?.name}"`,
        })}
        onConfirm={() => quotaToDelete && handleQuotaDelete(quotaToDelete.id)}
        buttonVariant="destructive"
        buttonText={t("common.delete")}
        buttonLoading={isDeletingQuota}
      />
    </>
  );
};
