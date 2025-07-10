"use client";

import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { CheckIcon, CopyIcon } from "lucide-react";
import toast from "react-hot-toast";

interface ShareInviteModalProps {
  inviteToken: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const ShareInviteModal = ({ inviteToken, open, setOpen }: ShareInviteModalProps) => {
  const { t } = useTranslate();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <CheckIcon />
          <DialogTitle>{t("environments.settings.general.organization_invite_link_ready")}</DialogTitle>
          <DialogDescription>
            {t(
              "environments.settings.general.share_this_link_to_let_your_organization_member_join_your_organization"
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              id="inviteLinkText"
              value={`${window.location.protocol}//${window.location.host}/invite?token=${inviteToken}`}></Input>
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
