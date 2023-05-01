"use client";

import { Button } from "@/../../packages/ui";
import Link from "next/link";

type Greeting = {
  next: () => void;
  skip: () => void;
  name: string;
};

const Greeting: React.FC<Greeting> = ({ next, skip, name }) => {
  return (
    <div className="flex h-full w-full max-w-xl flex-col justify-around gap-8 px-8">
      <div className="mt-auto h-1/2 space-y-6">
        <div className="px-4">
          <h1 className="pb-4 text-4xl font-bold text-slate-900">
            👋 Hi, {name}! <br />
            Welcome to Formbricks!
          </h1>
          <p className="text-xl text-slate-500">Let&apos;s finish setting up your account.</p>
        </div>
        <div className="flex justify-between">
          <Button size="lg" variant="minimal" onClick={skip}>
            I&apos;ll do it later
          </Button>
          <Button size="lg" variant="primary" onClick={next}>
            Begin (1 min)
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-center text-xs text-slate-400">
        <div className="pb-12 pt-8 text-center">
          <p>Your answers will help us improve your experience and help others like you.</p>
          <p>
            <Link href="https://formbricks.com/privacy-policy" target="_blank" className="underline">
              Click here
            </Link>{" "}
            to learn how we handle your data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Greeting;
