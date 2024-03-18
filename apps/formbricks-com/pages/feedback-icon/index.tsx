import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Image from "next/image";

import CommentsIcon2 from "./comments-icon-2.svg";
import CommentsIcon from "./comments-icon.svg";
import FeedbackIcon from "./feedback-icon.svg";

const icons = [
  {
    iconPath: FeedbackIcon,
    iconName: "feedback-icon.svg",
    altText: "feedback-icon",
  },
  {
    iconPath: CommentsIcon,
    iconName: "comments-icon.svg",
    altText: "comments-icon",
  },
  {
    iconPath: CommentsIcon2,
    iconName: "comments-icon-2.svg",
    altText: "comments-icon",
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
    <Layout title="Feedback Icon" description="Feedback Icon Collection: Direct Download">
      <HeroTitle headingPt1="" headingTeal="Feedback Icon" subheading="Directly download feedback icons" />
      <div className="grid grid-cols-2 items-center gap-8 md:grid-cols-2 md:gap-10 lg:grid-cols-6">
        {icons.map((icon) => {
          const { iconPath, iconName } = icon;
          return (
            <div
              onClick={() => handleDownload(iconPath, iconName)}
              className="h-40 w-40 cursor-pointer rounded-md border-slate-300 bg-slate-200 p-6 
        transition-transform duration-150 hover:scale-110 dark:border-slate-500 dark:bg-slate-700">
              <Image src={iconPath} className="w-full rounded-lg border" alt="feedback-icon" />
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
