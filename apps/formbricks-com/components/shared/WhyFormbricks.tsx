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
    <div className="mt-32 rounded-xl bg-gradient-to-br from-blue-900 via-blue-900 to-black lg:mt-56">
      <div className="max-w-4xl px-4 py-8 mx-auto sm:px-6 sm:pt-8 sm:pb-12 lg:max-w-7xl lg:px-8 lg:pt-12">
        <p className="max-w-2xl mb-3 font-semibold text-teal-500 uppercase text-md sm:mt-4">
          Why Formbricks?
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
          The only complete open source option.
        </h2>
        <p className="max-w-3xl mt-4 text-lg text-blue-300">
          We needed this, so we are building it. We experienced first hand how form needs develop as companies
          grow. Make the right choice today, congratulate yourself tomorrow :)
        </p>
        <div className="grid grid-cols-1 mt-12 gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {features.map((feature) => (
            <div key={feature.name}>
              <div>
                <span className="flex items-center justify-center w-12 h-12 rounded-md bg-teal-50 bg-opacity-10">
                  <feature.icon className="w-6 h-6 text-teal-500" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">{feature.name}</h3>
                <p className="mt-2 text-base leading-6 text-blue-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
