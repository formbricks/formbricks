import FeatureCard from "@/components/salespage/FeatureCard";
import LayoutLight from "@/components/salespage/LayoutLight";
import LogoBar from "@/components/salespage/LogoBar";
import SalesBreaker from "@/components/salespage/SalesBreaker";
import SalesPageFeature from "@/components/salespage/SalesPageFeature";
import SalesPageHero from "@/components/salespage/SalesPageHero";
import SalesSteps from "@/components/salespage/SalesSteps";
import SalesTestimonial from "@/components/salespage/SalesTestimonial";
import Marius from "@/images/clients/headshots/marius.jpeg";
import Vishnu from "@/images/clients/headshots/vishnu.jpeg";
import {
  IoCalendarNumber,
  IoCaretDownCircle,
  IoFileTrayFull,
  IoFilter,
  IoPlayForward,
  IoStopwatch,
} from "react-icons/io5";

import Img1 from "./1-website-survey-open-source-free-gdpr-compliant-like-hotjar-ask.png";
import Img2 from "./2-open-source-website-survey-free-hotjar-ask-alternative-gdpr.png";
import Img3 from "./3-no-code-targeting-website-survey-open-source-survey.png";
import Img4 from "./4-privacy-first-website-form-survey-on-landing-page-open-source.png";
import Img5 from "./5-fast-loading-website-form-open-source-gdpr-ccpa-hotjar-ask-alternative.png";
import Img6 from "./5-multi-language-website-forms-open-source-for-free.png";
import Img7 from "./7-landing-page-survey-forms-open-source-hotjar-alternative.png";
import Img8 from "./8-targeting-website-surveys-open-source-trigger.png";
import Img9 from "./9-increase-conversion-rate-website-survey-open-source.png";
import Img10 from "./10-screenshot-of-website-survey-run-open-source-for-data-privacy-gpdr-ccpa.png";

const websiteSurveySteps = [
  {
    id: "1",
    name: "Connect your website",
    description: "Copy a code snippet to the HEAD of your website and you're good to go!",
  },
  {
    id: "2",
    name: "Set up trigger",
    description: "Create a survey and trigger it at the perfect time. No coding required.",
  },
  {
    id: "3",
    name: "AI analysis",
    description: "Analyze insights in Formbricks in a breeze with our AI.",
  },
];

const websiteSurveyFeatures = [
  {
    headline: "No-code targeting",
    subheadline:
      "No need to make changes to your code base. Use generic triggers like clicks, page views, scroll depth or exit intent to trigger surveys when you need it.",
    imgSrc: Img3,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "100% privacy-first",
    subheadline:
      "Formbricks can be self-hosted with 1 click. Prefer a managed service? We run our Cloud as a German company, hosted in Germany: Fully GDPR- and CCPA-compliant.",
    imgSrc: Img4,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Super fast ⚡",
    subheadline:
      "The Formbricks SDK is tiny (7KB). Keep your website lightning fast for better SEO. Formbricks loads deferred so never slows down your page.",
    imgSrc: Img5,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Multi-language surveys",
    subheadline:
      "Have your website in several languages? No problem! Easily manage multi language surveys with Formbricks.",
    imgSrc: Img6,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Fully on brand design",
    subheadline:
      "Freely customize the look and feel of your surveys. Make them match your website design for better conversion rates.",
    imgSrc: Img7,
    imgAlt: "tba",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Fine-grained targeting with custom attributes",
    subheadline:
      "Attach custom attributes to your visitors and target only visitors who match. Built for scale.",
    imgSrc: Img8,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Forget about ad blockers",
    subheadline:
      "Many survey tools are considered tracking tools and get blocked by browsers. Self-host Formbricks and increase your response rate significantly.",
    imgSrc: Img9,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Snap a screenshot for more context",
    subheadline:
      "Understand the context of users filling in your survey with a screenshot. Erase potentially personalized data out automatically.",
    imgSrc: Img10,
    imgAlt: "tba",
    imgLeft: true,
  },
];

const allFeaturesList = [
  {
    title: "Show survey to % of user",
    text: "Only show surveys to e.g. 50% of visitors.",
    icon: IoFilter,
  },
  {
    title: "Add delay before showing",
    text: "Wait a few seconds before showing the survey",
    icon: IoStopwatch,
  },
  {
    title: "Auto close in inactivity",
    text: "Auto close a survey if the visitors does not interact.",
    icon: IoCaretDownCircle,
  },
  {
    title: "Close survey on response limit",
    text: "Auto-close a survey after hitting e.g. 50 responses",
    icon: IoFileTrayFull,
  },
  {
    title: "Close survey on date",
    text: "Auto-close a survey on a specific date.",
    icon: IoCalendarNumber,
  },
  {
    title: "Redirect on completion",
    text: "Redirect visitors after they completed your survey.",
    icon: IoPlayForward,
  },
];

