import FeatureCard from "@/components/salespage/FeatureCard";
import LayoutLight from "@/components/salespage/LayoutLight";
import LogoBar from "@/components/salespage/LogoBar";
import SalesBreaker from "@/components/salespage/SalesBreaker";
import SalesPageFeature from "@/components/salespage/SalesPageFeature";
import SalesPageHero from "@/components/salespage/SalesPageHero";
import SalesSteps from "@/components/salespage/SalesSteps";
import SalesTestimonial from "@/components/salespage/SalesTestimonial";
import Jonathan from "@/images/clients/headshots/jonathan.png";
import Peer from "@/images/clients/headshots/peer.jpeg";
import PlaceholderImg from "@/images/placeholder.png";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import {
  IoAlertCircle,
  IoApps,
  IoCalendar,
  IoCash,
  IoCheckbox,
  IoCheckmarkCircle,
  IoCloudUpload,
  IoConstruct,
  IoHome,
  IoImage,
  IoPencil,
  IoRadioButtonOn,
  IoScale,
  IoStar,
  IoText,
  IoVideocam,
} from "react-icons/io5";

import Img2 from "./2-finally-good-open-source-forms-for-free.png";
import Img3 from "./3-free-online-form-builder-unlimited-forms-and-responses.png";
import Img4 from "./4-all-question-types-an-open-source-form-builder-needs.png";
import Img5 from "./5-all-question-types-an-open-source-form-builder-needs.png";
import Img6 from "./6-slack-zapier-hubspot-integration-for-open-source-form-builder-online.png";
import Img7 from "./7-embed-open-source-form-any-where-you-need-it.png";
import Img8 from "./8-pre-populate-typeform-open-source-alternative.png";
import Img9 from "./9-conditional-logic-jumps-for-free-open-source-online-form-builder.png";
import Img10 from "./10-multi-language-surveys-free-and-open-source.png";

const linkSurveySteps = [
  {
    id: "1",
    name: "Sign up",
    description: "It's free forever.",
  },
  {
    id: "2",
    name: "Create your form",
    description: "Create your free online form in minutes. Style it to match your brand.",
  },
  {
    id: "3",
    name: "AI Analysis",
    description: "Analyze responses right in Formbricks or pipe them to where you need them.",
  },
];

const linkSurveyFeaturesPt1 = [
  {
    headline: "Free forever, unlimited",
    subheadline:
      "Unlimited forms, responses, team members and workspaces. In the Cloud we only charge for branding removal. Self-host with 1 click and remove the branding for free.",
    imgSrc: Img3,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "The 'Do everything' forms",
    subheadline:
      "Formbricks packs all question types you can think of. But if you’re missing something, we’ll ship it!",
    imgSrc: Img4,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "100% on brand design",
    subheadline:
      "Create surveys in exactly the look & feel of your brand. Change colors, border radius and more to get exactly the look you want.",
    imgSrc: Img5,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Slack, Zapier, Hubspot",
    subheadline:
      "Use native integrations into all of your tools. Keep your respondents data safe and your Privacy Policy short.",
    imgSrc: Img6,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Embed anywhere",
    subheadline:
      "On your website, in an email. Get your forms in front of the right people effortlessly. Our community is working on a WordPress plugin as we speak.",
    imgSrc: Img7,
    imgAlt: "tba",
    imgLeft: false,
  },
];

const linkSurveyFeaturesPt2 = [
  {
    headline: "Pre-populate fields",
    subheadline:
      "Prefill fields with data you have already. Enrich your analysis by gathering all data points in one place.",
    imgSrc: Img8,
    imgAlt: "tba",
    imgLeft: true,
  },
  {
    headline: "Conditional logic",
    subheadline:
      "Jump questions based on previous answers for higher completion rate. Conditional logic let’s you personalize the survey experience.",
    imgSrc: Img9,
    imgAlt: "tba",
    imgLeft: false,
  },
  {
    headline: "Multi-language surveys",
    subheadline: "Run the same survey in several languages. Analyse all results together or per language.",
    imgSrc: Img10,
    imgAlt: "tba",
    imgLeft: true,
  },
];

