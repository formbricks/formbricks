"use client";

import { H1 } from "@formbricks/ui/components/Typography";

interface GreetingProps {
  userName: string;
}

export const Greeting = ({ userName }: GreetingProps) => {
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "☀️ Good morning";
    if (hour < 18) return "🌤️ Good afternoon";
    return "🌙 Good evening";
  }

  const greeting = getGreeting();

  return (
    <H1>
      {greeting}, {userName}
    </H1>
  );
};
