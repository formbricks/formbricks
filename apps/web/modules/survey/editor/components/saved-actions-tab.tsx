"use client";

import { ACTION_TYPE_ICON_LOOKUP } from "@/app/(app)/environments/[environmentId]/actions/utils";
import { Input } from "@/modules/ui/components/input";
import { ActionClass } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SavedActionsTabProps {
  actionClasses: ActionClass[];
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SavedActionsTab = ({
  actionClasses,
  localSurvey,
  setLocalSurvey,
  setOpen,
}: SavedActionsTabProps) => {
  const { t } = useTranslate();
  const availableActions = actionClasses.filter(
    (actionClass) => !localSurvey.triggers.some((trigger) => trigger.actionClass.id === actionClass.id)
  );
  const [filteredActionClasses, setFilteredActionClasses] = useState<ActionClass[]>(availableActions);

  const codeActions = filteredActionClasses.filter((actionClass) => actionClass.type === "code");
  const noCodeActions = filteredActionClasses.filter((actionClass) => actionClass.type === "noCode");

  const handleActionClick = (action: ActionClass) => {
    setLocalSurvey((prev) => ({
      ...prev,
      triggers: prev.triggers.concat({ actionClass: action }),
    }));
    setOpen(false);
  };

  const allActions = [...noCodeActions, ...codeActions];

  return (
    <div>
      <Input
        type="text"
        onChange={(e) => {
          setFilteredActionClasses(
            availableActions.filter((actionClass) =>
              actionClass.name.toLowerCase().includes(e.target.value.toLowerCase())
            )
          );
        }}
        className="mb-2 bg-white"
        placeholder="Search actions"
        id="search-actions"
      />
      <div className="max-h-96 overflow-y-auto">
        {!allActions.length && (
          <div className="pt-4 text-center">
            <span className="text-sm text-slate-500">No saved actions found</span>
          </div>
        )}
        {[noCodeActions, codeActions].map(
          (actions, i) =>
            actions.length > 0 && (
              <div key={i} className="me-4">
                <h2 className="mb-2 mt-4 font-semibold">
                  {i === 0 ? t("common.no_code") : t("common.code")}
                </h2>
                <div className="flex flex-col gap-2">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100"
                      onClick={() => handleActionClick(action)}>
                      <div className="mt-1 flex items-center">
                        <div className="mr-1.5 h-4 w-4 text-slate-600">
                          {ACTION_TYPE_ICON_LOOKUP[action.type]}
                        </div>
                        <h4 className="text-sm font-semibold text-slate-600">{action.name}</h4>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{action.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
};
