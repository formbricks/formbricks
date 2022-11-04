import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import ImageEmail from "@/images/email.svg";
import Image from "next/image";
import TryItCTA from "../components/shared/TryItCTA";
import FeatureHighlight from "@/components/shared/FeatureHighlight";
import { CodeBracketSquareIcon, EnvelopeOpenIcon, ServerStackIcon } from "@heroicons/react/24/outline";

const features = [
  {
    id: "allForms",
    name: "Works with Every Form",
    description: "Javascript forms, HTML forms, form widgets - all works. Send it over, take it from here.",
    icon: CodeBracketSquareIcon,
  },
  {
    id: "dataInsights",
    name: "Multiple Email Addresses",
    description: "Add as many email addresses as you like. Send responses and notifications.",
    icon: EnvelopeOpenIcon,
  },
  {
    id: "selfHost",
    name: "Self-host or Cloud",
    description: "Set your emails up in our Form HQ or self-host the entire solution yourself.",
    icon: ServerStackIcon,
  },
];

const EmailPage = () => (
  <Layout
    title="Form to Email"
    description="In some cases, the good old email is the way to go. In the Form HQ you can setup forwarding submission data to one or more emails.">
    <HeroTitle headingPt1="Email" />
    <FeatureHighlight
      featureTitle="Get responses to your inbox"
      text="In some cases, the good old email is the way to go. In the Form HQ you can setup forwarding submission data to one or more emails."
      img={<Image src={ImageEmail} alt="react library" className="rounded-lg" />}
      isImgLeft
      cta="Get started"
      href="/get-started"
    />
    <ul role="list" className="grid grid-cols-1 gap-6 px-12 pt-2 pb-16 sm:grid-cols-2 md:grid-cols-3">
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
    <TryItCTA />
  </Layout>
);

export default EmailPage;
