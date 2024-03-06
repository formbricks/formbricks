import FeatureCard from "@/components/salespage/FeatureCard";
import LayoutLight from "@/components/salespage/LayoutLight";
import LogoBar from "@/components/salespage/LogoBar";
import SalesPageFeature from "@/components/salespage/SalesPageFeature";
import SalesPageHero from "@/components/salespage/SalesPageHero";
import SalesSteps from "@/components/salespage/SalesSteps";
import SalesTestimonial from "@/components/salespage/SalesTestimonial";
import PlaceholderImg from "@/images/placeholder.png";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { IoCloseCircleOutline, IoPlayForwardCircleOutline } from "react-icons/io5";

const linkSurveySteps = [
  {
    id: "1",
    name: "Sign up",
    description: "It's free forever.",
  },
  {
    id: "2",
    name: "Create form",
    description: "Create your free online form in minutes. Style it to match your brand.",
  },
  {
    id: "3",
    name: "Analyze or forward",
    description: "Analyze responses right in Formbricks or pipe them to where you need them.",
  },
];

const linkSurveyFeaturesPt1 = [
  {
    headline: "Free forever, unlimited",
    subheadline:
      "Unlimited forms, unlimited responses. In the Cloud, we only charge for branding removal. Self-host with 1 click and get the complete product for free.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "The 'Do everything' forms",
    subheadline:
      "Formbricks packs all question types you can think of. But if you’re missing something, we’ll ship it!",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "100% on brand design",
    subheadline:
      "Create surveys in exactly the look & feel of your brand. Change colors, border radius and more to get exactly the look you want.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Slack, zapier, hubspot",
    subheadline:
      "Use native integrations into all of your tools. Keep your respondents data safe and your Privacy Policy short.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Embed anywhere",
    subheadline:
      "On your website, in an email. Get your forms in front of the right people effortlessly. Our community is working on a WordPress plugin as we speak.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Pre-populate fields",
    subheadline:
      "Prefill fields with data you have already. Enrich your analysis by gathering all data points in one place.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Conditional logic",
    subheadline:
      "Jump questions based on previous answers for higher completion rate. Conditional logic let’s you personalize the survey experience.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Multi-language surveys",
    subheadline: "Run the same survey in several languages. Analyse all results together or per language.",
    imgSrc: PlaceholderImg,
    imgAlt: "tba",
    imgLeft: true,
  },
];

const allFeaturesList = [
  {
    title: "Close on response limit",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: IoCloseCircleOutline,
  },
  {
    title: "Close on date",
    text: "Auto-close a survey on a specific date.",
    icon: CalendarDaysIcon,
  },
  {
    title: "Redirect on completion",
    text: "Redirect visitors after they completed your survey.",
    icon: IoPlayForwardCircleOutline,
  },
  {
    title: "Close on response limit",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: IoCloseCircleOutline,
  },
  {
    title: "Close on date",
    text: "Auto-close a survey on a specific date.",
    icon: CalendarDaysIcon,
  },
  {
    title: "Redirect on completion",
    text: "Redirect visitors after they completed your survey.",
    icon: IoPlayForwardCircleOutline,
  },
];

export default function LinkSurveyPage() {
  return (
    <LayoutLight
      title="The Open Source Typeform Alternative"
      description="Run surveys like with Google Forms, Microsoft Forms, Typeform or Jotform with our open source form builder.">
      <SalesPageHero
        headline="The Open Source Typeform Alternative"
        subheadline="Create beautiful online forms for free – all open-source. Unlimited surveys, unlimited responses. Easily self-hostable."
        imgSrc={PlaceholderImg}
        imgAlt="Free and open source Typeform alternative. Build forms online for free while keeping all data secure. Self-hosting for online form builder available for free."
      />
      <div className="space-y-40">
        <LogoBar />
        <SalesPageFeature
          headline="Finally, a good open source online form builder"
          subheadline="Everyone needs online forms and yet, there was no good open source builder for them. That’s why we are building it together with our community."
          imgSrc={PlaceholderImg}
          imgAlt="tba"
          imgLeft
        />

        <SalesSteps steps={linkSurveySteps} />
        {linkSurveyFeaturesPt1.map((feature) => {
          return (
            <SalesPageFeature
              headline={feature.headline}
              subheadline={feature.subheadline}
              imgSrc={feature.imgSrc}
              imgAlt={feature.imgAlt}
              imgLeft={feature.imgLeft}
            />
          );
        })}
        <SalesTestimonial
          quote="Finally a great open source survey tool! Formbricks proves once again that open source software can be both powerful and user-friendly."
          author="Jonathan Reimer, CEO @ crowd.dev"
          imgSrc={PlaceholderImg}
          imgAlt="tba"
        />
        {linkSurveyFeaturesPt2.map((feature) => {
          return (
            <SalesPageFeature
              headline={feature.headline}
              subheadline={feature.subheadline}
              imgSrc={feature.imgSrc}
              imgAlt={feature.imgAlt}
              imgLeft={feature.imgLeft}
            />
          );
        })}
        <div className="space-y-12">
          <h2 className="text-balance text-center text-5xl font-bold text-slate-800">All Features</h2>
          <div className="grid grid-cols-3 gap-4">
            {allFeaturesList.map((feature) => {
              return <FeatureCard title={feature.title} text={feature.text} Icon={feature.icon} />;
            })}
          </div>
        </div>
      </div>
    </LayoutLight>
  );
}
