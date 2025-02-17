import logoDark from "@/images/logo/logo-dark.svg";
import logoLight from "@/images/logo/logo-light.svg";
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <div>
      <div className="block dark:hidden">
        <Image
          className={className}
          src={logoLight as string}
          alt="Formbricks Open source Forms & Surveys Logo"
        />
      </div>
      <div className="hidden dark:block">
        <Image
          className={className}
          src={logoDark as string}
          alt="Formbricks Open source Forms & Surveys Logo"
        />
      </div>
    </div>
  );
}
