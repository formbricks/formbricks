import { Badge } from "@/modules/ui/components/badge";
import { useTranslations } from "next-intl";
import { cn } from "@formbricks/lib/cn";

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
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{title}</h3>
          <div className="ml-2">
            {beta && <Badge size="normal" type="warning" text="Beta" />}
            {soon && (
              <Badge size="normal" type="success" text={t("environments.settings.enterprise.coming_soon")} />
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className={cn(noPadding ? "" : "px-4 pt-4")}>{children}</div>
    </div>
  );
};
