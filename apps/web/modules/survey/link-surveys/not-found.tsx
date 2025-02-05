import { Button } from "@/modules/ui/components/button";
import { HelpCircleIcon } from "lucide-react";
import { StaticImport } from "next/dist/shared/lib/get-img-props";
import Image from "next/image";
import Link from "next/link";
import footerLogo from "./lib/footerlogo.svg";

export const LinkSurveyNotFound = () => {
  return (
    <div className="flex h-full flex-col items-center justify-between bg-gradient-to-br from-slate-200 to-slate-50 py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        <HelpCircleIcon className="h-20 w-20" />,
        <h1 className="text-4xl font-bold text-slate-800">Survey not found.</h1>
        <p className="text-lg leading-10 text-slate-500">There is no survey with this ID.</p>
        <Button className="mt-2" asChild>
          <Link href="https://formbricks.com">Create your own</Link>
        </Button>
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo as StaticImport} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};
