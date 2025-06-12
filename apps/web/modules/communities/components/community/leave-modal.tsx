"use client";

import { removeUserCommunityAction } from "@/modules/communities/actions";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  communityName?: string | null;
  creatorId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function LeaveModal({ creatorId, open, setOpen }: Props) {
  const { t } = useTranslate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClose = () => {
    setOpen(false);
  };

  const handleLeave = async () => {
    try {
      setLoading(true);

      await removeUserCommunityAction({
        creatorId: creatorId,
      });

      toast.success(t("environments.community.remove.community_successfully_removed"));
      setLoading(false);
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to leave community", err);
      setLoading(false);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-medium text-slate-700">{t("common.leave_community")}</h3>

          <p className="text-slate-600">{t("environments.community.confirm_leave")}</p>
        </div>

        <div className="mt-8 flex w-full justify-end gap-3">
          <Button disabled={loading} type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>

          <Button
            aria-label={t("common.leave_community")}
            onClick={handleLeave}
            disabled={loading}
            variant="destructive"
            className="ring-offset-background focus-visible:ring-ring group inline-flex min-w-36 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
            {loading ? <LoadingSpinner /> : <>{t("common.leave_community")}</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default LeaveModal;
