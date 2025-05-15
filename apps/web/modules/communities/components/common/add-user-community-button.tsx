"use client";

import { addUserCommunityAction } from "@/modules/communities/actions";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
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
      className={cn(
        "ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}>
      {t("common.add_community")}
      <PlusIcon
        className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-180"
        strokeWidth={3}
      />
    </Button>
  );
}

export default AddUserCommunityButton;
