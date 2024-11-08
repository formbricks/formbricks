"use client";

import { CreateNewActionTab } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/CreateNewActionTab";
import { MousePointerClickIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass } from "@formbricks/types/action-classes";
import { Button } from "@formbricks/ui/components/Button";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";
import { Modal } from "@formbricks/ui/components/Modal";

interface AddActionModalProps {
  environmentId: string;
  actionClasses: TActionClass[];
}

export const AddActionModal = ({ environmentId, actionClasses }: AddActionModalProps) => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const { membershipRole, isLoading, error } = useMembershipRole(environmentId);
  const { isViewer } = getAccessFlags(membershipRole);
  const [newActionClasses, setNewActionClasses] = useState<TActionClass[]>(actionClasses);

  if (error) {
    return <ErrorComponent />;
  }

  return (
    <>
      <Button size="sm" loading={isLoading} onClick={() => setOpen(true)} EndIcon={PlusIcon}>
        {t("common.add_action")}
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
            isViewer={isViewer}
            setActionClasses={setNewActionClasses}
            setOpen={setOpen}
          />
        </div>
      </Modal>
    </>
  );
};
