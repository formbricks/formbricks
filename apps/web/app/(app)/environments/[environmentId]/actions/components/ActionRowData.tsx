import { ACTION_TYPE_ICON_LOOKUP } from "@/app/(app)/environments/[environmentId]/actions/utils";
import { timeSince } from "@/lib/time";
import { TActionClass } from "@formbricks/types/action-classes";
import { TUserLocale } from "@formbricks/types/user";

export const ActionClassDataRow = ({
  actionClass,
  locale,
}: {
  actionClass: TActionClass;
  locale: TUserLocale;
}) => {
  return (
    <div className="m-2 grid grid-cols-6 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
      <div className="col-span-4 flex items-start py-3 pl-6 text-sm">
        <div className="flex w-full items-center gap-4">
          <div className="mt-1 h-5 w-5 flex-shrink-0 text-slate-500">
            {ACTION_TYPE_ICON_LOOKUP[actionClass.type]}
          </div>
          <div className="text-left">
            <div className="break-words font-medium text-slate-900">{actionClass.name}</div>
            <div className="break-words text-xs text-slate-400">{actionClass.description}</div>
          </div>
        </div>
      </div>
      <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        {timeSince(actionClass.createdAt.toString(), locale)}
      </div>
    </div>
  );
};
