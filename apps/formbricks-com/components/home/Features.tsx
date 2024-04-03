import { CodeFileIcon, EyeIcon, HandPuzzleIcon } from "@formbricks/ui/icons";

import HeadingCentered from "../shared/HeadingCentered";

const features = [
  {
    id: "compliance",
    name: "Smoothly compliant",
    description: "Use our GDPR-compliant Cloud or self-host the entire solution.",
    icon: EyeIcon,
  },
  {
    id: "customizable",
    name: "Fully customizable",
    description: "Full customizability and extendability. Integrate with your stack easily.",
    icon: HandPuzzleIcon,
  },
  {
    id: "independent",
    name: "Stay independent",
    description: "The code is open source. Do with it what your organization needs.",
    icon: CodeFileIcon,
  },
];
export const Features: React.FC = () => {
  return (
    <div className="relative">
      <HeadingCentered
        teaser="Data privacy at heart"
        heading="Open Source Experience Management"
        subheading="Comply with all data privacy regulation with ease. Self-host if you want."
      />

      <ul role="list" className="grid grid-cols-1 gap-4 pt-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-10">
        {features.map((feature) => {
          const IconComponent: React.ElementType = feature.icon;

          return (
            <li
              key={feature.id}
              className="relative col-span-1 mt-16 flex flex-col rounded-xl bg-slate-100 text-center dark:bg-slate-700">
              <div className="absolute -mt-12 w-full">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-200 shadow dark:bg-slate-800">
                  <IconComponent className="text-brand-dark dark:text-brand-light mx-auto h-10 w-10 flex-shrink-0" />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-10">
                <h3 className="my-4 text-lg font-medium text-slate-800 dark:text-slate-200">
                  {feature.name}
                </h3>
                <dl className="mt-1 flex flex-grow flex-col justify-between">
                  <dt className="sr-only">Description</dt>
                  <dd className="text-sm text-slate-600 dark:text-slate-400">{feature.description}</dd>
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Features;
