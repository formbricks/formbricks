"use client";

import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { TCommunityMember } from "@formbricks/types/user";
import MemberItem from "./member-item";

interface MembersModalProps {
  members: TCommunityMember[];
}

const pageSize = 5;

export function MembersModal({ members }: MembersModalProps) {
  const [open, setOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useTranslate();

  const totalPages = Math.ceil(members.length / pageSize);

  const startIdx = (currentPage - 1) * pageSize;
  const currentMembers = members.slice(startIdx, startIdx + pageSize);

  const goToPrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setCurrentPage(1);
    }
  };

  return (
    <>
      <button
        onClick={() => handleOpenChange(true)}
        className="text-tertiary text-sm font-medium hover:underline">
        {t("common.view_all")}
      </button>

      <Modal open={open} setOpen={handleOpenChange}>
        <div className="flex flex-col">
          <div className="mb-6">
            <h3 className="text-xl font-medium">
              {t("common.members")} ({members.length})
            </h3>
          </div>

          <div className="h-[50vh] overflow-y-auto">
            <div className="space-y-3">
              {currentMembers.map((member) => (
                <MemberItem key={member.id} member={member} />
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end pt-4">
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrev}
                disabled={currentPage == 1}
                className="h-8 w-8">
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>

              <span className="px-2">
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                disabled={currentPage == totalPages}
                className="h-8 w-8">
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default MembersModal;
