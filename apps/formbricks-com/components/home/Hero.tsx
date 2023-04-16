import CalLogoDark from "@/images/clients/cal-logo-dark.svg";
import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import CrowdLogoDark from "@/images/clients/crowd-logo-dark.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import StackOceanLogoDark from "@/images/clients/stack-ocean-dark.png";
import StackOceanLogoLight from "@/images/clients/stack-ocean-light.png";
import Image from "next/image";
import TemplateList from "../dummyUI/TemplateList";

interface Props {}

export default function Hero({}: Props) {
  return (
    <div className="relative">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Better experience data.</span>{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            Better business
          </span>
          <span className="inline ">.</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-400 sm:text-lg md:mt-5 md:text-xl">
          Survey specific customer segments at any point in the user journey.
          <br />
          <span className="hidden md:block">
            Continuously measure what your customers think and feel.{" "}
            <span className="decoration-brand-dark underline underline-offset-4">All open-source.</span>
          </span>
        </p>

        <div className="mx-auto mt-5 max-w-lg items-center space-x-8 sm:flex sm:justify-center md:mt-8">
          <p className="hidden whitespace-nowrap text-sm text-slate-400 dark:text-slate-500 md:block">
            Trusted by
          </p>
          <div className="grid grid-cols-3 gap-8 pt-2">
            <Image
              src={CalLogoLight}
              alt="Cal Logo"
              className="block rounded-lg opacity-50 hover:opacity-100 dark:hidden"
              width={170}
            />
            <Image
              src={CalLogoDark}
              alt="Cal Logo"
              className="hidden rounded-lg opacity-50 hover:opacity-100 dark:block"
              width={170}
            />
            <Image
              src={CrowdLogoLight}
              alt="Cal Logo"
              className="block rounded-lg pb-1 opacity-50 hover:opacity-100 dark:hidden"
              width={200}
            />
            <Image
              src={CrowdLogoDark}
              alt="Cal Logo"
              className="hidden rounded-lg pb-1 opacity-50 hover:opacity-100 dark:block"
              width={200}
            />
            <Image
              src={StackOceanLogoLight}
              alt="Cal Logo"
              className="block rounded-lg pb-1 opacity-50 hover:opacity-100 dark:hidden"
              width={200}
            />
            <Image
              src={StackOceanLogoDark}
              alt="Cal Logo"
              className="hidden rounded-lg pb-1 opacity-50 hover:opacity-100 dark:block"
              width={200}
            />
          </div>
          {/*           <Button
            variant="secondary"
            className="mr-3 px-6"
            onClick={() => setVideoModal(true)}
            EndIcon={PlayCircleIcon}
            endIconClassName=" ml-2">
            Watch video
          </Button> */}
        </div>
      </div>

      <TemplateList />
    </div>
  );
}
