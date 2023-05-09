import { cn } from "@formbricks/lib/cn";
import { Badge } from "@formbricks/ui/Badge";

export default function SettingsCard({
  title,
  description,
  children,
  soon = false,
  noPadding = false,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
  noPadding?: boolean;
}) {
  return (
    <div className="my-4 w-full bg-white shadow sm:rounded-lg">
      <div className="rounded-t-lg border-b border-slate-200 bg-slate-100 px-6 py-5">
        <div className="flex">
          <h3 className="text-lg font-medium leading-6 text-slate-900">{title}</h3>
          {soon && <Badge text="coming soon" size="normal" type="warning" />}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className={cn(noPadding ? "" : "px-6 py-5")}>{children} </div>
    </div>
  );
}
