"use client";

import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import { MousePointerClickIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { TActionClass } from "@formbricks/types/action-classes";

interface AddActionModalProps {
  environmentId: string;
  actionClasses: TActionClass[];
  isReadOnly: boolean;
}

export const AddActionModal = ({ environmentId, actionClasses, isReadOnly }: AddActionModalProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);

  const [newActionClasses, setNewActionClasses] = useState<TActionClass[]>(actionClasses);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("common.add_action")}
        <PlusIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent disableCloseOnOutsideClick>
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <MousePointerClickIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-medium text-slate-700">
                  {t("environments.actions.track_new_user_action")}
                </DialogTitle>
                <div className="text-sm text-slate-500">
                  {t("environments.actions.track_user_action_to_display_surveys_or_create_user_segment")}
                </div>
              </div>
            </div>
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
    </>
  );
};
