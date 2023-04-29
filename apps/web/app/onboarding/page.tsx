"use client";

import { cn } from "@/../../packages/lib/cn";
import { Button, ColorPicker, Input, Label } from "@/../../packages/ui";
import { Logo } from "@/components/Logo";
import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import { useProductMutation } from "@/lib/products/mutateProducts";
import { useProfile } from "@/lib/profile";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { fetcher } from "@formbricks/lib/fetcher";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

const MAX_STEPS = 6;

export default function Onboarding() {
  const { data, error } = useSWR(`/api/v1/environments/find-first`, fetcher);
  const { profile } = useProfile();
  const { triggerProfileMutate } = useProfileMutation();
  const [currentStep, setCurrentStep] = useState(1);
  const router = useRouter();

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

  if (error) {
    return <div className="flex h-full w-full items-center justify-center">An error occurred</div>
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

  const done = async () => {
    try {
      const updatedProfile = { ...profile, onboardingDisplayed: true };
      await triggerProfileMutate(updatedProfile);
      if (data) {
        router.push(`/environments/${data.id}`);
      }
    } catch (e) {
      console.log(e);
    }
  };

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
        {currentStep === 5 && <Product done={done} environmentId={data.id} />}
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

type IntentionChoice = {
  label: string;
  id:
    | "survey_user_segments"
    | "survey_at_specific_point_in_user_journey"
    | "enrich_customer_profiles"
    | "collect_all_user_feedback_on_one_platform"
    | "other";
};

const Intention: React.FC<Intention> = ({ next, skip }) => {
  const { profile } = useProfile();
  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  const intentions: Array<IntentionChoice> = [
    { label: "Survey user segments", id: "survey_user_segments" },
    { label: "Survey at specific point in user journey", id: "survey_at_specific_point_in_user_journey" },
    { label: "Enrich customer profiles", id: "enrich_customer_profiles" },
    { label: "Collect all user feedback on one platform", id: "collect_all_user_feedback_on_one_platform" },
    { label: "Other", id: "other" },
  ];

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const handleNextClick = async () => {
    if (selectedChoice) {
      const selectedIntention = intentions.find((intention) => intention.label === selectedChoice);
      if (selectedIntention) {
        try {
          const updatedProfile = { ...profile, intention: selectedIntention.id };
          await triggerProfileMutate(updatedProfile);
        } catch (e) {
          console.log(e);
        }
        next();
      }
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What are you planning to use Formbricks for?" questionId="none" />
        <Subheader subheader="Help us recommend you tried and tested best practices." questionId="none" />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className=" relative space-y-2 rounded-md">
              {intentions.map((choice) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      value={choice.label}
                      checked={choice.label === selectedChoice}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                    />
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
                      {choice.label}
                    </span>
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
        <Button
          size="lg"
          variant="primary"
          loading={isMutatingProfile}
          disabled={!selectedChoice}
          onClick={handleNextClick}>
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

type RoleChoice = {
  label: string;
  id: "project_manager" | "engineer" | "founder" | "marketing_specialist" | "other";
};

const Role: React.FC<Role> = ({ next, skip }) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const { profile } = useProfile();
  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  const roles: Array<RoleChoice> = [
    { label: "Project Manager", id: "project_manager" },
    { label: "Engineer", id: "engineer" },
    { label: "Founder", id: "founder" },
    { label: "Marketing Specialist", id: "marketing_specialist" },
    { label: "Other", id: "other" },
  ];

  const handleNextClick = async () => {
    if (selectedChoice) {
      const selectedRole = roles.find((role) => role.label === selectedChoice);
      if (selectedRole) {
        try {
          const updatedProfile = { ...profile, role: selectedRole.id };
          await triggerProfileMutate(updatedProfile);
        } catch (e) {
          console.log(e);
        }
        next();
      }
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="What is your role?" questionId="none" />
        <Subheader subheader="Make your Formbricks experience more personalised." questionId="none" />
        <div className="mt-4">
          <fieldset>
            <legend className="sr-only">Choices</legend>
            <div className=" relative space-y-2 rounded-md">
              {roles.map((choice) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      value={choice.label}
                      checked={choice.label === selectedChoice}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                    />
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
                      {choice.label}
                    </span>
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
        <Button
          size="lg"
          variant="primary"
          loading={isMutatingProfile}
          disabled={!selectedChoice}
          onClick={handleNextClick}>
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

type ObjectiveChoice = {
  label: string;
  id:
    | "increase_conversion"
    | "improve_user_retention"
    | "increase_user_adoption"
    | "sharpen_marketing_messaging"
    | "support_sales"
    | "other";
};

const Objective: React.FC<Objective> = ({ next, skip }) => {
  const objectives: Array<ObjectiveChoice> = [
    { label: "Increase conversion", id: "increase_conversion" },
    { label: "Improve user retention", id: "improve_user_retention" },
    { label: "Increase user adoption", id: "increase_user_adoption" },
    { label: "Sharpen marketing messaging", id: "sharpen_marketing_messaging" },
    { label: "Support sales", id: "support_sales" },
    { label: "Other", id: "other" },
  ];

  const { profile } = useProfile();
  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const handleNextClick = async () => {
    if (selectedChoice) {
      const selectedObjective = objectives.find((objective) => objective.label === selectedChoice);
      if (selectedObjective) {
        try {
          const updatedProfile = { ...profile, objective: selectedObjective.id };
          await triggerProfileMutate(updatedProfile);
        } catch (e) {
          console.log(e);
        }
        next();
      }
    }
  };

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
            <div className=" relative space-y-2 rounded-md">
              {objectives.map((choice) => (
                <label
                  key={choice.id}
                  className={cn(
                    selectedChoice === choice.label ? "z-10 border-slate-400 bg-slate-50" : "border-gray-200",
                    "relative flex cursor-pointer flex-col rounded-md border p-4 hover:bg-slate-50 focus:outline-none"
                  )}>
                  <span className="flex items-center text-sm">
                    <input
                      type="radio"
                      id={choice.id}
                      value={choice.label}
                      checked={choice.label === selectedChoice}
                      className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                      aria-labelledby={`${choice.id}-label`}
                      onChange={(e) => {
                        setSelectedChoice(e.currentTarget.value);
                      }}
                    />
                    <span id={`${choice.id}-label`} className="ml-3 font-medium">
                      {choice.label}
                    </span>
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
        <Button
          size="lg"
          variant="primary"
          loading={isMutatingProfile}
          disabled={!selectedChoice}
          onClick={handleNextClick}>
          Next
        </Button>
      </div>
    </div>
  );
};

type Product = {
  done: any;
  environmentId: string;
};

const Product: React.FC<Product> = ({ done, environmentId }) => {
  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#334155");

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleColorChange = (color) => {
    setColor(color);
  };

  const dummyChoices = ["❤️ Love it!"];

  const handleDoneClick = async () => {
    if (!name || !environmentId) {
      return;
    }

    try {
      await triggerProductMutate({ name, brandColor: color });
    } catch (e) {
      console.log(e);
    }
    done();
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <Headline headline="Create your team's product." questionId="none" />
        <Subheader subheader="You can always change these settings later." questionId="none" />
        <div className="mt-4 flex flex-col gap-2">
          <div className="pb-2">
            <div className="flex justify-between">
              <Label htmlFor="product">Your product name</Label>
              <span className="text-xs text-slate-500">Required</span>
            </div>
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
                  <div className=" relative space-y-2 rounded-md">
                    {dummyChoices.map((choice) => (
                      <label
                        key={choice}
                        className="relative z-10 flex flex-col rounded-md border border-slate-400 bg-slate-50 p-4 hover:bg-slate-50 focus:outline-none">
                        <span className="flex items-center text-sm">
                          <input
                            checked
                            readOnly
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
      <div className="flex items-center justify-end">
        <Button
          size="lg"
          variant="primary"
          loading={isMutatingProduct}
          disabled={!name || !environmentId}
          onClick={handleDoneClick}>
          Done
        </Button>
      </div>
    </div>
  );
};
