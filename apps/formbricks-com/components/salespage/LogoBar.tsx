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
      <div className="mt-5 flex justify-center">
        <div className="w-full overflow-hidden">
          <div className="animate-scroll flex items-center space-x-20">
            {/* List of logos, each wrapped in a div with specific width and flex properties */}
            {[
              ThemeisleLogo,
              CalLogoLight,
              FlixbusLogo,
              GumtreeLogo,
              LelyLogo,
              OpinodoLogo,
              CrowdLogoLight,
              OptimoleLogo,
              NILogoDark,
            ].map((src, index) => (
              <div key={index} className="flex-none" style={{ width: 150 }}>
                <Image src={src} alt="Formbricks Client Logo" width={150} height={75} layout="responsive" />
              </div>
            ))}
            {/* Repeat the logos for a seamless loop */}
            {[
              ThemeisleLogo,
              CalLogoLight,
              FlixbusLogo,
              GumtreeLogo,
              LelyLogo,
              OpinodoLogo,
              CrowdLogoLight,
              OptimoleLogo,
              NILogoDark,
            ].map((src, index) => (
              <div key={index + 9} className="flex-none" style={{ width: 150 }}>
                <Image src={src} alt="Formbricks Client Logo" width={150} height={75} layout="responsive" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
