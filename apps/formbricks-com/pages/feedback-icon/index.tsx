import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Image from "next/image";

import ColoredCommentsIcon from "./colored-comments-feedback-icon.svg";
import CommentsIcon2 from "./comments-icon-2.svg";
import CommentsIcon from "./comments-icon.svg";
import FeedbackEnvelope from "./feedback-envelope.svg";
import FeedbackIcon from "./feedback-icon.svg";
import FeedbackTooltipIcon from "./feedback-tooltip-icon.svg";
import GuiFeedback from "./gui-feedback.svg";
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
    iconPath: FeedbackEnvelope,
    iconName: "feedback-envelope.svg",
    altText: "download envelope feedback icon",
  },

  {
    iconPath: EmailFeedbackIcon,
    iconName: "send-email-feedback-icon.svg",
    altText: "download send email feedback icon",
  },

  {
    iconPath: GuiFeedback,
    iconName: "gui-feedback.svg",
    altText: "download gui feedback icon",
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
      title="Download Free Feedback Icons"
      description="Feedback Icon Collection: Directly Download High-Quality Feedback Icons">
      <HeroTitle
        headingPt1=""
        headingTeal="Feedback Icons"
        subheading="Click on each card to directly download high-quality SVG feedback icons"
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
