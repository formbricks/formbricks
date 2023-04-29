"use client";

import { cn } from "@/../../packages/lib/cn";
import { Button, ColorPicker, Input, Label } from "@/../../packages/ui";
import { Logo } from "@/components/Logo";
import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import { useProfile } from "@/lib/profile";
import Link from "next/link";
import { useMemo, useState } from "react";

const MAX_STEPS = 6;

export default function Onboarding() {
  const { profile } = useProfile();

  const [currentStep, setCurrentStep] = useState(1);

  const percent = useMemo(() => {
    return Math.floor((currentStep / MAX_STEPS) * 100);
  }, [currentStep]);

  const progressSize = useMemo(() => {
    switch (percent) {
      case 16:
        return "w-1/6";
      case 33:
        return "w-2/6";
      case 50:
        return "w-3/6";
      case 66:
        return "w-4/6";
      case 83:
        return "w-5/6";
    }
  }, [percent]);

  if (!profile) {
    return <div className="flex h-full w-full items-center justify-center">Loading</div>;
  }

  const skip = () => {
    setCurrentStep(5);
  };

  const next = () => {
    if (currentStep < MAX_STEPS) {
      setCurrentStep((value) => value + 1);
      return;
    }
  };

  const done = () => {};

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-6 items-center pb-4 pt-12">
        <div className="col-span-2">
          <Logo className="w-1/2" />
        </div>
        <div className="col-span-2 flex items-center justify-center gap-8">
          <div className="relative h-2 grow overflow-hidden rounded-full bg-slate-200">
            <div className={cn(progressSize, "bg-brand-light absolute h-full transition-all")} />
          </div>
          <div className="grow-0 text-xs font-semibold text-slate-700">
            {currentStep < 5 ? <>{percent}% complete</> : <>Almost there!</>}
          </div>
        </div>
        <div className="col-span-2" />
      </div>
      <div className="flex grow items-center justify-center">
        {currentStep === 1 && <Greeting next={next} skip={skip} name={profile.name} />}
        {currentStep === 2 && <Intention next={next} skip={skip} />}
        {currentStep === 3 && <Role next={next} skip={skip} />}
        {currentStep === 4 && <Objective next={next} skip={skip} />}
        {currentStep === 5 && <Product done={done} />}
      </div>
      <div className="flex items-center justify-center text-xs text-slate-500">
        <div className="pb-12 pt-8 text-center">
          <p>Your answers will help us improve your experience and help others like you.</p>
          <p>
            <Link href="" className="underline">
              Click here
            </Link>{" "}
            to learn how we handle your data.
          </p>
        </div>
      </div>
    </div>
  );
}

type Greeting = {
  next: any;
  skip: any;
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

type Intention = {
  next: any;
  skip: any;
};

const Intention: React.FC<Intention> = ({ next, skip }) => {
  const intentions = [
    "Survey user segments",
    "Survey at specific point in user journey",
    "Enrich customer profiles",
    "Collect all user feedback on one platform",
    "Other",
  ];

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What are you planning to use Formbricks for?" questionId="none" />
        <Subheader subheader="Help us recommend you tried and tested best practices." questionId="none" />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className="pointer-events-none relative space-y-2 rounded-md">
              {intentions.map((intention) => (
                <label
                  key={intention}
                  className="relative flex flex-col rounded-md border border-gray-200 p-4 hover:bg-slate-50 focus:outline-none">
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="ml-3 font-medium">{intention}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <div className="flex justify-between">
        <Button size="lg" variant="minimal" onClick={skip}>
          Skip
        </Button>
        <Button size="lg" variant="primary" onClick={next}>
          Next
        </Button>
      </div>
    </div>
  );
};

type Role = {
  next: any;
  skip: any;
};

const Role: React.FC<Role> = ({ next, skip }) => {
  const roles = ["Project Manager", "Engineer", "Founder", "Marketing Specialist", "Other"];

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What is your role?" questionId="none" />
        <Subheader subheader="Make your Formbricks experience more personalised." questionId="none" />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className="pointer-events-none relative space-y-2 rounded-md">
              {roles.map((role) => (
                <label
                  key={role}
                  className="relative flex flex-col rounded-md border border-gray-200 p-4 hover:bg-slate-50 focus:outline-none">
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="ml-3 font-medium">{role}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <div className="flex justify-between">
        <Button size="lg" variant="minimal" onClick={skip}>
          Skip
        </Button>
        <Button size="lg" variant="primary" onClick={next}>
          Next
        </Button>
      </div>
    </div>
  );
};

type Objective = {
  next: any;
  skip: any;
};

const Objective: React.FC<Objective> = ({ next, skip }) => {
  const objectives = [
    "Increase conversion",
    "Improve user retention",
    "Increase user adoption",
    "Sharpen marketing messaging",
    "Support sales",
    "Other",
  ];

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What do you want to achieve?" questionId="none" />
        <Subheader
          subheader="We have 85+ templates, help us select the best for your need:"
          questionId="none"
        />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className="pointer-events-none relative space-y-2 rounded-md">
              {objectives.map((objective) => (
                <label
                  key={objective}
                  className="relative flex flex-col rounded-md border border-gray-200 p-4 hover:bg-slate-50 focus:outline-none">
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="ml-3 font-medium">{objective}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <div className="flex justify-between">
        <Button size="lg" variant="minimal" onClick={skip}>
          Skip
        </Button>
        <Button size="lg" variant="primary" onClick={next}>
          Next
        </Button>
      </div>
    </div>
  );
};

type Product = {
  done: any;
};

const Product: React.FC<Product> = ({ done }) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#334155");

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleColorChange = (color) => {
    setColor(color);
  };

  const dummyChoices = ["❤️ Love it!"];

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="Create your team's product." questionId="none" />
        <Subheader subheader="You can always change these settings later." questionId="none" />
        <div className="mt-4 flex flex-col gap-2">
          <div className="pb-2">
            <Label htmlFor="product">Your product name</Label>
            <div className="mt-2">
              <Input id="product" type="text" placeholder="e.g. Formbricks" onChange={handleNameChange} />
            </div>
          </div>
          <div>
            <Label htmlFor="color">Primary color</Label>
            <div className="mt-2">
              <ColorPicker color={color} onChange={handleColorChange} />
            </div>
          </div>
          <div className="relative flex cursor-not-allowed flex-col items-center gap-4 rounded-md border border-slate-300 px-16 py-8">
              <div
                className="absolute left-0 right-0 top-0 h-full w-full opacity-10"
                style={{ backgroundColor: color }}
              />
            <p className="text-xs text-slate-500">This is what your survey will look like:</p>
            <div className="relative w-full max-w-sm cursor-not-allowed rounded-lg bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 sm:p-6">
              <Headline headline={`How do you like ${name ? name : "PRODUCT"}?`} questionId="none" />
              <div className="mt-4">
                <fieldset>
                  <legend className="sr-only">Choices</legend>
                  <div className="pointer-events-none relative space-y-2 rounded-md">
                    {dummyChoices.map((choice) => (
                      <label
                        key={choice}
                        className="relative z-10 flex flex-col rounded-md border border-slate-400 bg-slate-50 p-4 hover:bg-slate-50 focus:outline-none">
                        <span className="flex items-center text-sm">
                          <input
                            checked
                            type="radio"
                            className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                            style={{ borderColor: "brandColor", color: "brandColor" }}
                          />
                          <span className="ml-3 font-medium">{choice}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="mt-4 flex w-full justify-end">
                <Button className="pointer-events-none" style={{ backgroundColor: color }}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="lg" variant="primary" onClick={done}>
          Done
        </Button>
      </div>
    </div>
  );
};
