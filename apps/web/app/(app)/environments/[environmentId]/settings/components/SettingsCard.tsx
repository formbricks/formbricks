import { useTranslations } from "next-intl";
import { cn } from "@formbricks/lib/cn";
import { Badge } from "@formbricks/ui/components/Badge";

export const SettingsCard = ({
  title,
  description,
  children,
  soon = false,
  noPadding = false,
  beta,
  className,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
  noPadding?: boolean;
  beta?: boolean;
  className?: string;
}) => {
  const t = useTranslations();
  return (
    <div
      className={cn(
        "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
        className
      )}
      id={title}>
      <div className="border-b border-slate-200 px-4 pb-4">
        <div className="flex">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t(title)}</h3>
          <div className="ml-2">
            {beta && <Badge text="Beta" size="normal" type="warning" />}
            {soon && <Badge text="coming soon" size="normal" type="success" />}
          </div>
        </div>
        <p className="mt-1 text-sm capitalize text-slate-500">{t(description)}</p>
      </div>
      <div className={cn(noPadding ? "" : "px-4 pt-4")}>{children}</div>
    </div>
  );
};
