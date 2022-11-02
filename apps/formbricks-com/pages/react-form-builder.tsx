import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import Image from "next/image";
import ImageReactLib from "@/images/react-lib.png";
import ImageSchemaGeneration from "@/images/schema-generation-svg.svg";
import HeadingCentered from "@/components/shared/HeadingCenetered";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import TryItCTA from "../components/shared/TryItCTA";

const hereFeatures = [
  {
    name: "Unlimited forms",
  },
  {
    name: "Unlimited submissions",
  },
  {
    name: "Multiple choice questions",
  },
  {
    name: "Free text questions",
  },
  {
    name: "Custom “ThankYou” Page",
  },
  {
    name: "Webhooks",
  },
  {
    name: "Email Notifications",
  },
];

const nextFeatures = [
  {
    name: "20+ question types",
  },
  {
    name: "Integrations",
  },
  {
    name: "Granular data piping",
  },
  {
    name: "In-depth analytics",
  },
];

const soonFeatures = [
  {
    name: "Email notifications",
  },
  {
    name: "Form logic",
  },
  {
    name: "Hidden fields ",
  },
  {
    name: "A/B Test of wording",
  },
  {
    name: "Vue.js Library",
  },
];

const ReactFormBuilderPage = () => (
  <Layout meta={{ title: "React Form Builder Library by Formbricks" }}>
    <HeroTitle HeadingPt1="React" HeadingTeal="Form Builder" HeadingPt2="Library" />
    <div className="mt-8">
      <div className="max-w-md px-4 mx-auto sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
          <Image src={ImageReactLib} alt="react library" className="rounded-lg" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-3xl">
              Building React forms has never been quicker. But there is more...
            </h2>
            <p className="max-w-3xl mt-6 leading-7 text-gray-500 text-md dark:text-blue-300">
              Loads of question types, validation, multi-page forms, logic jumps, i18n, custom styles - all
              the good stuff you want, but don't want to build yourself.
            </p>
            <p className="max-w-3xl mt-6 leading-7 text-gray-500 text-md dark:text-blue-300">
              Building forms fast is great, but where do you pipe your data? And what is it worth without a
              schema?
            </p>
          </div>
        </div>
      </div>
    </div>
    <div className="mt-32">
      <div className="max-w-md px-4 mx-auto sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-3xl">
              Automatic schema generation for reliable insights
            </h2>
            <p className="max-w-3xl mt-6 leading-7 text-gray-500 text-md dark:text-blue-300">
              You can only reliably analyze your submissions when the form schema is sent along with the form.
            </p>
            <p className="max-w-3xl mt-6 leading-7 text-gray-500 text-md dark:text-slate-300">
              Use our React Forms Library with the Formbricks Data Pipes and get a full image of the data
              sent. Analyze it in our dashboard or forward it to your database.
            </p>
            <div className="mt-6">
              <div className="text-base font-medium text-teal-500">coming soon</div>
            </div>
          </div>
          <Image src={ImageSchemaGeneration} alt="react library" className="rounded-lg" />
        </div>
      </div>
    </div>
    <HeadingCentered
      Teaser="all you need in one package"
      Heading="Tons of powerful features (in the pipeline)"
      Subheading="20+ question types, easy multi-page forms and validation are on the roadmap. Check what’s already here:"
    />
    <div className="mx-auto mt-8 mb-28 md:inline-flex md:gap-x-5 lg:gap-x-20">
      <dl>
        {hereFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="flex items-center">
              <CheckIcon className="absolute w-6 h-6 ml-4 text-teal md:ml-0" aria-hidden="true" />
              <p className="text-lg leading-loose text-gray-200 ml-14 md:ml-9">{feature.name}</p>
            </dt>
          </div>
        ))}
      </dl>
      <dl>
        {nextFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="flex items-center max-w-sm mx-auto">
              <div className="bg-teal ml-2 rounded-full px-1.5 text-xs font-semibold text-black">
                <p>next</p>
              </div>
              <p className="ml-3 text-lg leading-loose text-gray-200">{feature.name}</p>
            </dt>
          </div>
        ))}
      </dl>
      <dl>
        {soonFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="flex items-center max-w-sm mx-auto">
              <div className="text-teal ml-2 rounded-full bg-black px-1.5 text-xs">
                <p>soon</p>
              </div>
              <p className="ml-3 text-lg leading-loose text-gray-200">{feature.name}</p>
            </dt>
          </div>
        ))}
        <a href="mailto:johannes@formbricks.com">
          <div className="flex items-center max-w-sm mx-auto transition duration-200 ease-in-out delay-100 hover:scale-105">
            <PlusIcon className="w-6 h-6 ml-4 text-teal md:ml-5" aria-hidden="true" />
            <p className="ml-5 text-lg leading-loose text-gray-300 underline underline-offset-4">
              Add feature to roadmap
            </p>
          </div>
        </a>
      </dl>
    </div>
    <TryItCTA />
  </Layout>
);

export default ReactFormBuilderPage;
