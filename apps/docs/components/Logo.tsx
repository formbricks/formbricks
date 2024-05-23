import logoDark from "@/images/logo/logo-dark.svg";
import logoLight from "@/images/logo/logo-light.svg";
import Image from "next/image";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <div>
      <div className="block dark:hidden">
        <Image className={className} src={logoLight} alt="Formbricks Open source Forms & Surveys Logo" />
      </div>
      <div className="hidden dark:block">
        <Image className={className} src={logoDark} alt="Formbricks Open source Forms & Surveys Logo" />
      </div>
    </div>
  );
};
