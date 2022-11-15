import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import CTA from "../components/shared/CTA";
import ImageFormHQ from "../images/form-hq.png";
import Image from "next/image";
import HeadingCentered from "@/components/shared/HeadingCentered";
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
    <ul role="list" className="grid grid-cols-1 gap-6 px-2 pt-4 pb-16 sm:grid-cols-2 md:grid-cols-3">
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
            <h3 className="my-4 text-lg font-medium text-slate-800 dark:text-slate-200">{feature.name}</h3>
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
    <CTA />
  </Layout>
);

export default FormHQPage;
