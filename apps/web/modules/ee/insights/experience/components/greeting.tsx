"use client";

import { H1 } from "@/modules/ui/components/typography";
import { useTranslations } from "next-intl";

interface GreetingProps {
  userName: string;
}

export const Greeting = ({ userName }: GreetingProps) => {
  const t = useTranslations();
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t("environments.experience.good_morning");
    if (hour < 18) return t("environments.experience.good_afternoon");
    return t("environments.experience.good_evening");
  }

  const greeting = getGreeting();

  return (
    <H1>
      {greeting}, {userName}
    </H1>
  );
};
