import {
  PlusIcon,
  SquaresPlusIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  DocumentPlusIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import HeadingCentered from "../shared/HeadingCentered";

const features = [
  {
    id: "formCreation",
    name: "Fast Form Creation",
    description: "Build complex forms with our React Lib. Our data pipes also work with any other form.",
    icon: PlusIcon,
  },
  {
    id: "dataPipelines",
    name: "Data Pipelines",
    description: "Save your data where you need it. Use webhooks or pre-built integrations.",
    icon: SquaresPlusIcon,
  },
  {
    id: "dataInsights",
    name: "Powerful Data Insights",
    description: "View and manage your results quicker. Handle submissions in our dahsboard.",
    icon: ChartBarIcon,
  },
  {
    id: "nocodeBuilder",
    name: "No-Code Builder",
    description: "Let your operators create and change forms. Stick with React to style and embed forms.",
    icon: RectangleGroupIcon,
    comingSoon: true,
  },
  {
    id: "analytics",
    name: "Built-in Analytics",
    description: "Opening rate, drop-offs, conversions. Use privacy-first analytics out of the box.",
    icon: ArrowTrendingUpIcon,
    comingSoon: true,
  },
  {
    id: "templates",
    name: "Survey Templates",
    description: "NPS, CSAT, Employee Surveys. Name your business objective, we have the questions.",
    icon: DocumentPlusIcon,
    comingSoon: true,
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
          teaser="the Swiss army knife for forms & surveys"
          heading="Home-cooked taste, delivered in minutes"
          subheading="Build a 'home-cooked' solution at the fraction of the time. We do the heavy lifting, you customize
            to your needs."
        />

        <ul role="list" className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 md:grid-cols-3">
          {features.map((feature) => (
            <li
              key={feature.id}
              className={clsx(
                feature.comingSoon
                  ? "bg-gradient-to-b from-slate-200  to-slate-100 dark:from-slate-800 dark:to-slate-900"
                  : "bg-slate-200 drop-shadow-sm dark:bg-slate-800 ",
                "relative col-span-1 mt-16 flex flex-col rounded-xl text-center"
              )}>
              <div className="absolute -mt-12 w-full">
                <div
                  className={clsx(
                    feature.comingSoon
                      ? "from-slate-100 via-slate-200  to-slate-200 dark:from-slate-800  dark:to-slate-900"
                      : "from-slate-200 via-slate-100  to-slate-100 dark:from-slate-900 dark:to-slate-700 ",
                    "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br shadow"
                  )}>
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
                  {feature.comingSoon && (
                    <dd className="mt-4">
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        coming soon
                      </span>
                    </dd>
                  )}
                </dl>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
