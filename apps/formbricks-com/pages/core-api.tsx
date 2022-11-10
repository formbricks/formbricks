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
    <ul role="list" className="grid grid-cols-1 gap-6 px-12 pt-2 -mb-16 sm:grid-cols-2 md:grid-cols-3">
      {features.map((feature) => (
        <li
          key={feature.id}
          className="relative flex flex-col col-span-1 mt-16 text-center rounded-xl bg-gradient-to-b from-blue-200 to-gray-100 drop-shadow-sm dark:from-black dark:to-blue-900">
          <div className="absolute w-full -mt-12">
            <div className="flex items-center justify-center w-20 h-20 mx-auto rounded-full shadow via-blue to-blue bg-gradient-to-br from-black">
              <feature.icon className="flex-shrink-0 w-10 h-10 mx-auto text-teal-500" />
            </div>
          </div>
          <div className="flex flex-col flex-1 p-10">
            <h3 className="my-4 text-lg font-medium text-blue dark:text-blue-100">{feature.name}</h3>
            <dl className="flex flex-col justify-between flex-grow mt-1">
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
