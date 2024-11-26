import Link from "next/link";
import { Alert, AlertDescription } from "../Alert";
import { Badge } from "../Badge";

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
    <Alert className="mt-1.5 flex items-center bg-slate-50">
      <Badge size="tiny" text="Pro" type="success" />
      <AlertDescription className="ml-2">
        <span className="mr-1 text-slate-600">{message}</span>
        <span className="underline">
          <Link href={url} target="_blank">
            {textForUrl}
          </Link>
        </span>
      </AlertDescription>
    </Alert>
  );
};
