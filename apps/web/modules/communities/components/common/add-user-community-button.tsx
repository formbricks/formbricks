"use client";

import { addUserCommunityAction } from "@/modules/communities/actions";
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

export function AddUserCommunityButton({ creatorId, className }: Props): React.JSX.Element {
  const { t } = useTranslate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAddUserCommunity = async () => {
    try {
      setLoading(true);

      await addUserCommunityAction({
        creatorId: creatorId,
      });
      toast.success(t("environments.community.add.community_successfully_added"));

      setLoading(false);
      router.refresh();
    } catch (err) {
      setLoading(false);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <Button
      aria-label={t("common.add_community")}
      onClick={handleAddUserCommunity}
      disabled={loading}
      variant={"default"}
      className={cn("text-sm", className)}>
      {loading ? <LoadingSpinner /> : <>{t("common.join_community")}</>}
    </Button>
  );
}

export default AddUserCommunityButton;
