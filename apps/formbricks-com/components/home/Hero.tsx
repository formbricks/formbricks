import CalLogoDark from "@/images/clients/cal-logo-dark.svg";
import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import ClovyrLogo from "@/images/clients/clovyr-logo.svg";
import CrowdLogoDark from "@/images/clients/crowd-logo-dark.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import NILogoDark from "@/images/clients/niLogoDark.svg";
import NILogoLight from "@/images/clients/niLogoWhite.svg";
import StackOceanLogoDark from "@/images/clients/stack-ocean-dark.png";
import StackOceanLogoLight from "@/images/clients/stack-ocean-light.png";
import AnimationFallback from "@/public/animations/fallback-image-open-source-feedback-software.jpg";
import { Button } from "@formbricks/ui";
import { usePlausible } from "next-plausible";
import Image from "next/image";
import { useRouter } from "next/router";
import HeroAnimation from "./HeroAnimation";

export const Hero: React.FC = ({}) => {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <div className="relative">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Create Products People Remember</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-400 sm:text-lg md:mt-5 md:text-xl">
          Understand what customers think & feel about your product.
          <br />
          <span className="hidden md:block">
            Continuously gather deep user insights,{" "}
            <span className="decoration-brand-dark underline underline-offset-4">all privacy-first.</span>
          </span>
        </p>

        <div className="mx-auto mt-5 max-w-3xl items-center px-4 sm:flex sm:justify-center md:mt-8 md:space-x-8 md:px-0">
          <p className="hidden whitespace-nowrap pt-3 text-xs text-slate-400 dark:text-slate-500 md:block">
            Trusted by
          </p>
          <div className="grid grid-cols-3 items-center gap-8 pt-2 md:grid-cols-5">
            <Image
              src={CalLogoLight}
              alt="Cal Logo"
              className="block rounded-lg hover:opacity-100 dark:hidden md:opacity-50"
              width={170}
            />
            <Image
              src={CalLogoDark}
              alt="Cal Logo"
              className="hidden rounded-lg hover:opacity-100 dark:block md:opacity-50"
              width={170}
            />
            <Image
              src={CrowdLogoLight}
              alt="Crowd.dev Logo"
              className="block rounded-lg pb-1 hover:opacity-100 dark:hidden md:opacity-50"
              width={200}
            />
            <Image
              src={CrowdLogoDark}
              alt="Crowd.dev Logo"
              className="hidden rounded-lg pb-1 hover:opacity-100 dark:block md:opacity-50"
              width={200}
            />
            <Image
              src={ClovyrLogo}
              alt="Clovyr Logo"
              className="rounded-lg pb-1 hover:opacity-100 md:opacity-50"
              width={200}
            />
            <Image
              src={NILogoDark}
              alt="Neverinstall Logo"
              className="block pb-1 hover:opacity-100 dark:hidden md:opacity-50"
              width={200}
            />
            <Image
              src={NILogoLight}
              alt="Neverinstall Logo"
              className="hidden  pb-1 hover:opacity-100 dark:block md:opacity-50"
              width={200}
            />
            <Image
              src={StackOceanLogoLight}
              alt="StackOcean Logo"
              className="block  pb-1 hover:opacity-100 dark:hidden md:opacity-50"
              width={200}
            />
            <Image
              src={StackOceanLogoDark}
              alt="StakcOcean Logo"
              className="hidden pb-1 hover:opacity-100 dark:block md:opacity-50"
              width={200}
            />
          </div>
        </div>
        <div className="hidden pt-10 md:block">
          <Button
            variant="highlight"
            className="mr-3 px-6"
            onClick={() => {
              router.push("https://app.formbricks.com/auth/signup");
              plausible("Hero_CTA_CreateSurvey");
            }}>
            Create survey
          </Button>
          <Button
            variant="secondary"
            className="px-6"
            onClick={() => {
              router.push("/demo");
              plausible("Hero_CTA_LaunchDemo");
            }}>
            Live demo
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
