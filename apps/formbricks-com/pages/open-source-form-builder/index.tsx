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
import Jonathan from "@/images/clients/headshots/jonathan.png";
import Peer from "@/images/clients/headshots/peer.jpeg";
import {
  BadgeCheck,
  CalendarRange,
  Check,
  CreditCard,
  Gauge,
  Grid,
  Hammer,
  Headset,
  Home,
  Image,
  List,
  ListTodoIcon,
  MessageSquareText,
  MousePointerClick,
  PencilIcon,
  Star,
  Upload,
} from "lucide-react";

import Img1 from "./1-open-source-typeform-alternative-free.png";
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
    name: "Register for free",
    description: "Sign up for lifelong access to our open source at no cost.",
  },
  {
    id: "2",
    name: "Design your forms",
    description: "Build your open source forms in minutes. Style it to match your brand.",
  },
  {
    id: "3",
    name: "AI insights",
    description:
      "Analyze responses right in Formbricks. Or pipe them to where you need them via one of our native integrations.",
  },
];

const linkSurveyFeaturesPt1 = [
  {
    headline: "Free forms forever, unlimited",
    subheadline:
      "Get unlimited forms, responses, team members and workspaces in our open source web forms builder. In the Cloud we only charge for branding removal. Self-host with one click and remove the branding from all forms for free.",
    imgSrc: Img3,
    imgAlt: "Unlimited open source web forms displayed on various devices",
    imgLeft: false,
  },
  {
    headline: "The 'Do everything' forms",
    subheadline:
      "Our open source forms builder packs all question types you can think of. As a community-driven project, we build what our community needs: Your feedback makes Formbricks the best free web form builder out there.",
    imgSrc: Img4,
    imgAlt: "Versatile form types available in Formbricks open source form builder",
    imgLeft: true,
  },
  {
    headline: "100% on brand design",
    subheadline:
      "Create your open source web surveys in exactly the look & feel of your brand. Change colors or roundness, and set background images or animations to get exactly the look you want. Formbricks open source approach let's you customize your forms as much as you want.",
    imgSrc: Img5,
    imgAlt: "Customizable open source survey design matching brand identity",
    imgLeft: false,
  },
  {
    headline: "Slack, Zapier, Hubspot",
    subheadline:
      "Use native integrations into all of your tools. Keep your respondents data safe and your Privacy Policy short. The Formbricks community integrations make our web form builder the most versatile and extendable solution on the internet.",
    imgSrc: Img6,
    imgAlt: "Open source form builder integrating with Slack, Zapier, and Hubspot",
    imgLeft: true,
  },
  {
    headline: "Embed anywhere",
    subheadline:
      "Embed forms websites and in emails. Get your open source surveys in front of the right people effortlessly. You want to embed forms on a WordPress page? Our community is working on a free WordPress form plugin as we speak.",
    imgSrc: Img7,
    imgAlt: "Embeddable open source form on a website and email",
    imgLeft: false,
  },
];
const linkSurveyFeaturesPt2 = [
  {
    headline: "Pre-populate fields",
    subheadline:
      "Prefill fields with data you have already. Enrich your analysis by gathering all data points in one place. Versatile link prefilling lets you collect all data on our open source platform.",
    imgSrc: Img8,
    imgAlt: "Pre-populating fields in an open source form builder for enhanced data collection",
    imgLeft: true,
  },
  {
    headline: "Conditional logic",
    subheadline:
      "Jump questions based on previous answers for higher completion rate. Conditional logic lets you personalize the survey experience. Formbricks is the only open source form builder with comprehensive logic capabilities included.",
    imgSrc: Img9,
    imgAlt: "Custom survey paths using conditional logic in open source forms builder",
    imgLeft: false,
  },
  {
    headline: "Multi-language surveys",
    subheadline:
      "Run the same survey in several languages. Analyse all languages together or filter out feedback provided in specific languages. Not even Typeform has multi-language surveys, but our open source forms builder can handle it.",
    imgSrc: Img10,
    imgAlt: "Multi-language support in open source form builder, showcasing global survey capabilities",
    imgLeft: true,
  },
];

