"use client";

import AddUserCommunityButton from "@/modules/communities/components/community/add-user-community-button";
import LeaveModal from "@/modules/communities/components/community/leave-modal";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface CommunityActionsProps {
  community: TUserWhitelistInfo;
  currentUserId: string | undefined;
}

export default function CommunityActions({ community, currentUserId }: CommunityActionsProps) {
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const { t } = useTranslate();

  const isCommunityMember = community.members?.some((member) => member.id == currentUserId);

  return (
    <>
      <div className="max-w-xs">
        {isCommunityMember ? (
          <Button onClick={() => setLeaveModalOpen(true)}>{t("common.leave_community")}</Button>
        ) : (
          <AddUserCommunityButton creatorId={community.id} />
        )}
      </div>

      <LeaveModal creatorId={community.id} open={leaveModalOpen} setOpen={setLeaveModalOpen} />
    </>
  );
}
