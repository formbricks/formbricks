import Image from "next/image";

import ImageReactLib from "@/images/react-lib.png";
import ImageDataPipelines from "@/images/data-pipelines.png";

export default function Highlights({}) {
  return (
    <>
      <div className="mt-32">
        <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                Build complex forms in minutes with our{" "}
                <span className="font-light text-teal-500">lightweight</span> React Lib.
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-gray-500 dark:text-slate-300">
                Loads of question types, validation, multi-page forms, logic jumps, i18n, custom styles - all
                the good stuff you want, but don't want to build yourself. Build{" "}
                <span className="font-semibold">exactly</span> the form you want in a fraction of the time.
              </p>
              <div className="mt-6">
                <a href="#" className="text-base font-medium text-teal-500">
                  Read more &rarr;
                </a>
              </div>
            </div>
            <Image src={ImageReactLib} alt="react library" className="rounded-lg" />
          </div>
        </div>
      </div>
      <div className="mt-32">
        <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
            <Image src={ImageDataPipelines} alt="react library" className="rounded-lg" />
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                <span className=" text-teal-500">API</span> all the way
              </h2>
              <p className="text-md mt-6 max-w-3xl leading-7 text-gray-500 dark:text-slate-300">
                Your form looks perfect? Time to build integrations...
                <br />
                <span className="font-semibold">Or use our prebuilt data pipelines.</span> Pipe submissions
                right into your database. Set up webhooks, email notifications and 3rd party integrations in
                our webUI.
              </p>
              <div className="mt-6">
                <a href="#" className="text-base font-medium text-teal-500">
                  Read more &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
