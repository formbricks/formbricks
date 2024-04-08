import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";
import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Image from "next/image";
import Link from "next/link";

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
      title="Feedback Icon: Free library of symbols and SVGs"
      description="Our feedback icon gallery offers a diverse collection of high-quality feedback icons that cater to various design preferences. 
      ">
      <HeroTitle
        headingPt1="Feedback Icon"
        subheading="Explore our feedback icon gallery and transform how users interact with your platform. Directly download high-quality SVG feedback icons by clicking on each icon card."
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
      <div className="space-y-12">
        <div className="mx-auto max-w-4xl text-slate-700">
          <h2 className="mb-3 mt-6 text-4xl font-semibold">How to get the best feedback from your users?</h2>
          <p>
            Getting feedback from users is an important part of any design and product building process. It
            helps designers, builders and entrepreneurs to understand how users interact with a website or
            application and identify areas for improvement. To get the best feedback from your users, consider
            the following tips:
          </p>
          <ul className="my-2 ml-3 list-disc">
            <li>
              Make it easy for users to provide feedback by using feedback icons, buttons, or other
              interactive elements.{" "}
              <Link className="underline" href="https://formbricks.com">
                Formbricks is a free and open source micro-survey tool
              </Link>{" "}
              which makes this really easy. It provides many best practices on how to collect feedback from
              your users.
            </li>
            <li>
              Encourage users to provide feedback by offering incentives such as discounts or rewards for
              completing surveys or comment forms.
            </li>
            <li>
              Use a variety of feedback tools such as surveys, comment boxes, or feedback icons to provide
              users with multiple ways to provide feedback.
            </li>
            <li>
              Act on user feedback by making changes to a website or application based on user suggestions or
              comments.
            </li>
            <li>
              Continuously seek feedback from users by regularly updating surveys or comment forms to gather
              new feedback.
            </li>
          </ul>
          <p>
            By following these tips, designers can get the best feedback from their users and use that
            feedback to improve the overall user experience of a website or application.
          </p>
          <h3 className="mb-3 mt-6 text-3xl font-semibold">Best practices for gathering user feedback</h3>
          <p>
            Gathering user feedback is an important part of the design and product building process. To gather
            the best feedback from users, consider the following best practices:
          </p>
          <ul className="my-2 ml-3 list-disc">
            <li>
              <b>Interview Prompt:</b> Target power users in your app and invite them to book an interview.{" "}
              <Link target="_blank" href="/interview-prompt" className="underline">
                Here is example and in-depth guide on how to do that.
              </Link>
            </li>
            <li>
              <b>Product-market Fit Survey:</b> Measure to what extend you have reached the omnious PMF!{" "}
              <Link target="_blank" href="/docs/best-practices/pmf-survey" className="underline">
                We&apos;ve written up how to do that here.
              </Link>
            </li>
            <li>
              <b>Onboarding Segmentation:</b> During Onboarding, many people are used to sharing some insights
              around how they found you.{" "}
              <Link target="_blank" href="/onboarding-segmentation" className="underline">
                Make use of that with this survey template and guide.
              </Link>
            </li>
            <li>
              <b>Churn Survey:</b> These insights are pure gold! Sometimes user react annoyed but{" "}
              <Link target="_blank" href="/docs/best-practices/cancel-subscription" className="underline">
                understanding why they churned is key to building a better product or service.
              </Link>
            </li>
            <li>
              <b>Feature Chaser:</b> Built a new feature? Follow up with users right after they used it with
              highly targeted in-app surveys.{" "}
              <Link target="_blank" href="/feature-chaser" className="underline">
                Formbricks is an open-source survey solution which makes this easy.
              </Link>
            </li>
            <li>
              <b>Feedback Box:</b> Giving your users a quick and easy way to provide targeted feedback is
              invaluable.{" "}
              <Link target="_blank" href="/docs/best-practices/feedback-box" className="underline">
                Here is a guide on how to do that within a few minutes using Formbricks.
              </Link>
            </li>
          </ul>
        </div>

        <BestPracticeNavigation />
        <div className="mx-auto max-w-4xl text-slate-700">
          <h2 className="mb-3 mt-6 text-3xl  font-semibold">The history of the feedback icon</h2>
          <p>
            The feedback icon is a visual representation of the feedback process. It is used to indicate that
            a user can provide feedback on a particular element or feature of a website or application. The
            feedback icon is typically displayed as a small icon or symbol that is easily recognizable and can
            be clicked on to provide feedback. The feedback icon is often used in conjunction with other
            elements such as text or buttons to encourage users to provide feedback. The feedback icon is an
            important part of the user experience design process as it helps to make it easy for users to
            provide feedback and helps to improve the overall user experience.
          </p>
          <h3 className="mb-3 mt-6 text-3xl  font-semibold">Different types of feedback icons</h3>
          <p>
            There are many different types of feedback icons that can be used to indicate that a user can
            provide feedback. Some common types of feedback icons include:
          </p>
          <ul className="my-2 ml-3 list-disc">
            <li>
              <b>Feedback envelope icon:</b> This icon is typically used to indicate that a user can send an
              email or message to provide feedback.
            </li>
            <li>
              <b> Feedback message icon:</b> This icon is typically used to indicate that a user can provide
              feedback by sending a message or comment.
            </li>
            <li>
              <b> Feedback tooltip icon:</b> This icon is typically used to indicate that a user can provide
              feedback by hovering over a tooltip or information box.
            </li>
            <li>
              <b>Feedback icon:</b> This icon is typically used to indicate that a user can provide feedback
              on a particular element or feature of a website or application.
            </li>
          </ul>
          <p>
            These are just a few examples of the many different types of feedback icons that can be used to
            indicate that a user can provide feedback. Each type of feedback icon has its own unique design
            and purpose, but they all serve the same basic function of encouraging users to provide feedback
            on a website or application.
          </p>
          <h3 className="mb-3 mt-6 text-3xl  font-semibold">
            How to get the most out of your feedback icon?
          </h3>
          <p>
            Feedback icons can be used in a variety of ways to encourage users to provide feedback on a
            website or application. Some common ways to use feedback icons include:
          </p>
          <ul className="my-2 ml-3 list-disc">
            <li>
              Placing feedback icons next to important elements or features of a website or application to
              encourage users to provide feedback on those elements.
            </li>
            <li>
              Using feedback icons in conjunction with other elements such as text or buttons to encourage
              users to provide feedback.
            </li>
            <li>
              Using feedback icons in conjunction with other feedback tools such as surveys or comment boxes
              to provide users with multiple ways to provide feedback.
            </li>
            <li>
              Using feedback icons in conjunction with other design elements such as colors or shapes to make
              them more visually appealing and engaging to users.
            </li>
          </ul>
          <p>
            By using feedback icons in these ways, designers can create a more engaging and interactive user
            experience that encourages users to provide feedback and helps to improve the overall user
            experience of a website or application.
          </p>
        </div>
      </div>
    </Layout>
  );
}
