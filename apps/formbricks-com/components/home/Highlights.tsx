import Image from "next/image";
import ImageReactLib from "@/images/react-lib.png";
import ImageDataPipelines from "@/images/data-pipelines.png";
import Link from "next/link";
import Button from "../shared/Button";
import { useRouter } from "next/router";

export default function Highlights({}) {
  const router = useRouter();
  return (
    <>
      <div className="mt-8 md:mt-32">
        <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid lg:grid-cols-2 lg:items-center lg:gap-24">
            <div className="order-last lg:order-first">
              <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
                Build forms in minutes with our{" "}
                <span className="text-brand-dark dark:text-brand-light font-light">lightweight</span> React
                Form Builder.
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-slate-500 dark:text-slate-400">
                Loads of question types, validation, multi-page forms, logic jumps, i18n, custom styles - all
                the good stuff you want, but don&apos;t want to build yourself.
                <br />
                <br />
                Build <span className="font-semibold">exactly</span> the form you want in a fraction of the
                time.
              </p>
              <div className="my-6">
                <Button variant="minimal" size="sm" onClick={() => router.push("/react-form-library")}>
                  Read more
                </Button>
              </div>
            </div>
            <Image src={ImageReactLib} alt="react library" className="mb-8 rounded-lg lg:mb-0" />
          </div>
        </div>
      </div>
      <div className="mt-16 md:mt-32">
        <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
            <Image src={ImageDataPipelines} alt="react library" className="mb-8 rounded-lg lg:mb-0" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                <span className="text-brand-dark dark:text-brand-light ">API</span> all the way
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-slate-500 dark:text-slate-400">
                Your form looks perfect? Time to build integrations...
                <br />
                <br />
                <span className="font-semibold">Or use our prebuilt data pipelines.</span> Pipe submissions
                right into your database. Set up webhooks, email notifications and 3rd party integrations in
                our webUI.
              </p>
              <div className="mt-6">
                <Button variant="minimal" size="sm" onClick={() => router.push("/core-api")}>
                  Read more
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