const allFeaturesList = [
  {
    title: "Close on response limit",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Close on date",
    text: "Auto-close a survey on a specific date.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Redirect on completion",
    text: "Redirect visitors after they completed your survey.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Custom ‘Survey closed’ message",
    text: "Adjust how you tell respondents that your survey is closed.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Single-use survey links",
    text: "Generate links which can be used only once.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Verify email before response",
    text: "Ask for a valid email before allowing people to respond.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "PIN protected forms",
    text: "Require a PIN before letting people respond.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Hidden fields",
    text: "Add hidden fields you can prepulate via URL.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Multi-language surveys",
    text: "Translate your surveys, analyze responses together.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Email notifications",
    text: "Receive emails when people respond to your surveys",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Partial submissions",
    text: "Get all the insights down to the very first answer.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Recall information",
    text: "Pipe answers from previous quesitons for better questions.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Add images to questions",
    text: "Add an image or video to any question.",
    icon: IoCheckmarkCircle,
  },
  {
    title: "Add videos to questions",
    text: "Add an image or video to any question.",
    icon: IoConstruct,
  },
  {
    title: "Branded surveys",
    text: "Add your logo at the header of you survey.",
    icon: IoConstruct,
  },
  {
    title: "Custom domains",
    text: "Add your domain for higher brand recognition and trust.",
    icon: IoConstruct,
  },
  {
    title: "Calculations & quizzing",
    text: "Redirect visitors after they completed your survey.",
    icon: IoConstruct,
  },
  {
    title: "Auto-email respondents",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: IoConstruct,
  },
  {
    title: "Dropdowns & Rankings",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: IoConstruct,
  },
  {
    title: "Question groups",
    text: "Auto-close a survey on a specific date.",
    icon: IoConstruct,
  },
];

const allQuestionTypes = [
  {
    title: "Address field",
    text: "Gather addresses",
    icon: IoHome,
  },
  {
    title: "File upload",
    text: "Handle file uploads",
    icon: IoCloudUpload,
  },
  {
    title: "Net Promoter Score",
    text: "NPS",
    icon: IoScale,
  },
  {
    title: "Picture selection",
    text: "Find out what resonates",
    icon: IoImage,
  },
  {
    title: "Date picker",
    text: "Ask for specific dates",
    icon: IoCalendar,
  },
  {
    title: "Schedule a meeting",
    text: "Powered by Cal.com",
    icon: IoVideocam,
  },
  {
    title: "Open text",
    text: "Free text field",
    icon: IoText,
  },
  {
    title: "Single select",
    text: "Radio select field",
    icon: IoRadioButtonOn,
  },
  {
    title: "Multi select",
    text: "List of checkboxes",
    icon: IoCheckbox,
  },
  {
    title: "Rating",
    text: "Stars, smiles or numbers",
    icon: IoStar,
  },
  {
    title: "Call to action",
    text: "Prompt users with a CTA",
    icon: IoAlertCircle,
  },
  {
    title: "Consent",
    text: "Ask for consent.",
    icon: CalendarDaysIcon,
  },
  {
    title: "Signature (soon)",
    text: "Powered by Documenso",
    icon: IoPencil,
  },
  {
    title: "Collect payments (soon)",
    text: "Powered by Stripe",
    icon: IoCash,
  },
  {
    title: "Matrix question (soon)",
    text: "Run scientific surveys",
    icon: IoApps,
  },
];

const FAQ = [
  {
    question: "Is Formbricks really free forever?",
    answer:
      "Yes, its built for the community by the community. Our open source license assures that it will stay around until the internet dies.",
  },
  {
    question: "Can I self-host Formbricks?",
    answer: "Yes. Formbricks can be self-hosted with one click via our Docker image.",
  },
  {
    question: "How does it compare to typeform and other tools?",
    answer: "We have wrote up a side-by-side comparions on our blog.",
  },
  {
    question: "Is Formbricks GDPR-compliant?",
    answer:
      "Yes. Formbricks is developed and operated by a German company. Our Cloud is hosted in Frankfury, Germany. It’s fully GDPR and CCPA compliant. ",
  },

  {
    question: "Can I help build Formbricks?",
    answer: "Absolutely! we’d love to welcome you in our community. Join our discord to get started.",
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
          imgSrc={Img2}
          imgAlt="tba"
          imgLeft
        />

        <SalesSteps steps={linkSurveySteps} />
        {linkSurveyFeaturesPt1.map((feature) => {
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
          quote="Finally a great open source survey tool! Formbricks proves once again that open source software can be both powerful and user-friendly."
          author="Jonathan Reimer, CEO @ crowd.dev"
          imgSrc={Jonathan}
          imgAlt="Jonathan Reimer, CEO @ crowd.dev"
          textSize="large"
        />
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
        <SalesTestimonial
          quote="I've been looking for a solid open source Typeform alternative for a while. Super happy to see Formbricks building it!"
          author="Peer Richelsen, CEO @ cal.com"
          imgSrc={Peer}
          imgAlt="Peer Richelsen, Co-Founder and CEO of Cal.com"
          textSize="large"
        />
        <div className="space-y-12">
          <h2 className="text-balance text-center text-3xl font-bold text-slate-800">All Question Types</h2>
          <div className="grid grid-cols-3 gap-4">
            {allQuestionTypes.map((feature) => {
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
          headline="Try THE open source form builder"
          subheadline="Convinced that Formbricks is a good open source Typeform alternative? Try it now!"
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
        <SalesBreaker headline="What are you waiting for?" subheadline="Dive right in, it's free!" />
      </div>
    </LayoutLight>
  );
}
