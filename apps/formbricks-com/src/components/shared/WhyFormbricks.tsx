import {
  UsersIcon,
  CubeTransparentIcon,
  UserGroupIcon,
  CommandLineIcon,
  SwatchIcon,
  SquaresPlusIcon,
} from "@heroicons/react/24/outline";

const features = [
  {
    name: "Futureproof",
    description: "Form needs change. With Formbricks you’ll avoid island solutions right from the start.",
    icon: CubeTransparentIcon,
  },
  {
    name: "Privacy by design",
    description: "Self-host the entire product and fly through privacy compliance reviews.",
    icon: UsersIcon,
  },
  {
    name: "Community driven",
    description: "We're building for you. If you need something specific, we’re happy to build it!",
    icon: UserGroupIcon,
  },
  {
    name: "Great DX",
    description: "We love a solid developer experience. We felt your pain and do our best to avoid it.",
    icon: CommandLineIcon,
  },
  {
    name: "Customizable",
    description: "We have to build opinionated. If it doesn't suit your need, just change it up.",
    icon: SwatchIcon,
  },
  {
    name: "Extendable",
    description: "Even though we try, we cannot build every single integration. With Formbricks, you can.",
    icon: SquaresPlusIcon,
  },
];

export default function FeatureTable({}) {
  return (
    <div className="mt-32 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 dark:from-slate-200  dark:to-slate-300 lg:mt-56">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:pb-12 sm:pt-8 lg:max-w-7xl lg:px-8 lg:pt-12">
        <p className="text-md dark:text-brand-dark text-brand-light mb-3 max-w-2xl font-semibold uppercase sm:mt-4">
          Why Formbricks?
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-200 dark:text-slate-800">
          The only complete open source option.
        </h2>
        <p className="mt-4 max-w-3xl text-lg text-slate-300 dark:text-slate-500">
          We experienced how form needs develop as companies grow. We could&#39nt find a solution which ticked
          all of the boxes. Now we&apos;re building it.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {features.map((feature) => (
            <div key={feature.name}>
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-800 dark:bg-slate-300">
                  <feature.icon
                    className="dark:text-brand-dark text-brand-light h-6 w-6"
                    aria-hidden="true"
                  />
                </span>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-200 dark:text-slate-700">{feature.name}</h3>
                <p className="mt-2 text-base leading-6 text-slate-400 dark:text-slate-500">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
