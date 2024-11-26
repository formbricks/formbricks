import { MailIcon } from "lucide-react";
import { TResponseData } from "@formbricks/types/responses";

interface VerifiedEmailProps {
  responseData: TResponseData;
}
export const VerifiedEmail = ({ responseData }: VerifiedEmailProps) => {
  return (
    <div>
      <p className="flex items-center space-x-2 text-sm text-slate-500">
        <MailIcon className="h-4 w-4" />
        <span>Verified Email</span>
      </p>
      <p className="ph-no-capture my-1 font-semibold text-slate-700">
        {typeof responseData["verifiedEmail"] === "string" ? responseData["verifiedEmail"] : ""}
      </p>
    </div>
  );
};
