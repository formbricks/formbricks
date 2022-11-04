import {
  PlusIcon,
  SquaresPlusIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  DocumentPlusIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import HeadingCentered from "../shared/HeadingCenetered";

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
                feature.comingSoon ? "dark:to-blue dark:from-blue-900" : "dark:from-black dark:to-blue-900",
                "relative col-span-1 mt-16 flex flex-col rounded-xl bg-gradient-to-b from-blue-200 to-gray-100 text-center drop-shadow-sm"
              )}>
              <div className="absolute w-full -mt-12">
                <div
                  className={clsx(
                    feature.comingSoon
                      ? "dark:to-blue bg-gradient-to-br from-blue-200 to-gray-100 dark:from-blue-900 dark:via-blue-900"
                      : "via-blue to-blue dark bg-gradient-to-br from-black ",
                    "mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow"
                  )}>
                  <feature.icon className="flex-shrink-0 w-10 h-10 mx-auto text-teal-500" />
                </div>
              </div>
              <div className="flex flex-col flex-1 p-10">
                <h3 className="my-4 text-lg font-medium text-blue dark:text-blue-100">{feature.name}</h3>
                <dl className="flex flex-col justify-between flex-grow mt-1">
                  <dt className="sr-only">Description</dt>
                  <dd className="text-sm text-gray-600 dark:text-blue-400">{feature.description}</dd>
                  {feature.comingSoon && (
                    <dd className="mt-4">
                      <span className="px-3 py-1 text-xs font-medium bg-gray-400 rounded-full text-blue-50">
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
