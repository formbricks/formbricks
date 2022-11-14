import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import ImageCoreApi from "@/images/core-api.svg";
import Image from "next/image";
import TryItCTA from "../components/shared/TryItCTA";
import WhyFormbricks from "../components/shared/WhyFormbricks";
import FeatureHighlight from "@/components/shared/FeatureHighlight";
import { CodeBracketSquareIcon, TableCellsIcon, ServerStackIcon } from "@heroicons/react/24/outline";

const features = [
  {
    id: "allForms",
    name: "Works with Every Form",
    description: "Javascript forms, HTML forms, form widgets - all works. Send it over, take it from here.",
    icon: CodeBracketSquareIcon,
  },
  {
    id: "schemaSupport",
    name: "Schema Support",
    description: "Add as many email addresses as you like. Send responses and notifications.",
    icon: TableCellsIcon,
  },
  {
    id: "selfHost",
    name: "Self-host or Cloud",
    description: "Manage submissions in our FormHQ or host the entire solution yourself.",
    icon: ServerStackIcon,
  },
];

const CoreAPIPage = () => (
  <Layout
    title="Core API | Formbricks Open Source Forms & Surveys"
    description="Our core API handles all of the submission handling of your open source forms and surveys.">
    <HeroTitle headingPt1="Core" headingTeal="API" />
    <FeatureHighlight
      featureTitle="The OS form engine"
      text="Our core API handles all of the submission handling of your forms and surveys. Our main objective is versatility, so that you can use it with any currently existing form.
      Soon we will integrate it with our React Form Builder. This allows for handling schemas so that you get a full image of your submission data. "
      img={<Image src={ImageCoreApi} alt="react library" className="rounded-lg" />}
      isImgLeft
    />
    <ul
      role="list"
      className="-mb-16 grid grid-cols-1 gap-6 px-3 pt-2 sm:grid-cols-2 md:grid-cols-3 lg:px-12">
      {features.map((feature) => (
        <li
          key={feature.id}
          className="relative col-span-1 mt-16 flex flex-col rounded-xl bg-gradient-to-b from-blue-200 to-gray-100 text-center drop-shadow-sm dark:from-black dark:to-blue-900">
          <div className="absolute -mt-12 w-full">
            <div className="via-blue to-blue mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-black shadow">
              <feature.icon className="mx-auto h-10 w-10 flex-shrink-0 text-teal-500" />
            </div>
          </div>
          <div className="flex flex-1 flex-col p-10">
            <h3 className="text-blue my-4 text-lg font-medium dark:text-blue-100">{feature.name}</h3>
            <dl className="mt-1 flex flex-grow flex-col justify-between">
              <dt className="sr-only">Description</dt>
              <dd className="text-sm text-gray-600 dark:text-blue-400">{feature.description}</dd>
            </dl>
          </div>
        </li>
      ))}
    </ul>
    <WhyFormbricks />
    <div className="h-12"></div>
    <TryItCTA />
  </Layout>
);

export default CoreAPIPage;
