"use client";

import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import { MousePointerClickIcon } from "lucide-react";
import { useState } from "react";
import { TActionClass } from "@formbricks/types/action-classes";

interface AddActionModalProps {
  environmentId: string;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const AddActionModal = ({
  environmentId,
  actionClasses,
  isReadOnly,
  open,
  setOpen,
}: AddActionModalProps) => {
  const { t } = useTranslate();

  const [newActionClasses, setNewActionClasses] = useState<TActionClass[]>(actionClasses);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick>
        <DialogHeader>
          <MousePointerClickIcon />
          <DialogTitle>{t("environments.actions.track_new_user_action")}</DialogTitle>
          <DialogDescription>
            {t("environments.actions.track_user_action_to_display_surveys_or_create_user_segment")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CreateNewActionTab
            actionClasses={newActionClasses}
            environmentId={environmentId}
            isReadOnly={isReadOnly}
            setActionClasses={setNewActionClasses}
            setOpen={setOpen}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
