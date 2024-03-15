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
import Bailey from "@/images/clients/headshots/bailey.jpeg";
import Ram from "@/images/clients/headshots/ram.jpeg";
import Sachin from "@/images/clients/headshots/sachin.jpeg";
import {
  IoCalendarNumber,
  IoCaretDownCircle,
  IoFileTrayFull,
  IoFilter,
  IoPlayForward,
  IoStopwatch,
} from "react-icons/io5";

import Img1 from "./1-in-app-survey-open-source-free-gdpr-compliant-for-in-product-research.png";
import Img2 from "./2-in-app-survey-open-source-sprig-alternative.png";
import Img3 from "./3-granular-targeting-for-in-app-surveys-open-source.png";
import Img4 from "./4-multi-language-in-app-survey-translation-rtl-ltr.png";
import Img5 from "./5-fast-loading-in-product-surveys-for-apps-and-web-apps.png";
import Img6 from "./6-in-app-survey-native-look-and-feel-design-open-source.png";
import Img7 from "./7-unlimited-in-product-surveys-seats-team-members-open-source-and-free.png";
import Img8 from "./8-team-roles-micro-surveys-in-app-open-source-and-for-free.png";
import Img9 from "./9-reusable-segments-open-source-in-product-survey-software.png";

const inAppSurveySteps = [
  {
    id: "1",
    name: "Connect your app",
    description:
      "Install the Formbricks SDK with your favorite package manager in seconds. Run native inapp surveys within minutes.",
  },
  {
    id: "2",
    name: "Pre-segment cohorts",
    description:
      "Send attributes and events to Formbricks to create usage-based cohorts. Send out highly targeted app surveys for better insights.",
  },
  {
    id: "3",
    name: "AI analysis",
    description:
      "Analyze insights in Formbricks in a breeze with our AI. Enable everyone in your team to get the most out of your in-product research.",
  },
];

const inAppSurveyFeatures = [
  {
    headline: "Granular in-app targeting",
    subheadline:
      "Combine usage data with custom attributes and device information for fine-grained targeting. Targeted embedded surveys mean better insights for your research team and a better UX for your users.",
    imgSrc: Img3,
    imgAlt: "Screenshot of granular targeting feature in an in-app survey tool",
    imgLeft: false,
  },
  {
    headline: "Multi-language app surveys",
    subheadline:
      "For app surveys to fit in smoothly, they should feel like a part of your UI. Matching languages plays a big role for seamless product research. Formbricks lets you handle survey translations easily.",
    imgSrc: Img4,
    imgAlt: "Example of a multi-language survey embedded in a mobile app",
    imgLeft: true,
  },
  {
    headline: "Super fast loading",
    subheadline:
      "The Formbricks SDK is tiny (7KB). Keep your app lightning fast and your users engaged. The in-app survey SDK always loads deferred and never slows down your app.",
    imgSrc: Img5,
    imgAlt: "Demonstration of super fast loading times for an embedded survey in an app",
    imgLeft: false,
  },
  {
    headline: "On brand design",
    subheadline:
      "Customize your embedded surveys to fit in. Match the look & feel of your embedded surveys with your app. Leverage our no-code design editor or load a custom style sheet - all on the free plan!",
    imgSrc: Img6,
    imgAlt: "Preview of an on-brand design survey custom designed to fit within an app",
    imgLeft: true,
  },
  {
    headline: "Unlimited seats & products included",
    subheadline:
      "Embed Formbricks to run surveys in as many apps as you wish, without additional cost. Invite everyone who should work with user insights (hence, everyone). Product survey tools should never limit how far customer insights spread within a company.",
    imgSrc: Img7,
    imgAlt: "Illustration of embedding Formbricks surveys across multiple mobile apps",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Team roles",
    subheadline:
      "Control who can set up app surveys, and who gets to work with the insights gathered by your reserach. Granular access control allows everyone to work with the insights gathered with in-product research.",
    imgSrc: Img8,
    imgAlt: "Interface showcasing team roles and access rights for in-app survey setup and insights",
    imgLeft: true,
  },
  {
    headline: "Reuse segments to target consistently",
    subheadline:
      "Compose segments of app users with advanced filters. Reuse these segments to survey the same cohorts consistently. Keeping your targeting consistent allows to measure how much your app experience improves over time.",
    imgSrc: Img9,
    imgAlt: "Visualization of creating and reusing segments for targeted surveys inapp",
    imgLeft: false,
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
    question: "Is Formbricks really free for creating embedded or in-app surveys?",
    answer:
      "Yes, Formbricks offers both a free Cloud plan and an open source community edition. This makes it an accessible choice for deploying embedded surveys and in-app survey. Advanced features are available for those needing more specialized capabilities.",
  },
  {
    question: "Can I self-host Formbricks for more control over my product research tools?",
    answer:
      "Absolutely. Formbricks can be self-hosted with one click via our Docker image. This gives you full control over your product survey tools, while ensuring data privacy and compliance.",
  },
  {
    question:
      "How does Formbricks compare to other micro survey software in terms of features and flexibility?",
    answer:
      "Formbricks offers a comprehensive suite of features for embedded surveys, in-app feedback, and micro surveys. For see the speed development, have a look at the Formbricks repository on GitHub linked in the Footer. In case you're missing something, just let us know and we'll build it.",
  },
  {
    question: "Is Formbricks GDPR-compliant for use as an in-app survey tool and embedded survey platform?",
    answer:
      "Yes, Formbricks is fully GDPR and CCPA compliant. It's a reliable choice for businesses seeking an in-app survey tool which handles potentially personalized data. Hosted in Frankfurt, Germany, and developed by a German company, it ensures the highest standards of data protection.",
  },
  {
    question: "Can Formbricks help in conducting micro surveys within a mobile app?",
    answer: "Currently, we do not offer SDKs for mobile apps yet. However, this is on the roadmap for 2024.",
  },
  {
    question: "What are the best tools for creating an app survey?",
    answer:
      "For creating app surveys, Formbricks is among the top tools. As an open source product, we keep developer requirements at heart. However, the UX of Formbricks is designed also support marketers, researchers and sales reps in their work.",
  },
  {
    question: "How can I implement an in-app survey effectively?",
    answer:
      "To implement an in-app survey effectively, use Formbricks to embed surveys directly into your application. In-product research has higher conversion and completion rates than any other form of surveying.",
  },
  {
    question: "What is a micro survey and how can I use it with Formbricks?",
    answer:
      "A micro survey is a short, focused survey designed to capture quick insights. With Formbricks, you can easily create and embed these micro surveys into your website or app, enhancing the user experience and obtaining precise feedback.",
  },
  {
    question: "Are embedded surveys more effective for user engagement?",
    answer:
      "Yes, embedded surveys, like those created with Formbricks, are highly effective for user engagement. They blend naturally with the app or website, encouraging more users to participate and share their insights without leaving the platform.",
  },
  {
    question: "What advantages does Formbricks offer for in-app survey tools?",
    answer:
      "Formbricks offers numerous advantages for in-app surveys, including easy integration, real-time analytics, customizable survey templates, and micro survey capabilities. It's a powerful tool for enhancing user engagement and feedback collection.",
  },
];

