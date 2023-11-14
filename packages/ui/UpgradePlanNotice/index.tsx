import { LightBulbIcon } from "@heroicons/react/24/outline";
import { Alert } from "../Alert";

export const UpgradePlanNotice = ({ message }: { message: string }) => {
  return (
    <Alert className="flex items-center">
      <LightBulbIcon className="h-5 w-5 text-gray-500" />
      <span className="text-sm text-gray-500">{message}</span>
    </Alert>
  );
};