const allFeaturesList = [
  {
    title: "Close on response limit",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: Check,
  },
  {
    title: "Close on date",
    text: "Auto-close a survey on a specific date.",
    icon: Check,
  },
  {
    title: "Redirect on completion",
    text: "Redirect visitors after they completed your survey.",
    icon: Check,
  },
  {
    title: "Custom ‘Survey closed’ message",
    text: "Adjust how you tell respondents that your survey is closed.",
    icon: Check,
  },
  {
    title: "Single-use survey links",
    text: "Generate links which can be used only once.",
    icon: Check,
  },
  {
    title: "Verify email before response",
    text: "Ask for a valid email before allowing people to respond.",
    icon: Check,
  },
  {
    title: "PIN protected forms",
    text: "Require a PIN before letting people respond.",
    icon: Check,
  },
  {
    title: "Hidden fields",
    text: "Add hidden fields you can prepulate via URL.",
    icon: Check,
  },
  {
    title: "Multi-language surveys",
    text: "Translate your surveys, analyze responses together.",
    icon: Check,
  },
  {
    title: "Email notifications",
    text: "Receive emails when people respond to your surveys",
    icon: Check,
  },
  {
    title: "Partial submissions",
    text: "Get all the insights down to the very first answer.",
    icon: Check,
  },
  {
    title: "Recall information",
    text: "Pipe answers from previous quesitons for better questions.",
    icon: Check,
  },
  {
    title: "Add images to questions",
    text: "Add an image or video to any question.",
    icon: Check,
  },
  {
    title: "Add videos to questions",
    text: "Add an image or video to any question.",
    icon: Hammer,
  },
  {
    title: "Branded surveys",
    text: "Add your logo at the header of you survey.",
    icon: Hammer,
  },
  {
    title: "Custom domains",
    text: "Add your domain for higher brand recognition and trust.",
    icon: Hammer,
  },
  {
    title: "Calculations & quizzing",
    text: "Redirect visitors after they completed your survey.",
    icon: Hammer,
  },
  {
    title: "Auto-email respondents",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: Hammer,
  },
  {
    title: "Dropdowns & Rankings",
    text: "Auto-close a survey after hitting e.g. 50 responses.",
    icon: Hammer,
  },
  {
    title: "Question groups",
    text: "Auto-close a survey on a specific date.",
    icon: Hammer,
  },
];

const allQuestionTypes = [
  {
    title: "Address field",
    text: "Gather addresses",
    icon: Home,
  },
  {
    title: "File upload",
    text: "Handle file uploads",
    icon: Upload,
  },
  {
    title: "Net Promoter Score",
    text: "NPS",
    icon: Gauge,
  },
  {
    title: "Picture selection",
    text: "Find out what resonates",
    icon: Image,
  },
  {
    title: "Date picker",
    text: "Ask for specific dates",
    icon: CalendarRange,
  },
  {
    title: "Schedule a meeting",
    text: "Powered by Cal.com",
    icon: Headset,
  },
  {
    title: "Open text",
    text: "Free text field",
    icon: MessageSquareText,
  },
  {
    title: "Single select",
    text: "Radio select field",
    icon: List,
  },
  {
    title: "Multi select",
    text: "List of checkboxes",
    icon: ListTodoIcon,
  },
  {
    title: "Rating",
    text: "Stars, smiles or numbers",
    icon: Star,
  },
  {
    title: "Call to action",
    text: "Prompt users with a CTA",
    icon: MousePointerClick,
  },
  {
    title: "Consent",
    text: "Ask for consent.",
    icon: BadgeCheck,
  },
  {
    title: "Signature (soon)",
    text: "Powered by Documenso",
    icon: PencilIcon,
  },
  {
    title: "Collect payments (soon)",
    text: "Powered by Stripe",
    icon: CreditCard,
  },
  {
    title: "Matrix question (soon)",
    text: "Run scientific surveys",
    icon: Grid,
  },
];

