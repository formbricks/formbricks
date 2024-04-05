import { formatDistance } from "date-fns";
import { CodeIcon, MousePointerClickIcon, SparklesIcon } from "lucide-react";

import { TAction } from "@formbricks/types/actions";
import { Label } from "@formbricks/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui/Popover";

export const ActivityItemIcon = ({ actionItem }: { actionItem: TAction }) => (
  <div className="h-12 w-12 rounded-full bg-white p-3 text-slate-500  duration-100 ease-in-out group-hover:scale-110 group-hover:text-slate-600">
    <div>
      {actionItem.actionClass?.type === "code" && <CodeIcon className="h-5 w-5" />}
      {actionItem.actionClass?.type === "noCode" && <MousePointerClickIcon className="h-5 w-5" />}
      {actionItem.actionClass?.type === "automatic" && <SparklesIcon className="h-5 w-5" />}
    </div>
  </div>
);

export const ActivityItemContent = ({ actionItem }: { actionItem: TAction }) => (
  <div>
    <div className="font-semibold text-slate-700">
      {actionItem.actionClass ? <p>{actionItem.actionClass.name}</p> : <p>Unknown Activity</p>}
    </div>
    <div className="text-sm text-slate-400">
      <time
        dateTime={formatDistance(actionItem.createdAt, new Date(), {
          addSuffix: true,
        })}>
        {formatDistance(actionItem.createdAt, new Date(), {
          addSuffix: true,
        })}
      </time>
    </div>
  </div>
);

export const ActivityItemPopover = ({
  actionItem,
  children,
}: {
  actionItem: TAction;
  children: React.ReactNode;
}) => {
  return (
    <Popover>
      <PopoverTrigger className="group">{children}</PopoverTrigger>
      <PopoverContent className="bg-white">
        <div>
          {actionItem && (
            <div>
              <Label className="font-normal text-slate-400">Action Label</Label>
              <p className=" mb-2 text-sm font-medium text-slate-900">{actionItem.actionClass!.name}</p>
              <Label className="font-normal text-slate-400">Action Description</Label>
              <p className="text-sm font-medium text-slate-900">{actionItem.actionClass!.description}</p>
              <Label className="font-normal text-slate-400">Action Type</Label>
              <p className="text-sm font-medium text-slate-900">{actionItem.actionClass!.type}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
