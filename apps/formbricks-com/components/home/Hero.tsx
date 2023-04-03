import CalLogoDark from "@/images/clients/cal-logo-dark.svg";
import CalLogoLight from "@/images/clients/cal-logo-light.svg";
import CrowdLogoDark from "@/images/clients/crowd-logo-dark.svg";
import CrowdLogoLight from "@/images/clients/crowd-logo-light.svg";
import StackOceanLogoDark from "@/images/clients/stack-ocean-dark.png";
import StackOceanLogoLight from "@/images/clients/stack-ocean-light.png";
import Image from "next/image";
import { useRouter } from "next/router";
import TemplateList from "../dummyUI/TemplateList";

interface Props {}

export default function Hero({}: Props) {
  const router = useRouter();

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
function GitHubIcon(props: any) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" />
    </svg>
  );
}
