import { BackIcon } from "../ui/icons/BackIcon";
import Link from "next/link";

interface IntegrationPageTitleProps {
  title: string;
  icon?: React.ReactNode;
  environmentId: string;
}

const IntegrationPageTitle: React.FC<IntegrationPageTitleProps> = ({ title, icon, environmentId }) => {
  return (
    <div className="mb-8">
      <Link className="inline-block" href={`/environments/${environmentId}/integrations`}>
        <BackIcon className="mb-2 h-8 w-8" />
      </Link>

      <div className="my-4 flex items-baseline">
        {icon && <div className="h-6 w-6">{icon}</div>}
        <h1 className="ml-3 text-2xl font-bold text-slate-600">{title}</h1>
      </div>
    </div>
  );
};

export default IntegrationPageTitle;
