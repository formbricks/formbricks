import CalLogoDark from "@/images/clients/cal-logo-dark.svg";
import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import ClovyrLogo from "@/images/clients/clovyr-logo.svg";
import CrowdLogoDark from "@/images/clients/crowd-logo-dark.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import NILogoDark from "@/images/clients/niLogoDark.svg";
import NILogoLight from "@/images/clients/niLogoWhite.svg";
import AnimationFallback from "@/public/animations/opensource-xm-platform-formbricks-fallback.png";
import { Button } from "@formbricks/ui";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { usePlausible } from "next-plausible";
import Image from "next/image";
import { useRouter } from "next/router";
import HeroAnimation from "./HeroAnimation";

export const Hero: React.FC = ({}) => {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <div className="relative">
      <div className="px-4 pb-20 pt-16 text-center sm:px-6 lg:px-8 lg:pb-32 lg:pt-20">
        <a
          href="https://formbricks.com/formtribe"
          target="_blank"
          className="border-brand-dark animate-bounce rounded-full border px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          The FormTribe Hackathon is on 🔥
          <ChevronRightIcon className="inline h-5 w-5 text-slate-300" />
        </a>
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Open-source Experience Management</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-400 sm:text-lg md:mt-5 md:text-xl">
          Understand what customers think & feel about your product.
          <br />
          <span className="hidden md:block">
            Natively integrate user research with minimal dev attention,{" "}
            <span className="decoration-brand-dark underline underline-offset-4">privacy-first.</span>
          </span>
        </p>

        <div className="mx-auto mt-5 max-w-3xl items-center px-4 sm:flex sm:justify-center md:mt-8 md:space-x-8 md:px-0">
          <p className="hidden whitespace-nowrap pt-3 text-xs text-slate-400 dark:text-slate-500 md:block">
            Trusted by
          </p>
          <div className="grid grid-cols-4 items-center gap-5 pt-2 md:gap-8">
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
