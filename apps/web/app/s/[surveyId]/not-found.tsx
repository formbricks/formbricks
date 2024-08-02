import { HelpCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@formbricks/ui/Button";
import footerLogo from "./lib/footerlogo.svg";

const NotFound = () => {
  return (
    <div className="flex h-full flex-col items-center justify-between bg-gradient-to-br from-slate-200 to-slate-50 py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        <HelpCircleIcon className="h-20 w-20" />,
        <h1 className="text-4xl font-bold text-slate-800">Survey not found.</h1>
        <p className="text-lg leading-10 text-slate-500">There is no survey with this ID.</p>
        <Button className="mt-2" href="https://formbricks.com">
          Create your own
        </Button>
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
