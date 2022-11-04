import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import TryItCTA from "../components/shared/TryItCTA";
import ImageFormHQ from "../images/form-hq.png";
import Image from "next/image";
import HeadingCentered from "@/components/shared/HeadingCenetered";
import {
  CodeBracketIcon,
  SquaresPlusIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  DocumentPlusIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

const features = [
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
    id: "fullOwnership",
    name: "Full Data Ownership",
    description: "We run open source. Self-host your instance and your data never leaves your servers.",
    icon: CodeBracketIcon,
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

const FormHQPage = () => (
  <Layout
    title="FormHQ"
    description="Manage all form data in one place. Analyze right here or pipe your data where you need it.">
    <HeroTitle headingPt1="Form" headingTeal="HQ" />
    <Image
      src={ImageFormHQ}
      alt="Form HQ by Formbricks user interface to create forms, manage submissions open source."
    />
    <HeadingCentered
      teaser="You have arrived"
      heading="Everything you always wanted (from a form tool)"
      subheading="The days of scattered response data are counted. Manage all form data in one place. Analyze right here or pipe your data where you need it."
    />
    <ul role="list" className="grid grid-cols-1 gap-6 pt-4 pb-16 sm:grid-cols-2 md:grid-cols-3">
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
                  : "via-blue to-blue bg-gradient-to-br from-black ",
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
    <TryItCTA />
  </Layout>
);

export default FormHQPage;
