import Image from "next/image";
import logomark from "@/images/logomark.svg";
import logo from "@/images/logo.svg";

export function Logomark(props: any) {
  return <Image src={logomark} {...props} />;
}

export function Logo(props: any) {
  return <Image src={logo} {...props} />;
}
