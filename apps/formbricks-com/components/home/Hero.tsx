import LogoBar from "@/components/salespage/LogoBar";
import { ShieldCheckIcon, StarIcon } from "lucide-react";
import { usePlausible } from "next-plausible";
import { useRouter } from "next/router";

import { Button } from "@formbricks/ui/Button";

export const Hero: React.FC = ({}) => {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <div className="relative">
      <div className="text-center">
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
        <LogoBar />

        <div className="hidden pt-7 md:block">
          <Button
            variant="darkCTA"
            className="mr-3 px-6"
            onClick={() => {
              router.push("https://app.formbricks.com/auth/signup");
              plausible("Hero_CTA_GetStartedItsFree");
            }}>
            Get Started
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
    </div>
  );
};

export default Hero;
