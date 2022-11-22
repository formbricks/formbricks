import Layout from "@/components/shared/Layout";
import HeroTitle from "@/components/shared/HeroTitle";
import Image from "next/image";
import ImageReactLib from "@/images/react-lib.png";
import ImageSchemaGeneration from "@/images/schema-generation-svg.svg";
import HeadingCentered from "@/components/shared/HeadingCentered";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import TryItCTA from "../components/shared/TryItCTA";
import FeatureHighlight from "@/components/shared/FeatureHighlight";

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
    name: "AI supported analysis",
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
  <Layout
    title="React Form Library"
    description="Loads of question types, validation, multi-page forms, logic jumps, i18n, custom styles - all the good stuff you want, but don't want to build yourself.">
    <HeroTitle headingPt1="React" headingTeal="Form Builder" headingPt2="Library" />
    <FeatureHighlight
      featureTitle="Building React forms has never been quicker. But there is more..."
      text={`Loads of question types, validation, multi-page forms, logic jumps, i18n, custom styles - all the good stuff you want, but don't want to build yourself.\n\nBuilding forms fast is great, but where do you pipe your data? And what is it worth without a schema?"`}
      img={<Image src={ImageReactLib} alt="react library" className="rounded-lg" />}
      isImgLeft
    />
    <FeatureHighlight
      featureTitle="Automatic schema generation for reliable insights"
      text="You can only reliably analyze your submissions when the form schema is sent along with the form. 

      Use our React Forms Library with the Formbricks Data Pipes and get a full image of the data sent. Analyze it in our dashboard or forward it to your database."
      img={<Image src={ImageSchemaGeneration} alt="react library" className="rounded-lg" />}
    />
    <HeadingCentered
      teaser="all you need in one package"
      heading="Tons of powerful features (in the pipeline)"
      subheading="20+ question types, easy multi-page forms and validation are on the roadmap. Check what’s already here:"
    />
    <div className="mx-auto mt-8 mb-28 md:inline-flex md:gap-x-5 lg:gap-x-20">
      <dl>
        {hereFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="flex items-center">
              <CheckIcon
                className="text-brand-light dark:text-brand-light absolute ml-4 h-6 w-6 md:ml-0"
                aria-hidden="true"
              />
              <p className="ml-14 text-lg leading-loose text-slate-500 dark:text-slate-200 md:ml-9">
                {feature.name}
              </p>
            </dt>
          </div>
        ))}
      </dl>
      <dl>
        {nextFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="mx-auto flex max-w-sm items-center">
              <div className="bg-brand-dark dark:bg-brand-light ml-2 rounded-full px-1.5 text-xs font-semibold text-slate-900">
                <p>next</p>
              </div>
              <p className="ml-3 text-lg leading-loose text-slate-500 dark:text-slate-200">{feature.name}</p>
            </dt>
          </div>
        ))}
      </dl>
      <dl>
        {soonFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="mx-auto flex max-w-sm items-center">
              <div className="text-brand-dark dark:text-brand-light ml-2 rounded-full bg-gray-200 px-1.5 text-xs font-bold dark:bg-gray-800 dark:font-normal">
                <p>soon</p>
              </div>
              <p className="ml-3 text-lg leading-loose text-slate-500 dark:text-slate-200">{feature.name}</p>
            </dt>
          </div>
        ))}
        <a href="mailto:johannes@formbricks.com">
          <div className="mx-auto flex max-w-sm items-center transition delay-100 duration-200 ease-in-out hover:scale-105">
            <PlusIcon
              className="text-brand-dark dark:text-brand-lightml-4 h-6 w-6 md:ml-5"
              aria-hidden="true"
            />
            <p className="ml-5 text-lg leading-loose text-slate-500 underline underline-offset-4 dark:text-slate-200">
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
