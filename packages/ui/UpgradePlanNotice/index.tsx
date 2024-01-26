import { LightBulbIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { Alert, AlertDescription } from "../Alert";

export const UpgradePlanNotice = ({
  message,
  url,
  textForUrl,
}: {
  message: string;
  url: string;
  textForUrl: string;
}) => {
  return (
    <Alert className="flex items-center">
      <LightBulbIcon className="h-5 w-5 text-slate-500" />
      <AlertDescription>
        <span className="mr-2 text-sm text-slate-500">{message}</span>
        <span className="underline">
          <Link href={url}>{textForUrl}</Link>
        </span>
      </AlertDescription>
    </Alert>
  );
};
