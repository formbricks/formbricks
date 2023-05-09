import { XCircleIcon } from "@heroicons/react/24/solid";

export const ErrorComponent: React.FC = ({}) => {
  return (
    <div className="rounded-lg bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-12 w-12 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Error loading ressources</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>
              This ressource doesn&apos;t exist or you don&apos;t have the neccessary rights to access it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
