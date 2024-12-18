import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { KeyIcon } from "lucide-react";
import Link from "next/link";

interface UpgradePlanNoticeProps {
  message: string;
  url: string;
  textForUrl: string;
}

export const UpgradePlanNotice = ({ message, url, textForUrl }: UpgradePlanNoticeProps) => {
  return (
    <Alert className="flex gap-2 bg-slate-50 p-2 [&:has(svg)]:pl-3">
      <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-slate-200 bg-white">
        <KeyIcon className="h-3 w-3 text-slate-900" />
      </div>
      <AlertDescription>
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
