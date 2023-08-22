import Image from "next/image";
import logomark from "@/images/logo/logomark.svg";
import logo from "@/images/logo/logo.svg";
import logoDark from "@/images/logo/logo_dark.svg";
import footerLogo from "@/images/logo/footerlogo.svg";
import footerLogoDark from "@/images/logo/footerlogo-dark.svg";

export function Logomark(props: any) {
  return <Image src={logomark} {...props} alt="Formbricks Open source Forms & Surveys Logomark" />;
}

export function Logo(props: any) {
  return (
    <div>
      <div className="block dark:hidden">
        <Image src={logo} {...props} alt="Formbricks Open source Forms & Surveys Logo" />
      </div>
      <div className="hidden dark:block">
        <Image src={logoDark} {...props} alt="Formbricks Open source Forms & Surveys Logo" />
      </div>
    </div>
  );
}

export function FooterLogo(props: any) {
  return (
    <div>
      <div className="block dark:hidden">
        <Image src={footerLogo} {...props} alt="Formbricks Open source Forms & Surveys Logo" />
      </div>
      <div className="hidden dark:block">
        <Image src={footerLogoDark} {...props} alt="Formbricks Open source Forms & Surveys Logo" />
      </div>
    </div>
  );
}
