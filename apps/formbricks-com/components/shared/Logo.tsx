import Image from "next/image";
import logomark from "@/images/logomark.svg";
import logo from "@/images/logo.svg";
import logoDark from "@/images/logo_dark.svg";

export function Logomark(props: any) {
  return <Image src={logomark} {...props} />;
}

export function Logo(props: any) {
  return (
    <div>
      <div className="block dark:hidden">
        <Image src={logo} {...props} />
      </div>
      <div className="hidden dark:block">
        <Image src={logoDark} {...props} />
      </div>
    </div>
  );
}
