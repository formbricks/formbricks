import CalLogoDark from "@/images/clients/cal-logo-dark.svg";
import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import CrowdLogoDark from "@/images/clients/crowd-logo-dark.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import FlixbusLogo from "@/images/clients/flixbus-white.svg";
import NILogoDark from "@/images/clients/niLogoDark.svg";
import NILogoLight from "@/images/clients/niLogoWhite.svg";
import OptimoleLogo from "@/images/clients/optimole-logo.svg";
import ThemeisleLogo from "@/images/clients/themeisle-logo.webp";
import AnimationFallback from "@/public/animations/opensource-xm-platform-formbricks-fallback.png";
import { ShieldCheckIcon, StarIcon } from "lucide-react";
import { usePlausible } from "next-plausible";
import Image from "next/image";
import { useRouter } from "next/router";

import { Button } from "@formbricks/ui/Button";

import HeroAnimation from "./HeroAnimation";

export const Hero: React.FC = ({}) => {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <div className="relative">
      <div className="px-4 pb-20 pt-16 text-center sm:px-6 lg:px-8 lg:pb-32 lg:pt-20">
        <div className="xs:text-sm flex items-center justify-center space-x-4 divide-x-2 text-xs text-slate-600">
          <p>
            <ShieldCheckIcon className="mb-1 inline h-4 w-4" /> Privacy-first
          </p>
          <a href="https://formbricks.com/github" target="_blank" className="hover:text-slate-800">
            <StarIcon className="mb-1 ml-3 mr-1 inline h-4 w-4" />
            Star us on GitHub
          </a>
        </div>
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl md:text-5xl dark:text-slate-200">
          <span className="xl:inline">
            Turn customer insights
            <br />
            into irresistible experiences
          </span>
        </h1>
        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-balance text-base text-slate-500 sm:text-lg md:mt-5 md:text-xl dark:text-slate-400">
          Formbricks is an Experience Management Suite built on the largest open source survey stack
          worldwide. Gracefully gather feedback at every step of the customer journey to{" "}
          <span className="decoration-brand-dark underline underline-offset-4">
            know what your customers need.
          </span>
        </p>

        <div className="mx-auto mt-5 max-w-3xl items-center px-4 sm:flex sm:justify-center md:mt-6 md:space-x-8 md:px-0">
          <div className="grid grid-cols-6 items-center gap-6 pt-2 md:gap-8">
            <Image
              src={FlixbusLogo}
              alt="Flixbus Flix Flixtrain Logo"
              className="rounded-lg pb-1 "
              width={200}
            />
            <Image src={CalLogoLight} alt="Cal Logo" className="block rounded-lg  dark:hidden" width={170} />
            <Image src={CalLogoDark} alt="Cal Logo" className="hidden rounded-lg  dark:block" width={170} />
            <Image src={ThemeisleLogo} alt="Neverinstall Logo" className="pb-1" width={200} />

            <Image
              src={CrowdLogoLight}
              alt="Crowd.dev Logo"
              className="block rounded-lg pb-1  dark:hidden"
              width={200}
            />
            <Image
              src={CrowdLogoDark}
              alt="Crowd.dev Logo"
              className="hidden rounded-lg pb-1  dark:block"
              width={200}
            />
            <Image src={OptimoleLogo} alt="Neverinstall Logo" className="pb-1" width={200} />
            <Image src={NILogoDark} alt="Neverinstall Logo" className="block pb-1  dark:hidden" width={200} />
            <Image
              src={NILogoLight}
              alt="Neverinstall Logo"
              className="hidden  pb-1  dark:block"
              width={200}
            />
            <Image
              src={NILogoLight}
              alt="Neverinstall Logo"
              className="hidden  pb-1  dark:block"
              width={200}
            />
          </div>
        </div>
        <div className="hidden pt-14 md:block">
          <Button
            variant="highlight"
            className="mr-3 px-6"
            onClick={() => {
              router.push("https://app.formbricks.com/auth/signup");
              plausible("Hero_CTA_GetStartedItsFree");
            }}>
            Get Started, it&apos;s Free
          </Button>
          <Button
            variant="secondary"
            className="px-6"
            onClick={() => {
              router.push("https://formbricks.com/github");
              plausible("Hero_CTA_ViewGitHub");
            }}>
            View Code on GitHub
          </Button>
        </div>
      </div>
      <div className="relative px-2 md:px-0">
        <HeroAnimation fallbackImage={AnimationFallback} />
      </div>
    </div>
  );
};

export default Hero;
