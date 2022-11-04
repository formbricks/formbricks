import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import CTA from "../components/shared/CTA";
import Image from "next/image";
import ImageEmail from "../images/email.svg";
import HeadingCentered from "@/components/shared/HeadingCenetered";
import FeatureHighlight from "@/components/shared/FeatureHighlight";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";

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
    name: "Survey Templates",
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
];

const FormHQPage = () => (
  <Layout
    title="Visual Builder by Formbricks - Open source Typeform Alternative"
    description="Free open source alternative to Typeform, Jotform and SurveyMonkey. Build beautiful forms in minutes for free.">
    <HeroTitle headingPt1="Visual Form" headingTeal="Builder" />
    <FeatureHighlight
      featureTitle="Make beautiful surveys with our free & open source form builder"
      text={`Typeform, Jotform, Google Forms alternative but open-source and free to use? We got you! \n Use our visual web form builder to create beautiful forms and surveys in minutes. All the question types you need, multi-page forms, conditional logic - you name it!`}
      img={
        <video
          autoPlay
          loop
          muted
          src="/videos/visual-builder-vid.mp4"
          className="rounded-xl"
          poster="/videos/thumbnail-visual-form-builder.png">
          <source src="movie.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      }
      isImgLeft
      cta="coming soon"
      href="#"
    />
    <FeatureHighlight
      featureTitle="Get responses via email or analyze them online."
      text={`All survey responses get collected in your Form HQ. View and manage responses in your personal dashboard. \n Set up an email notification or send the complete submission data to your email.`}
      img={<Image src={ImageEmail} alt="react library" className="rounded-lg" />}
    />
    <HeadingCentered
      teaser="free & open-source"
      heading="Build exactly the form you want"
      subheading="Like a proper Typeform or Google Forms alternative, you can build forms and surveys and manage the responses easily."
    />

    <div className="mx-auto mt-8 mb-28 md:inline-flex md:gap-x-5 lg:gap-x-20">
      <dl>
        {hereFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="flex items-center">
              <CheckIcon className="text-teal absolute ml-4 h-6 w-6 md:ml-0" aria-hidden="true" />
              <p className="ml-14 text-lg leading-loose text-gray-500 dark:text-gray-200 md:ml-9">
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
              <div className="bg-teal ml-2 rounded-full px-1.5 text-xs font-semibold text-black">
                <p>next</p>
              </div>
              <p className="ml-3 text-lg leading-loose text-gray-500 dark:text-gray-200">{feature.name}</p>
            </dt>
          </div>
        ))}
      </dl>
      <dl>
        {soonFeatures.map((feature) => (
          <div key={feature.name}>
            <dt className="mx-auto flex max-w-sm items-center">
              <div className="text-teal ml-2 rounded-full bg-gray-100 px-1.5 text-xs font-bold dark:bg-black dark:font-normal">
                <p>soon</p>
              </div>
              <p className="ml-3 text-lg leading-loose text-gray-500 dark:text-gray-200">{feature.name}</p>
            </dt>
          </div>
        ))}
        <a href="mailto:johannes@formbricks.com">
          <div className="mx-auto flex max-w-sm items-center transition delay-100 duration-200 ease-in-out hover:scale-105">
            <PlusIcon className="text-teal ml-4 h-6 w-6 md:ml-5" aria-hidden="true" />
            <p className="ml-5 text-lg leading-loose text-gray-500 underline underline-offset-4 dark:text-gray-200">
              Add feature to roadmap
            </p>
          </div>
        </a>
      </dl>
    </div>
    <CTA />
  </Layout>
);

export default FormHQPage;
