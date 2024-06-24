import Link from "next/link";
import { BackIcon } from "@formbricks/ui/icons";

interface IntegrationPageTitleProps {
  title: string;
  icon?: React.ReactNode;
  environmentId: string;
}

export const IntegrationPageTitle = ({ title, icon, environmentId }: IntegrationPageTitleProps) => {
  return (
    <div className="flex justify-between">
      <div className="mb-8">
        <Link className="inline-block" href={`/environments/${environmentId}/integrations/`}>
          <BackIcon className="mb-2 h-6 w-6" />
        </Link>

        <div className="my-4 flex items-baseline">
          {icon && <div className="h-6 w-6">{icon}</div>}
          <h1 className="ml-3 text-2xl font-bold text-slate-800">{title}</h1>
        </div>
      </div>
      {/* <div className="flex items-center space-x-2">
        <Switch id="integration-enabled" />
        <Label htmlFor="integration-enabled">Enabled</Label>
      </div> */}
    </div>
  );
};
