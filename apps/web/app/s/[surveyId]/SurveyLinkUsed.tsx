import { SurveySingleUse } from "@formbricks/types/surveys";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import footerLogo from "./footerlogo.svg";

type SurveyLinkUsedProps = {
  singleUseMessage: Omit<SurveySingleUse, "enabled"> | null;
};

const SurveyLinkUsed = ({ singleUseMessage }: SurveyLinkUsedProps) => {
  const defaultHeading = "The survey has already been answered.";
  const defaultSubheading = "You can only use this link once.";
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-tr from-slate-200 to-slate-50 py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        <CheckCircleIcon className="h-20 w-20" />
        <h1 className="text-4xl font-bold text-slate-800">
          {!!singleUseMessage?.heading ? singleUseMessage?.heading : defaultHeading}
        </h1>
        <p className="text-lg leading-10 text-gray-500">
          {!!singleUseMessage?.subheading ? singleUseMessage?.subheading : defaultSubheading}
        </p>
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};

export default SurveyLinkUsed;