export default function LinkSurveyPage() {
  return (
    <LayoutLight
      title="In-app Surveys, Open Source"
      description="Run targeted in-app surveys with full control over your data. Natively embed open source in-product reserach to understand what your users think. Get started in minutes.">
      <SalesPageHero
        headline={
          <span>
            In-app Surveys People <i>Want</i> to Fill Out
          </span>
        }
        subheadline="In-product user research with a native look and feel. Ask only the right cohort, ask gracefully."
        imgSrc={Img1}
        imgAlt="Targeted in-app surveys built on open source technology."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SalesTestimonial
          quote="We self-host Formbricks for our app with 100.000+ users. It's remarkable how the surveys feel like a native part of our own app. Great product, built for everyone who cares about UX!"
          author="Ram Pasala, CEO @ NeverInstall"
          imgSrc={Ram}
          imgAlt="Ram Pasala, CEO @ NeverInstall"
          textSize="base"
        />
        <SalesTestimonial
          quote="As a product-led growth company, we run surveys at key moments in our user journey. We spent a lot of time crafting our UX and I love how seamless Formbricks fits in! Should be a no-brainer for every product team."
          author="Bailey Pumfleet, Co-CEO @ Cal.com"
          imgSrc={Bailey}
          imgAlt="Cal.com co-founder Bailey Pumfleet speaks about how Formbricks in-app surveys feel like a native part of the UI of their product."
          textSize="large"
        />
      </div>
      <SalesPageFeature
        headline="Native look and feel, powered by open source"
        subheadline="Formbricks is fully open source. Integrate it natively and keep engineers, designers and researchers happy. Formbricks is the most versatile open source in-product survey tool available."
        imgSrc={Img2}
        imgAlt="Indicator of GitHub stars for open source in-app survey product Formbricks which rund embedded surveys with a native look and feel."
        imgLeft
      />

      <SalesSteps steps={inAppSurveySteps} />
      {inAppSurveyFeatures.map((feature) => {
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
      <SalesTestimonial
        quote="We're using Formbricks with Amplitude. The surveys fit in perfectly with our UI and the event-based targeting is super useful. The team loves it!"
        author="Sachin Jain, CEO @ Requestly (YC W22)"
        imgSrc={Sachin}
        imgAlt="Sachin Jain, CEO @ Requestly"
        textSize="base"
      />
      <div className="space-y-12">
        <HeadingCentered
          heading={
            <span>
              In-app surveys <i>exactly</i> how you want them
            </span>
          }
          teaser="All features backed in"
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
      <SalesBreaker
        headline="Embed surveys the right way - natively."
        subheadline="You spent months crafting your product, don’t ruin it with pop-ups."
      />
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
