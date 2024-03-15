import FeatureCard from "@/components/salespage/FeatureCard";
import LayoutLight from "@/components/salespage/LayoutLight";
import LogoBar from "@/components/salespage/LogoBar";
import SalesBreaker from "@/components/salespage/SalesBreaker";
import SalesPageFeature from "@/components/salespage/SalesPageFeature";
import SalesPageHero from "@/components/salespage/SalesPageHero";
import SalesSteps from "@/components/salespage/SalesSteps";
import SalesTestimonial from "@/components/salespage/SalesTestimonial";
import HeadingCentered from "@/components/shared/HeadingCentered";
import SeoFaq from "@/components/shared/seo/SeoFaq";
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
    description:
      "Copy a code snippet to the <HEAD> of your website and you're good to go! Works on all types of websites, including WordPress and Shopify.",
  },
  {
    id: "2",
    name: "Set up trigger",
    description: "Create a website survey and trigger it at the perfect time. No coding required.",
  },
  {
    id: "3",
    name: "AI analysis",
    description:
      "Analyze insights from your internet survey in Formbricks easily. Our privacy-first AI highlights key insights without leaking any data.",
  },
];

const websiteSurveyFeatures = [
  {
    headline: "No-code targeting",
    subheadline:
      "To set up and run an online survey, no code changes are needed. Use generic triggers like clicks, page views, scroll depth or exit intents to trigger web surveys whenever you want. Enable less technical team mates to run online surveys in minutes.",
    imgSrc: Img3,
    imgAlt: "Illustration of no-code online survey targeting",
    imgLeft: false,
  },
  {
    headline: "100% privacy-first",
    subheadline:
      "Formbricks can be self-hosted with one click. Prefer a managed service? We run our Cloud as a German company, hosted in Germany with full GDPR- and CCPA-compliance. Keeping survey data private has never been easier.",
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
    headline: "Multi-language website surveys",
    subheadline:
      "You offer your website in several languages? No problem! Display your online surveys in the language your visitor prefers automatically. Easily manage multi-language survey translations with Formbricks.",
    imgSrc: Img6,
    imgAlt: "Multi-language online surveys for global audience engagement",
    imgLeft: true,
  },
  {
    headline: "Fully on brand design",
    subheadline:
      "Freely customize the look and feel of your website surveys. Make them match your user interface for better conversion rates. Especially open source surveys provide the deepest level of customizability.",
    imgSrc: Img7,
    imgAlt: "Customizable on-brand design for online surveys",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Fine-grained targeting with custom attributes",
    subheadline:
      "Attach custom attributes to website visitors and target only the ones who match. Targeted online research yields much better insights at a lower cost. Formbricks is built for scale, it can handle millions of visitors smoothly.",
    imgSrc: Img8,
    imgAlt: "Custom attribute targeting in online surveys for precise data collection",
    imgLeft: true,
  },
  {
    headline: "Forget about ad blockers",
    subheadline:
      "Many survey tools are considered tracking tools and get blocked by browsers. Formbricks does not track any personal information out of the box. Plus, you can always self-host Formbricks and increase your response rates significantly.",
    imgSrc: Img9,
    imgAlt: "Ad-blocker resistant online survey tool for higher response rates",
    imgLeft: false,
  },
  {
    headline: "Snap a screenshot for more context",
    subheadline:
      "Understand the context of users filling in your website surveys with a screenshot. Erase potentially personalized data form your online questionnaire automatically.",
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
    question: "Is it really free to run website surveys with Formbricks?",
    answer:
      "Absolutely! Formbricks offers both a free Cloud plan and a community edition that's open source. If you self-host you can gather unlimited responses. If you use the Formbricks Cloud to run online surveys, we charge a small fee for every response which exceeds the generous free tier. For enterprise customers with advanced feature needs, we have a specific license and volume pricing.",
  },
  {
    question: "Can I host Formbricks myself?",
    answer:
      "Certainly! With just a single click, you can self-host Formbricks using our Docker image. This lets you run online questionnaires with total control over your survey data.",
  },
  {
    question: "How does Formbricks stand against other website survey tools on the market?",
    answer:
      "Formbricks is the only open source tool specializing in surveying. We pride ourselves to match if not beat existing tools with feature depth and usability. In terms of data privacy and compliance, Formbricks remains unbeaten due to its open source approach.",
  },
  {
    question: "Does Formbricks meet GDPR compliance standards?",
    answer:
      "Indeed. As a product developed by a German company and hosted in Frankfurt, Germany, Formbricks ensures full compliance with GDPR and CCPA. We provide everything you need for a swift compliance review.",
  },
  {
    question: "Is Formbricks suitable for mobile surveys?",
    answer:
      "Definitely, Formbricks online surveys are fully responsive. Your surveys look great and function perfectly on mobile devices, no matter on which device or browser the online questionnaire is displayed.",
  },
  {
    question: "How customizable are Formbricks surveys?",
    answer:
      "Formbricks surveys are highly customizable. The visual editor enables teams to easily match brand design guidelines and existing UIs. Tech-savvy users can load their own stylesheet for maximum flexibilioty. This depth of customization helps improve response rates of website surveys significantly.",
  },
  {
    question: "Does Formbricks support multi-language surveys?",
    answer:
      "Yes, Formbricks supports multiple languages. This makes it easy to create and manage online surveys in different languages. The internet is global and audiences diverse so Formbricks let's you display website surveys dynamically.",
  },
  {
    question: "What makes Formbricks different from other website survey tools?",
    answer:
      "Formbricks stands out with its open-source nature, privacy-first approach, and flexibility in hosting options. This unique combination ensures you can run beautiful online surveys with full data control and compliance.",
  },
  {
    question: "How quick is the setup process with Formbricks?",
    answer:
      "Setting up with Formbricks is swift and straightforward. Whether you're opting for the cloud version or self-hosting, you can get your website surveys up and running in no time, with no coding required.",
  },
];

export default function WebsiteSurveyPage() {
  return (
    <LayoutLight
      title="Website Surveys, Free and Open Source"
      description="Run targeted website surveys with full control over your data. Fly through compliance reviews by keeping all data on premise. Get started now!">
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
        subheadline="Formbricks is open source and can be self-hosted easily. Fly through compliance reviews by keeping all data on premise - or use our EU Cloud 🇪🇺. Formbricks works in full compliance with data privacy regulation worldwide."
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
        headline="All clear? Run your first website survey 👉"
        subheadline="Targeted website surveys, all privacy-first. Run professional research without compromising data privacy."
      />
      <div className="">
        <HeadingCentered
          heading={
            <span>
              Website surveys <i>exactly</i> how you want them
            </span>
          }
          teaser="All features you need"
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
      <div>
        <HeadingCentered heading="Frequently asked questions" teaser="FAQ" />
        <SeoFaq
          faqs={FAQs}
          headline="Targeted website surveys, open source. Like HotJar Ask but GDPR compliant."
          description="Make the most out of your website traffic by asking pointed quesitons in online surveys."
          datePublished="2024-03-12"
          dateModified="2024-03-12"
        />
      </div>
    </LayoutLight>
  );
}
