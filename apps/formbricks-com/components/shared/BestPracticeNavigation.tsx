import {
  BaseballIcon,
  CancelSubscriptionIcon,
  CodeBookIcon,
  DogChaserIcon,
  FeedbackIcon,
  InterviewPromptIcon,
  OnboardingIcon,
  PMFIcon,
} from "@formbricks/ui/icons";
import clsx from "clsx";
import Link from "next/link";

export default function BestPracticeNavigation() {
  const BestPractices = [
    {
      name: "Interview Prompt",
      href: "/interview-prompt",
      status: true,
      icon: InterviewPromptIcon,
      description: "Ask only power users to book a time in your calendar. Get those juicy details.",
      category: "Understand Users",
    },
    {
      name: "Product-Market Fit Survey",
      href: "/measure-product-market-fit",
      status: true,
      icon: PMFIcon,
      description: "Find out how disappointed people would be if they could not use your service any more.",
      category: "Understand Users",
    },
    {
      name: "Onboarding Segments",
      href: "/onboarding-segmentation",
      status: false,
      icon: OnboardingIcon,
      description:
        "Get to know your users right from the start. Ask a few questions early, let us enrich the profile.",
      category: "Understand Users",
    },
    {
      name: "Learn from Churn",
      href: "/learn-from-churn",
      status: true,
      icon: CancelSubscriptionIcon,
      description: "Churn is hard, but insightful. Learn from users who changed their mind.",
      category: "Increase Revenue",
    },
    {
      name: "Improve Trial CR",
      href: "/improve-trial-conversion",
      status: true,
      icon: BaseballIcon,
      description: "Take guessing out, convert more trials to paid users with insights.",
      category: "Increase Revenue",
    },
    {
      name: "Docs Feedback",
      href: "/docs-feedback",
      status: true,
      icon: CodeBookIcon,
      description: "Clear docs lead to more adoption. Understand granularly what's confusing.",
      category: "Boost Retention",
    },
    {
      name: "Feature Chaser",
      href: "/feature-chaser",
      status: true,
      icon: DogChaserIcon,
      description: "Show a survey about a new feature shown only to people who used it.",
      category: "Boost Retention",
    },
    {
      name: "Feedback Box",
      href: "/feedback-box",
      status: true,
      icon: FeedbackIcon,
      description: "Give users the chance to share feedback in a single click.",
      category: "Boost Retention",
    },
  ];

  return (
    <div className="mx-auto grid grid-cols-1 gap-6 px-2 md:grid-cols-3">
      {BestPractices.map((bestPractice) => (
        <Link href={bestPractice.href} key={bestPractice.name}>
          <div className="drop-shadow-card duration-120 hover:border-brand-dark relative rounded-lg border border-slate-100 bg-slate-100 p-6 transition-all ease-in-out hover:scale-105 hover:cursor-pointer dark:border-slate-600 dark:bg-slate-800">
            <div
              className={clsx(
                // base styles independent what type of button it is
                "absolute right-6 rounded-full px-3 py-1 text-xs lg:text-sm",
                // different styles depending on type
                bestPractice.category === "Boost Retention" &&
                  "bg-pink-100 text-pink-500 dark:bg-pink-800 dark:text-pink-200",
                bestPractice.category === "Increase Revenue" &&
                  "bg-blue-100 text-blue-500 dark:bg-blue-800 dark:text-blue-200",
                bestPractice.category === "Understand Users" &&
                  "bg-orange-100 text-orange-500 dark:bg-orange-800 dark:text-orange-200"
              )}>
              {bestPractice.category}
            </div>
            <div className="h-12 w-12">
              <bestPractice.icon className="h-12 w-12 " />
            </div>
            <h3 className="mb-1 mt-3 text-xl font-bold text-slate-700 dark:text-slate-200">
              {bestPractice.name}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{bestPractice.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
