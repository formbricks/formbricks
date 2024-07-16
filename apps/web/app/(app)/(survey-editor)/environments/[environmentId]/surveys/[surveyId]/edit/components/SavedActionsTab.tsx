import { Code2Icon, MousePointerClickIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { TActionClass } from "@formbricks/types/action-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/Input";

interface SavedActionsTabProps {
  actionClasses: TActionClass[];
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
  const availableActions = actionClasses.filter(
    (actionClass) => !localSurvey.triggers.some((trigger) => trigger.actionClass.id === actionClass.id)
  );
  const [filteredActionClasses, setFilteredActionClasses] = useState<TActionClass[]>(availableActions);

  const codeActions = filteredActionClasses.filter((actionClass) => actionClass.type === "code");
  const noCodeActions = filteredActionClasses.filter((actionClass) => actionClass.type === "noCode");
  const automaticActions = filteredActionClasses.filter((actionClass) => actionClass.type === "automatic");

  const handleActionClick = (action: TActionClass) => {
    setLocalSurvey((prev) => ({
      ...prev,
      triggers: prev.triggers.concat({ actionClass: action }),
    }));
    setOpen(false);
  };

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
        {[automaticActions, noCodeActions, codeActions].map(
          (actions, i) =>
            actions.length > 0 && (
              <div key={i} className="me-4">
                <h2 className="mb-2 mt-4 font-semibold">
                  {i === 0 ? "Automatic" : i === 1 ? "No code" : "Code"}
                </h2>
                <div className="flex flex-col gap-2">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100"
                      onClick={() => handleActionClick(action)}>
                      <div className="mt-1 flex items-center">
                        <div className="mr-1.5 h-4 w-4 text-slate-600">
                          {action.type === "code" ? (
                            <Code2Icon className="h-4 w-4" />
                          ) : action.type === "noCode" ? (
                            <MousePointerClickIcon className="h-4 w-4" />
                          ) : action.type === "automatic" ? (
                            <SparklesIcon className="h-4 w-4" />
                          ) : null}
                        </div>

                        <h4 className="text-sm font-semibold text-slate-600">{action.name}</h4>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{action.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
};
