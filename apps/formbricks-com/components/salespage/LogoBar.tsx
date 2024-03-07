import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import FlixbusLogo from "@/images/clients/flixbus-white.svg";
import NILogoDark from "@/images/clients/niLogoDark.svg";
import OptimoleLogo from "@/images/clients/optimole-logo.svg";
import ThemeisleLogo from "@/images/clients/themeisle-logo.webp";
import Image from "next/image";

export default function LogoBar() {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-center text-lg text-slate-700">
        10,000+ teams at the world’s best companies trust Formbricks
      </p>
      <div className="mt-5 items-center px-4 sm:flex sm:justify-center md:mt-6 md:space-x-8 md:px-0">
        <div className="grid grid-cols-2 items-center gap-8 pt-2 md:grid-cols-2 md:gap-10 lg:grid-cols-6">
          <Image
            src={FlixbusLogo}
            alt="Flixbus Flix Flixtrain Logo"
            className="rounded-lg pb-1 "
            width={200}
          />
          <Image src={CalLogoLight} alt="Cal Logo" className="block rounded-lg  dark:hidden" width={170} />
          <Image src={ThemeisleLogo} alt="ThemeIsle Logo" className="pb-1" width={200} />
          <Image
            src={CrowdLogoLight}
            alt="Crowd.dev Logo"
            className="block rounded-lg pb-1  dark:hidden"
            width={200}
          />
          <Image src={OptimoleLogo} alt="Optimole Logo" className="pb-1" width={200} />
          <Image src={NILogoDark} alt="Neverinstall Logo" className="block pb-1  dark:hidden" width={200} />
        </div>
      </div>
    </div>
  );
}
