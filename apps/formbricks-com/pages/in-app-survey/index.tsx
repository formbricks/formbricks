import FeatureCard from "@/components/salespage/FeatureCard";
import LayoutLight from "@/components/salespage/LayoutLight";
import LogoBar from "@/components/salespage/LogoBar";
import SalesBreaker from "@/components/salespage/SalesBreaker";
import SalesPageFeature from "@/components/salespage/SalesPageFeature";
import SalesPageHero from "@/components/salespage/SalesPageHero";
import SalesSteps from "@/components/salespage/SalesSteps";
import SalesTestimonial from "@/components/salespage/SalesTestimonial";
import Marius from "@/images/clients/headshots/marius.jpeg";
import Peer from "@/images/clients/headshots/peer.jpeg";
import Ram from "@/images/clients/headshots/ram.jpeg";
import PlaceholderImg from "@/images/placeholder.png";
import {
  IoCalendarNumber,
  IoCaretDownCircle,
  IoFileTrayFull,
  IoFilter,
  IoPlayForward,
  IoStopwatch,
} from "react-icons/io5";

const inAppSurveySteps = [
  {
    id: "1",
    name: "Connect your app",
    description: "Connect Formbricks with your web app in 5 minutes.",
  },
  {
    id: "2",
    name: "Pre-segment cohorts",
    description: "Send attributes and event to Formbricks to create usage-based cohorts.",
  },
  {
    id: "3",
    name: "AI analysis",
    description: "Analyze insights in Formbricks in a breeze with our AI.",
  },
];

const inAppSurveyFeatures = [
  {
    headline: "Granular targeting",
    subheadline:
      "Combine usage data with custom attributes and device information for fine-grained targeting. Create context-aware surveys for a better UX.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Multi-language surveys",
    subheadline:
      "For surveys to fit in smoothly, they should feel like a part of your app. Handle translations easily with Formbricks.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Super fast loading",
    subheadline: "The Formbricks SDK is tiny (7KB). Deferred loading will never slow down your app.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "On brand design",
    subheadline:
      "Customize your surveys so they really fit in. Match the look & feel of your app with our no-code design editor (or load your own style sheet).",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Unlimited seats & products included",
    subheadline:
      "Embed Formbricks in as many apps as you wish, all for free. Invite everyone who should work with user insights (hence, everyone).",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Team roles",
    subheadline:
      "Control who can set up surveys, and who works with the insights. Control access rights granularly.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Reusable segments",
    subheadline: "Compose segments with advanced filters. Reuse these segments to keep your data consistent.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
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
    question: "How does it compare to Sprig and similar tools?",
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
      title="In-app Surveys, Open Source"
      description="Run targeted inapp surveys with full control over your data.">
      <SalesPageHero
        headline="In-app surveys people want to fill out"
        subheadline="In-product user research built for scale. Ask only the right cohort, ask gracefully."
        imgSrc={PlaceholderImg}
        imgAlt="Targeted in app surveys built on open source technology."
      />
      <div className="space-y-40">
        <div className="grid gap-4 md:grid-cols-2">
          <SalesTestimonial
            quote="We run NPS surveys for several products with Formbricks. It's open source, the team is super responsive and we can use one license on unlimited domains - definitely recommended!"
            author="Marius Cristea, CTO @ ThemeIsle"
            imgSrc={Marius}
            imgAlt="Marius Cristea, CTO @ ThemeIsle"
            textSize="base"
          />
          <SalesTestimonial
            quote="We're using a self-hosted instance of Formbricks with tens of thousands of users. The insights we gather with Formbricks are invaluable for our product decisions. Great product, built for scale!"
            author="Ram Pasala, CEO @ NeverInstall"
            imgSrc={Ram}
            imgAlt="Ram Pasala, CEO @ NeverInstall"
            textSize="base"
          />
        </div>
        <SalesPageFeature
          headline="Native look and feel, powered by open source"
          subheadline="Formbricks is fully open source. Integrate it natively and keep engineers, designers and researchers happy."
          imgSrc={PlaceholderImg}
          imgAlt="tba"
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
        <SalesTestimonial quote="tba" author="tba" imgSrc={Peer} imgAlt="tba" textSize="large" />
        <div className="space-y-12">
          <h2 className="text-balance text-center text-3xl font-bold text-slate-800">More Features</h2>
          <div className="grid grid-cols-3 gap-4">
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
          headline="In-app surveys people WANT to reply to"
          subheadline="You spent months crafting your product, don’t ruin it with pop-ups."
        />
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
      </div>
    </LayoutLight>
  );
}
