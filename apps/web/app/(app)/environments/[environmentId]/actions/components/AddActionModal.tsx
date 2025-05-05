"use client";

import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
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
  // [UseTusk]

  const { t } = useTranslate();
  const [open, setOpen] = useState(false);

  const [newActionClasses, setNewActionClasses] = useState<TActionClass[]>(actionClasses);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("common.add_action")}
        <PlusIcon />
      </Button>
      <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false} restrictOverflow>
        <div className="flex h-full flex-col rounded-lg">
          <div className="rounded-t-lg bg-slate-100">
            <div className="flex w-full items-center justify-between p-6">
              <div className="flex items-center space-x-2">
                <div className="mr-1.5 h-6 w-6 text-slate-500">
                  <MousePointerClickIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-medium text-slate-700">
                    {t("environments.actions.track_new_user_action")}
                  </div>
                  <div className="text-sm text-slate-500">
                    {t("environments.actions.track_user_action_to_display_surveys_or_create_user_segment")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <CreateNewActionTab
            actionClasses={newActionClasses}
            environmentId={environmentId}
            isReadOnly={isReadOnly}
            setActionClasses={setNewActionClasses}
            setOpen={setOpen}
          />
        </div>
      </Modal>
    </>
  );
};
