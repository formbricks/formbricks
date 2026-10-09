"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { reactivateMember } from "../../lib/reactivate-member-client";

interface ReactivateMemberButtonProps {
  organizationId: string;
  userId: string;
  name: string;
}

/**
 * "Reactivate" on an inactive member (ENG-3610): owners and managers bring back someone the members
 * policy, or anyone, deactivated, which restarts their retention clock. The API refuses someone who
 * also belongs to another organisation, and its message says so. Runs under the member list's query
 * client (`MembersInfo`).
 */
export const ReactivateMemberButton = ({
  organizationId,
  userId,
  name,
}: Readonly<ReactivateMemberButtonProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const reactivate = useMutation({ mutationFn: () => reactivateMember({ userId, organizationId }) });

  const onClick = () =>
    reactivate.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("workspace.settings.data_retention.member_reactivated", { name }));
        // The member list is rendered on the server (an older module, not on the query cache), so the
        // page is re-rendered to show the new status. Moving the list onto a query is a follow-up.
        router.refresh();
      },
      onError: (error) =>
        toast.error(getV3ApiErrorMessage(error, t("workspace.settings.data_retention.reactivate_failed"))),
    });

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={reactivate.isPending}
      aria-label={t("workspace.settings.data_retention.reactivate_member_label", { name })}
      onClick={onClick}>
      {t("workspace.settings.data_retention.reactivate")}
    </Button>
  );
};
