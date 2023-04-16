import ImageAttributesDark from "@/images/attributes-dark.svg";
import ImageAttributesLight from "@/images/attributes-light.svg";
import ImageEventTriggerDark from "@/images/event-trigger-dark.svg";
import ImageEventTriggerLight from "@/images/event-trigger-light.svg";
import Image from "next/image";

export default function Highlights({}) {
  return (
    <>
      <div className="mx-auto mb-12 mt-8 max-w-lg md:mb-0 md:mt-32 md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="pb-8 md:pb-0">
              <h2 className="xs:text-3xl text-2xl font-bold leading-7 tracking-tight text-slate-800 dark:text-slate-200">
                Ask at the right moment,
                <br />
                <span className="font-light">get the data you need.</span>
              </h2>
              <p className="text-md mt-6 max-w-lg leading-7 text-slate-500 dark:text-slate-400">
                Follow up emails are so 2010. Ask users as they experience your product - and leverage a 3x
                higher conversion rate.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 py-6 pr-4 dark:bg-slate-800 sm:py-16 sm:pr-8">
              <Image
                src={ImageEventTriggerLight}
                alt="react library"
                className="block rounded-lg dark:hidden"
              />
              <Image
                src={ImageEventTriggerDark}
                alt="react library"
                className="hidden rounded-lg dark:block"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mb-12 mt-8 max-w-lg md:mb-0 md:mt-32  md:max-w-none">
        <div className="px-4 sm:max-w-4xl sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="grid md:grid-cols-2 md:items-center md:gap-16">
            <div className="order-last rounded-lg bg-slate-100 p-4 dark:bg-slate-800 sm:p-8 md:order-first">
              <Image
                src={ImageAttributesLight}
                alt="react library"
                className="block rounded-lg dark:hidden"
              />
              <Image src={ImageAttributesDark} alt="react library" className="hidden rounded-lg dark:block" />
            </div>
            <div className="pb-8 md:pb-0">
              <h2 className="xs:text-3xl text-2xl font-bold leading-7 tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
                Dont&apos; ‘Spray and pray’.
                <br />
                <span className="font-light">Pre-segment granularly.</span>
              </h2>
              <p className="text-md mt-6 max-w-md leading-7 text-slate-500 dark:text-slate-400">
                Pre-segment who sees your survey based on custom attributes. Keep the signal, cancel out the
                noise.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
