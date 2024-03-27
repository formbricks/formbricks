import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Image from "next/image";

import ColoredCommentsIcon from "./colored-comments-feedback-icon.svg";
import CommentsIcon2 from "./comments-icon-2.svg";
import CommentsIcon from "./comments-icon.svg";
import FeedbackEnvelopeIcon from "./feedback-envelope-icon.svg";
import FeedbackIcon from "./feedback-icon.svg";
import FeedbackMessageIcon from "./feedback-message-icon.svg";
import FeedbackTooltipIcon from "./feedback-tooltip-icon.svg";
import EmailFeedbackIcon from "./send-email-feedback-icon.svg";

const icons = [
  {
    iconPath: FeedbackIcon,
    iconName: "feedback-icon.svg",
    altText: "download feedback icon",
  },

  {
    iconPath: FeedbackTooltipIcon,
    iconName: "feedback-tooltip.svg",
    altText: "download feedback tooltip icon",
  },

  {
    iconPath: CommentsIcon,
    iconName: "comments-icon.svg",
    altText: "download feedback icon for comments",
  },

  {
    iconPath: ColoredCommentsIcon,
    iconName: "colored-comments-icon.svg",
    altText: "download colored feedback icon",
  },

  {
    iconPath: CommentsIcon2,
    iconName: "comments-icon-2.svg",
    altText: "download feedback icon for comments",
  },

  {
    iconPath: FeedbackMessageIcon,
    iconName: "feedback-envelope.svg",
    altText: "download envelope feedback icon",
  },

  {
    iconPath: EmailFeedbackIcon,
    iconName: "send-email-feedback-icon.svg",
    altText: "download send email feedback icon",
  },

  {
    iconPath: FeedbackEnvelopeIcon,
    iconName: "gui-feedback.svg",
    altText: "download message icon for feedback",
  },
];

export default function FeedbackBoxPage() {
  const handleDownload = (iconPath: string, iconName: string) => {
    const link = document.createElement("a");
    link.href = iconPath;
    link.setAttribute("download", iconName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Layout
      title="Download Free Feedback Icons and Symbols"
      description="Our feedback icon gallery offers a diverse collection of high-quality feedback icons that cater to various design preferences. 
      Whether you need a simple message, send, envelope, or more elaborate feedback symbols, it has you covered. 
      ">
      <HeroTitle
        headingPt1=""
        headingTeal="Feedback Icons"
        subheading="Explore our feedback icon gallery today and transform how users interact with your platform. Directly download high-quality SVG feedback icons by cicking on each icon card."
      />
      <div className="grid grid-cols-2 items-center gap-8 md:grid-cols-2 md:gap-10 lg:grid-cols-6">
        {icons.map((icon) => {
          const { iconPath, iconName, altText } = icon;
          return (
            <div
              onClick={() => handleDownload(iconPath, iconName)}
              className="h-40 w-40 cursor-pointer rounded-md border-slate-300 bg-slate-200 p-6 
        transition-transform duration-150 hover:scale-110 dark:border-slate-500 dark:bg-slate-700">
              <Image src={iconPath} className="w-full rounded-lg border" alt={altText} />
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
