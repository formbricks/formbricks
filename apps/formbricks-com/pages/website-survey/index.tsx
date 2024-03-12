import FeatureCard from "@/components/salespage/FeatureCard";
import LayoutLight from "@/components/salespage/LayoutLight";
import LogoBar from "@/components/salespage/LogoBar";
import SalesBreaker from "@/components/salespage/SalesBreaker";
import SalesPageFeature from "@/components/salespage/SalesPageFeature";
import SalesPageHero from "@/components/salespage/SalesPageHero";
import SalesSteps from "@/components/salespage/SalesSteps";
import SalesTestimonial from "@/components/salespage/SalesTestimonial";
import HeadingCentered from "@/components/shared/HeadingCentered";
import SEOFAQ from "@/components/shared/SEO/SEOFAQ";
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
      "No need to make changes to your code base. Use generic triggers like clicks, page views, scroll depth or exit intent to trigger surveys when you need it. No-code targeting is a great way to enable less technical team mates to run open source online surveys.",
    imgSrc: Img3,
    imgAlt: "Illustration of no-code online survey targeting",
    imgLeft: false,
  },
  {
    headline: "100% privacy-first",
    subheadline:
      "Formbricks can be self-hosted with 1 click. Prefer a managed service? We run our Cloud as a German company, hosted in Germany: Fully GDPR- and CCPA-compliant. Keeping your data private has never been easier.",
    imgSrc: Img4,
    imgAlt: "GDPR and CCPA-compliant privacy-first online survey tool",
    imgLeft: true,
  },
  {
    headline: "Super fast ⚡",
    subheadline:
      "The Formbricks SDK is tiny (7KB). Keep your website lightning fast for better SEO. Formbricks website surveys load deferred so they never slow down your page.",
    imgSrc: Img5,
    imgAlt: "Fast loading online web surveys for SEO optimization",
    imgLeft: false,
  },
  {
    headline: "Multi-language surveys",
    subheadline:
      "You offer your website in several languages? No problem for surveys! Display online surveys in the language your visitor prefers automatically. Easily manage multi-language surveys with Formbricks.",
    imgSrc: Img6,
    imgAlt: "Multi-language online surveys for global audience engagement",
    imgLeft: true,
  },
  {
    headline: "Fully on brand design",
    subheadline:
      "Freely customize the look and feel of your website surveys. Make them match your user interface design for better conversion rates. Especially open source surveys provide the deepest level of customizability.",
    imgSrc: Img7,
    imgAlt: "Customizable on-brand design for online surveys",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Fine-grained targeting with custom attributes",
    subheadline:
      "Attach custom attributes to website visitors and target only the ones who match. Targeted online research yields much better insights at a lower cost. Our solution is built for scale (millions of visitors).",
    imgSrc: Img8,
    imgAlt: "Custom attribute targeting in online surveys for precise data collection",
    imgLeft: true,
  },
  {
    headline: "Forget about ad blockers",
    subheadline:
      "Many survey tools are considered tracking tools and get blocked by browsers. Formbricks does not track any persona information. Plus, you can always self-host Formbricks and increase your response rates significantly.",
    imgSrc: Img9,
    imgAlt: "Ad-blocker resistant online survey tool for higher response rates",
    imgLeft: false,
  },
  {
    headline: "Snap a screenshot for more context",
    subheadline:
      "Understand the context of users filling in your website surveys with a screenshot. Erase potentially personalized data out automatically.",
    imgSrc: Img10,
    imgAlt: "Context-enhancing screenshots for comprehensive online survey data",
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

const FAQs = [
  {
    question: "Is Formbricks really a free solution?",
    answer:
      "Absolutely! Formbricks offers both a complimentary Cloud plan and a community edition that's open source. You'll only invest in advanced features should you need them, ensuring that survey creation and data analysis are accessible to everyone.",
  },
  {
    question: "How can I host Formbricks myself?",
    answer:
      "Certainly! With just a single click, you can self-host Formbricks using our Docker image. This gives you total control over your survey data and privacy, aligning with GDPR and CCPA compliance.",
  },
  {
    question: "How does Formbricks stand against tools like Hotjar Ask?",
    answer:
      "Formbricks rivals the capabilities of many leading survey tools like Hotjar Ask, offering comprehensive feedback and insight mechanisms. Missing a feature? Let us know, and we're on it to add it!",
  },
  {
    question: "Does Formbricks meet GDPR compliance standards?",
    answer:
      "Indeed. As a product developed by a German company and hosted in Frankfurt, Germany, Formbricks ensures full compliance with GDPR and CCPA, prioritizing data security and privacy.",
  },
  {
    question: "Can Formbricks integrate with my website analytics?",
    answer:
      "Yes, Formbricks seamlessly integrates with various analytics tools, providing deeper insights into your survey data and how it correlates with your website's performance metrics.",
  },
  {
    question: "Is Formbricks suitable for mobile surveys?",
    answer:
      "Definitely! Formbricks is designed to be fully responsive, ensuring that your surveys look great and function perfectly on mobile devices, enhancing the user experience for all participants.",
  },
  {
    question: "How customizable are Formbricks surveys?",
    answer:
      "Formbricks surveys are highly customizable, allowing you to adjust the design to match your brand's look and feel. This level of personalization helps improve response rates and engagement.",
  },
  {
    question: "Does Formbricks support multi-language surveys?",
    answer:
      "Yes, Formbricks supports multiple languages, making it easy to create and manage surveys in different languages, catering to a global audience and enhancing the reach of your surveys.",
  },
  {
    question: "What makes Formbricks different from other survey tools?",
    answer:
      "Formbricks stands out with its open-source nature, privacy-first approach, and flexibility in hosting options. This unique combination ensures you can conduct surveys with full data control and compliance.",
  },
  {
    question: "How quick is the setup process with Formbricks?",
    answer:
      "Setting up with Formbricks is swift and straightforward. Whether you're opting for the cloud version or self-hosting, you can get your surveys up and running in no time, with no coding required.",
  },
];

export default function WebsiteSurveyPage() {
  return (
    <LayoutLight
      title="Website Surveys, Free and Open Source"
      description="Run targeted website surveys with full control over your data. Fly through compliance reviews by keeping all data on premise.">
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
        subheadline="Formbricks is open source and can be self-hosted easily. Fly through compliance reviews by keeping all data on premise - or use our EU Cloud 🇪🇺. Formbricks works in full compliance with data privacy regulation."
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
      <div className="">
        <HeadingCentered
          heading="All form builder features"
          teaser="Build open source forms like never before"
        />
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

      <HeadingCentered heading="Frequently asked questions" teaser="FAQ" />
      <SEOFAQ
        faqs={FAQs}
        headline="Targeted website surveys, open source. Like HotJar Ask but GDPR compliant."
        description="Make the most out of your website traffic by asking pointed quesitons in online surveys."
        datePublished="2024-03-12"
        dateModified="2024-03-12"
      />
    </LayoutLight>
  );
}
