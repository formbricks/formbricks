"use client";

import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";

interface ShareInviteModalProps {
  inviteToken: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const ShareInviteModal = ({ inviteToken, open, setOpen }: ShareInviteModalProps) => {
  const linkTextRef = useRef(null);
  const { t } = useTranslate();
  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <Modal open={open} setOpen={setOpen} blur={false}>
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <CheckIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg font-semibold leading-6 text-slate-900">
            {t("environments.settings.general.organization_invite_link_ready")}
          </h3>
          <div className="mt-4">
            <p className="text-sm text-slate-500">
              {t(
                "environments.settings.general.share_this_link_to_let_your_organization_member_join_your_organization"
              )}
            </p>
            <p
              ref={linkTextRef}
              className="relative mt-3 w-full truncate rounded-lg border border-slate-300 bg-slate-50 p-3 text-center text-slate-800"
              onClick={() => handleTextSelection()}
              id="inviteLinkText">
              {`${window.location.protocol}//${window.location.host}/invite?token=${inviteToken}`}
            </p>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.protocol}//${window.location.host}/invite?token=${inviteToken}`
                );
                toast.success(t("common.copied_to_clipboard"));
              }}
              title={t("environments.settings.general.copy_invite_link_to_clipboard")}
              aria-label="Copy invite link to clipboard">
              {t("common.copy_link")}
              <CopyIcon />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
