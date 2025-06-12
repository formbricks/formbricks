"use client";

import { removeUserCommunityAction } from "@/modules/communities/actions";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";

interface Props {
  creatorId: string;
  className?: string;
}

export function RemoveUserCommunityButton({ creatorId, className }: Props): React.JSX.Element {
  const { t } = useTranslate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRemoveUserCommunity = async () => {
    try {
      setLoading(true);

      await removeUserCommunityAction({
        creatorId: creatorId,
      });
      toast.success(t("environments.community.remove.community_successfully_removed"));

      setLoading(false);
      router.refresh();
    } catch (err) {
      setLoading(false);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <Button
      aria-label={t("common.leave_community")}
      onClick={handleRemoveUserCommunity}
      disabled={loading}
      variant="destructive"
      className={cn(
        "ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}>
      {loading ? <LoadingSpinner /> : <>{t("common.leave_community")}</>}
    </Button>
  );
}

export default RemoveUserCommunityButton;
