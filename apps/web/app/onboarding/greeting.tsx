"use client";

import { Button } from "@/../../packages/ui";

type Greeting = {
  next: () => void;
  skip: () => void;
  name: string;
};

const Greeting: React.FC<Greeting> = ({ next, skip, name }) => {
  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
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
  );
};

export default Greeting;
