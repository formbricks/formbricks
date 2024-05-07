"use client";

import { CreateNewActionTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CreateNewActionTab";
import { MousePointerClickIcon } from "lucide-react";

import { TActionClass } from "@formbricks/types/actionClasses";
import { Modal } from "@formbricks/ui/Modal";

interface AddNoCodeActionModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  actionClasses: TActionClass[];
  setActionClasses?;
  isViewer: boolean;
}

export default function AddNoCodeActionModal({
  environmentId,
  open,
  setOpen,
  actionClasses,
  setActionClasses,
  isViewer,
}: AddNoCodeActionModalProps) {
  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <MousePointerClickIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Track New User Action</div>
                <div className="text-sm text-slate-500">
                  Track a user action to display surveys or create user segment.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4">
        <CreateNewActionTab
          actionClasses={actionClasses}
          environmentId={environmentId}
          isViewer={isViewer}
          setActionClasses={setActionClasses}
          setOpen={setOpen}
        />
      </div>
    </Modal>
  );
}