const FAQs = [
  {
    question: "Is Formbricks truly a free and open source forms builder?",
    answer:
      "Absolutely, Formbricks is crafted for the community by the community. It's an open source project to build a free form builder for the web. Our open source license ensures its longevity for as long as the internet exists.",
  },
  {
    question: "Can I self-host Formbricks, the open source web forms builder?",
    answer:
      "Certainly. You can easily self-host Formbricks with a single click using our Docker image. We aim to build the most developer-friendly open source forms builder ever.",
  },
  {
    question: "How does Formbricks stack up against other JavaScript form builders?",
    answer:
      "We've conducted a detailed side-by-side comparison with other tools, including JavaScript form builders. You find the findings on our blog.",
  },
  {
    question: "Is Formbricks GDPR- and CCPA-compliant?",
    answer:
      "Indeed. As a German-developed open source form builder, Formbricks operates under strict GDPR and CCPA compliance. Our Cloud is securely hosted in Frankfurt, Germany.",
  },
  {
    question:
      "I want to help ship this JavaScript form build, how can I contribute to this open source form project?",
    answer:
      "We're thrilled to have more hands on deck! Join our community on Discord and start contributing to Formbricks. This opensource forms project is carried by its community.",
  },
  {
    question: "What sets Formbricks apart from other open source web form builders?",
    answer:
      "Unlike other open source forms builders, Formbricks is not a hobby project. We build this free web forms builder as a form of marketing for the wider Formbricks experience management platform. While this open source form builder will always be free, more advanced features for enterprise clients are licensed differently.",
  },
  {
    question: "Can Formbricks handle the nitty-gritty of complex form logic and third-party integrations?",
    answer:
      "Absolutely, Formbricks is a beast when it comes to complex scenarios. Whether it's weaving through intricate form logic or knitting together various APIs and services, this platform is all set to empower developers with its robust capabilities as an open source forms builder.",
  },
  {
    question: "How tight is the data security with Formbricks?",
    answer:
      "Security isn’t an afterthought here; it’s front and center. As an open source form project, Formbricks is committed to keeping your data locked down with best-in-class security practices, regular updates, and compliance with global data protection laws. Rest easy knowing your form data is in safe hands.",
  },
  {
    question: "What kind of customization can you actually do with Formbricks?",
    answer:
      "The sky's the limit when it comes to tweaking your forms. Formbricks hands you the keys to the kingdom with full code access, allowing for total customization. Whether you want to adjust the color scheme or overhaul the entire form layout, it’s all doable if you know how to code!",
  },
];

export default function LinkSurveyPage() {
  return (
    <LayoutLight
      title="Finally, a Good Open Source Form Builder"
      description="Build free online forms with our open source form builder. Build online questionnaiers like with Google Forms, Microsoft Forms or Typeform for free! Get started now.">
      <SalesPageHero
        headline="The Open Source Form Builder that does it all"
        subheadline="Create beautiful online forms for free – all open source. Unlimited surveys, unlimited responses. Easily self-hostable."
        imgSrc={Img1}
        imgAlt="Free and open source Typeform alternative. Build forms online for free while keeping all data secure. Self-hosting for online form builder available for free."
      />
      <LogoBar />
      <SalesPageFeature
        headline="A worthy open source Typeform alternative"
        subheadline="Everyone needs online forms and yet, there was no good open source builder for them. That’s why we - together with our community - have set out to build the best open source forms builder mankind has seen."
        imgSrc={Img2}
        imgAlt="GitHub indicator for open source forms builder project to build free and open source online forms."
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
        quote="Finally a great open source survey builder! Formbricks proves that open source surveys can be both powerful and user-friendly."
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
      <SalesBreaker
        headline="Try THE open source form builder 💪"
        subheadline="Convinced that Formbricks is a good open source Typeform alternative? Try it now!"
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
      <SalesTestimonial
        quote="I've been looking for a solid open source form builder for a while. Super happy to see Formbricks building it!"
        author="Peer Richelsen, CEO @ cal.com"
        imgSrc={Peer}
        imgAlt="Peer Richelsen, Co-Founder and CEO of Cal.com"
        textSize="large"
      />
      <div className="">
        <HeadingCentered heading="All question types included" teaser="A complete open source form builder" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      <div>
        <HeadingCentered heading="Frequently asked questions" teaser="FAQ" />
        <SeoFaq
          faqs={FAQs}
          headline="Open Source Typeform Alternative"
          description="Build Online Forms for Free with this Open Source Typeform Alternative"
          datePublished="2024-03-12"
          dateModified="2024-03-12"
        />
      </div>
      <SalesBreaker
        headline="What are you waiting for? 🤓"
        subheadline="Create your first open source form, it's free!"
      />
    </LayoutLight>
  );
}
