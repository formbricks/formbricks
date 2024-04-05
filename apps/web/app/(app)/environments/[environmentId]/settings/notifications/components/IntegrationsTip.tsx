import { FaSlack } from "react-icons/fa";

interface IntegrationsTipProps {
  environmentId: string;
}

export default async function IntegrationsTip({ environmentId }: IntegrationsTipProps) {
  return (
    <div>
      <div className="flex items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
        <FaSlack className="mr-3 h-4 w-4 text-blue-400" />
        <p className="text-sm">
          Need Slack or Discord notifications?
          <a
            href={`/environments/${environmentId}/integrations`}
            className="ml-1 cursor-pointer text-sm underline">
            Use the integration.
          </a>
        </p>
      </div>
    </div>
  );
}
