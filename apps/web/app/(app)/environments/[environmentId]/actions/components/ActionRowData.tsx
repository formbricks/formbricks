import { ACTION_TYPE_ICON_LOOKUP } from "@/app/(app)/environments/[environmentId]/actions/utils";
import { timeSince } from "@formbricks/lib/time";
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
    <div className="m-2 grid h-16 grid-cols-6 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
      <div className="col-span-4 flex items-center pl-6 text-sm">
        <div className="flex items-center">
          <div className="h-5 w-5 shrink-0 text-slate-500">{ACTION_TYPE_ICON_LOOKUP[actionClass.type]}</div>
          <div className="ml-4 text-left">
            <div className="font-medium text-slate-900">{actionClass.name}</div>
            <div className="text-xs text-slate-400">{actionClass.description}</div>
          </div>
        </div>
      </div>
      <div className="col-span-2 my-auto text-center text-sm whitespace-nowrap text-slate-500">
        {timeSince(actionClass.createdAt.toString(), locale)}
      </div>
      <div className="text-center"></div>
    </div>
  );
};
