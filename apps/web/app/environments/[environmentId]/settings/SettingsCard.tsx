import { cn } from "@formbricks/lib/cn";
import { Badge } from "@formbricks/ui";

export default function SettingsCard({
  title,
  description,
  children,
  soon = false,
  noPadding = false,
  dangerZone,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
  noPadding?: boolean;
  dangerZone?: boolean;
}) {
  return (
    <div className="my-4 w-full bg-white shadow sm:rounded-lg">
      <div className="rounded-t-lg border-b border-slate-200 bg-slate-100 px-6 py-5">
        <div className="flex">
          <h3
            className={`${
              dangerZone ? "text-red-600" : "text-slate-900"
            } "mr-2 text-lg font-medium leading-6 `}>
            {title}
          </h3>
          {soon && <Badge text="coming soon" size="normal" type="success" />}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className={cn(noPadding ? "" : "px-6 py-5")}>{children} </div>
    </div>
  );
}
