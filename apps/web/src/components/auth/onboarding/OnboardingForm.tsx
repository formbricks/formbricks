"use client";

import { Button } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const OnboardingForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string>("");

  const sendOnboardingSegmentation = async (e) => {
    e.preventDefault();
    // API Call to add to user object
  };

  const [q1, setQ1Options] = useState({
    startwhere: false,
    unresponsive: false,
    smallbase: false,
    consistency: false,
    implementation: false,
    other: "",
  });

  const [q2, setQ2Options] = useState({
    today: false,
    yesterday: false,
    lastweek: false,
    lastmonth: false,
    moreoften: false,
  });

  const handleQ1Change = (event) => {
    setQ1Options({ ...q1, [event.target.name]: event.target.checked });
  };

  const handleQ2Change = (event) => {
    setQ2Options({ ...q2, [event.target.name]: event.target.checked });
  };

  /* const OnboardingSchema {
    pages: [
      {
        id: "onboarding",
        elements: [
          {
            id: "hardestPart",
            type: "checkbox",
            label: "The hardest part about user research is...",
            name: "hardestPart",
            options: [
              { label: "Mixpanel", value: "startwhere" },  
              { label: "June", value: "unresponsive" },
              { label: "PostHog", value: "smallbase" },
              { label: "Amplitude", value: "consistency" },
              { label: "Segment", value: "implementation" },
            },
            {
            id: "researchFrequency",
            type: "checkbox",
            label: "How often do you talk to users?",
            name: "researchFrequency",
            options: [
              { label: "Not as often as we should", value: "todayasweshould" },  
              { label: "Periodically", value: "yesterday" },
              { label: "Continuously", value: "lastweek" },
              { label: "Weekly", value: "lastmonth" },
              { label: "Daily", value: "moreoften" },
            },
        ],
      },
  } */

  return (
    <>
      <form
        onSubmit={sendOnboardingSegmentation}
        className="mx-auto grid max-w-xs gap-x-12 pt-8 pb-2 sm:max-w-xl sm:grid-cols-2 sm:py-12">
        <div className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium text-slate-800">
            The hardest part about user research is...
          </label>
          <span className="text-xs text-slate-400">Helps us build the right integration first.</span>
          <div className="space-y-1">
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="startwhere"
                  checked={q1.startwhere}
                  onChange={handleQ1Change}
                />
                Mixpanel
              </label>
            </div>
            <div>
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="unresponsive"
                  checked={q1.unresponsive}
                  onChange={handleQ1Change}
                />
                June
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="smallbase"
                  checked={q1.smallbase}
                  onChange={handleQ1Change}
                />
                PostHog
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="consistency"
                  checked={q1.consistency}
                  onChange={handleQ1Change}
                />
                Amplitude
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="implementation"
                  checked={q1.implementation}
                  onChange={handleQ1Change}
                />
                Segment
              </label>
            </div>

            <div className="">
              <div className="mt-3">
                <input
                  id="other"
                  name="other"
                  type="text"
                  className="focus:border-brand focus:ring-brand-dark block w-full rounded-md border-gray-300 shadow-sm placeholder:text-slate-300 sm:text-sm"
                  placeholder="Other, please specify"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 space-y-4 sm:mt-0">
          <label htmlFor="email" className="block text-sm font-medium text-slate-800">
            How often do you talk to users?
          </label>
          <span className="text-xs text-slate-400">(honest answers only 😉)</span>
          <div className="space-y-1">
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="today"
                  checked={q2.today}
                  onChange={handleQ2Change}
                />
                Not as often as we should
              </label>
            </div>
            <div>
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="yesterday"
                  checked={q2.yesterday}
                  onChange={handleQ2Change}
                />
                Periodically
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="lastweek"
                  checked={q2.lastweek}
                  onChange={handleQ2Change}
                />
                Continuously
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="lastmonth"
                  checked={q2.lastmonth}
                  onChange={handleQ2Change}
                />
                Weekly
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="moreoften"
                  checked={q2.moreoften}
                  onChange={handleQ2Change}
                />
                Daily
              </label>
            </div>
          </div>
          <Button type="submit" className="float-right">
            next
          </Button>
        </div>
      </form>
      <div></div>
    </>
  );
};
