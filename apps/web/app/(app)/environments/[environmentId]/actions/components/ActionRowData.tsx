import { Code2Icon, MousePointerClickIcon, SparklesIcon } from "lucide-react";
import { timeSinceConditionally } from "@formbricks/lib/time";
import { TActionClass } from "@formbricks/types/action-classes";

export const ActionClassDataRow = ({ actionClass }: { actionClass: TActionClass }) => {
  return (
    <div className="m-2 grid h-16 grid-cols-6 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
      <div className="col-span-4 flex items-center pl-6 text-sm">
        <div className="flex items-center">
          <div className="h-5 w-5 flex-shrink-0 text-slate-500">
            {actionClass.type === "code" ? (
              <Code2Icon className="h-5 w-5" />
            ) : actionClass.type === "noCode" ? (
              <MousePointerClickIcon className="h-5 w-5" />
            ) : actionClass.type === "automatic" ? (
              <SparklesIcon className="h-5 w-5" />
            ) : null}
          </div>
          <div className="ml-4 text-left">
            <div className="font-medium text-slate-900">{actionClass.name}</div>
            <div className="text-xs text-slate-400">{actionClass.description}</div>
          </div>
        </div>
      </div>
      <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        {timeSinceConditionally(actionClass.createdAt.toString())}
      </div>
      <div className="text-center"></div>
    </div>
  );
};
