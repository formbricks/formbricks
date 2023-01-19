import { PlusIcon, SquaresPlusIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import HeadingCentered from "../shared/HeadingCentered";

const features = [
  {
    id: "devAttention",
    name: "Minimal Dev Attention",
    description: "All you want is building your product. Set it up once, keep insights flowing in..",
    icon: PlusIcon,
  },
  {
    id: "nativeLookFeel",
    name: "Native Look & Feel",
    description: "No more UX clutter. Use headless forms or highly customizabale UI components.",
    icon: SquaresPlusIcon,
  },
  {
    id: "openSourcer",
    name: "Open Source",
    description: "Own your data. Run Formbricks on your servers and comply with all regulation.",
    icon: ChartBarIcon,
  },
];
export default function Features() {
  return (
    <div className="relative px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-24 lg:pb-28">
      <div className="absolute inset-0">
        <div className="h-1/3 sm:h-2/3" />
      </div>
      <div className="relative mx-auto max-w-7xl">
        <HeadingCentered
          closer
          teaser="Built for Product-minded founders"
          heading="Hack you way to Product-Market Fit"
          subheading="We redesigned experience management for SaaS founding teams:
          Developer-first, native look & feel, private at heart."
        />

        <ul role="list" className="grid grid-cols-1 gap-4 pt-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-10">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="relative col-span-1 mt-16 flex flex-col rounded-xl bg-slate-100 text-center dark:bg-slate-700">
              <div className="absolute -mt-12 w-full">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-200 shadow dark:bg-slate-800">
                  <feature.icon className="text-brand-dark dark:text-brand-light mx-auto h-10 w-10 flex-shrink-0" />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-10">
                <h3 className="my-4 text-lg font-medium text-slate-800 dark:text-slate-200">
                  {feature.name}
                </h3>
                <dl className="mt-1 flex flex-grow flex-col justify-between">
                  <dt className="sr-only">Description</dt>
                  <dd className="text-sm text-gray-600 dark:text-slate-400">{feature.description}</dd>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
