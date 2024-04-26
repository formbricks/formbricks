import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import FlixbusLogo from "@/images/clients/flixbus-white.svg";
import GumtreeLogo from "@/images/clients/gumtree.png";
import LelyLogo from "@/images/clients/lely-logo.webp";
import NILogoDark from "@/images/clients/niLogoDark.svg";
import OpinodoLogo from "@/images/clients/opinodo.png";
import OptimoleLogo from "@/images/clients/optimole-logo.svg";
import ThemeisleLogo from "@/images/clients/themeisle-logo.webp";
import Image from "next/image";

export default function LogoBar() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-center text-lg text-slate-700">
        10,000+ teams at the world’s best companies trust Formbricks
      </p>
      <div className="mt-5 items-center px-4 sm:flex sm:justify-center md:mt-6 md:space-x-8 md:px-0">
        <div className="grid grid-cols-3 items-center gap-8 pt-2 md:grid-cols-3 md:gap-10 lg:grid-cols-9">
          <Image src={FlixbusLogo} alt="Flixbus Flix Flixtrain Logo" width={200} />
          <Image src={GumtreeLogo} alt="Gumtree Logo" width={200} />
          <Image src={LelyLogo} alt="Lely Logo" width={200} />
          <Image src={CalLogoLight} alt="Cal Logo" width={200} />
          <Image src={ThemeisleLogo} alt="ThemeIsle Logo" width={200} />
          <Image src={OpinodoLogo} alt="Crowd.dev Logo" width={200} />
          <Image src={CrowdLogoLight} alt="Crowd.dev Logo" width={200} />
          <Image src={OptimoleLogo} alt="Optimole Logo" width={200} />
          <Image src={NILogoDark} alt="Neverinstall Logo" width={200} />
        </div>
      </div>
    </div>
  );
}