const FAQ = [
  {
    question: "Is Formbricks really free?",
    answer:
      "Yes, we have both a free Cloud plan and an open source community edition. Only pay advanced features, if you need them.",
  },
  {
    question: "Can I self-host Formbricks?",
    answer: "Yes. Formbricks can be self-hosted with one click via our Docker image.",
  },
  {
    question: "How does it compare to Hotjar Ask and similar tools?",
    answer: "Formbricks is as powerful as most other tools out there. Miss anything? We’ll build it!",
  },
  {
    question: "Is Formbricks GDPR-compliant?",
    answer:
      "Yes. Formbricks is developed and operated by a German company. Our Cloud is hosted in Frankfury, Germany. It’s fully GDPR and CCPA compliant. ",
  },
];

export default function LinkSurveyPage() {
  return (
    <LayoutLight
      title="Website Surveys, Free and Open Source"
      description="Run targeted website surveys with full control over your data.">
      <SalesPageHero
        headline="Website Surveys, Privacy-First 🔒"
        subheadline="Understand what people need on your website. Keep full control over your data, always."
        imgSrc={Img1}
        imgAlt="Run targeted website surveys to optimize conversions and learn from your visitors."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SalesTestimonial
          quote="We run NPS surveys for several products with Formbricks. It's open source and the team lays a strong focus on keeping user data secure and compliant - definitely recommended!"
          author="Marius Cristea, CTO @ ThemeIsle"
          imgSrc={Marius}
          imgAlt="Marius Cristea, CTO @ ThemeIsle"
          textSize="base"
        />
        <SalesTestimonial
          quote="As an open source company we highly value data privacy. It's so cool that we could self-host Formbricks within a few minutes using Docker. Great product, finally we have good open source survey software!"
          author="Vishnu Mohandas, Co-Founder @ ente.io"
          imgSrc={Vishnu}
          imgAlt="Vishnu Mohandas, Co-Founder @ ente.io"
          textSize="base"
        />
      </div>
      <SalesPageFeature
        headline="Keep all data private and secure"
        subheadline="Formbricks is open source and can be self-hosted easily. Fly through compliance reviews by keeping all data on premise - or use our EU Cloud 🇪🇺"
        imgSrc={Img2}
        imgAlt="Formbricks is open source and can be self-hosted easily. Fly through compliance reviews by keeping all data on premise - or use our EU cloud "
        imgLeft
      />

      <SalesSteps steps={websiteSurveySteps} />
      {websiteSurveyFeatures.map((feature) => {
        return (
          <SalesPageFeature
            key={feature.headline}
            headline={feature.headline}
            subheadline={feature.subheadline}
            imgSrc={feature.imgSrc}
            imgAlt={feature.imgAlt}
            imgLeft={feature.imgLeft}
          />
        );
      })}
      <LogoBar />
      {linkSurveyFeaturesPt2.map((feature) => {
        return (
          <SalesPageFeature
            key={feature.headline}
            headline={feature.headline}
            subheadline={feature.subheadline}
            imgSrc={feature.imgSrc}
            imgAlt={feature.imgAlt}
            imgLeft={feature.imgLeft}
          />
        );
      })}
      <SalesBreaker
        headline="All clear? Get started!"
        subheadline="Run targeted website surveys, all privacy-first. Make the most out of your website traffic while keeping your data private and secure."
      />
      <div className="space-y-12">
        <h2 className="text-balance text-center text-3xl font-bold text-slate-800">More Features</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allFeaturesList.map((feature) => {
            return (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                text={feature.text}
                Icon={feature.icon}
              />
            );
          })}
        </div>
      </div>
      <div className="space-y-12">
        <h2 className="text-balance text-center text-3xl font-bold text-slate-800">FAQ</h2>
        <div className="gap-4">
          {FAQ.map((question) => (
            <div key={question.question} className="">
              <div>
                <h3 className="mt-6 text-lg font-bold text-slate-700">{question.question} </h3>
                <p className="text-slate-600">{question.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LayoutLight>
  );
}
