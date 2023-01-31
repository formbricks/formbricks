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

  const [analytics, setAnalyticsOptions] = useState({
    mixpanel: false,
    june: false,
    posthog: false,
    amplitude: false,
    segment: false,
    other: "",
  });

  const [frequency, setFrequencyOptions] = useState({
    notasoftenasweshould: false,
    periodically: false,
    continuously: false,
    weekly: false,
    daily: false,
  });

  const handleAnalyticsChange = (event) => {
    setAnalyticsOptions({ ...analytics, [event.target.name]: event.target.checked });
  };

  const handleFrequencyChange = (event) => {
    setFrequencyOptions({ ...frequency, [event.target.name]: event.target.checked });
  };

  /* const OnboardingSchema {
    pages: [
      {
        id: "onboarding",
        elements: [
          {
            id: "analyticsTooling",
            type: "checkbox",
            label: "Which analytics tools are you using?",
            name: "analyticsTooling",
            options: [
              { label: "Mixpanel", value: "mixpanel" },  
              { label: "June", value: "june" },
              { label: "PostHog", value: "posthog" },
              { label: "Amplitude", value: "amplitude" },
              { label: "Segment", value: "segment" },
            },
            {
            id: "researchFrequency",
            type: "checkbox",
            label: "How often do you talk to users?",
            name: "researchFrequency",
            options: [
              { label: "Not as often as we should", value: "notasoftenasweshouldasweshould" },  
              { label: "Periodically", value: "periodically" },
              { label: "Continuously", value: "continuously" },
              { label: "Weekly", value: "weekly" },
              { label: "Daily", value: "daily" },
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
            Which analytics tools are you using?
          </label>
          <span className="text-xs text-slate-400">Helps us build the right integration first.</span>
          <div className="space-y-1">
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="mixpanel"
                  checked={analytics.mixpanel}
                  onChange={handleAnalyticsChange}
                />
                Mixpanel
              </label>
            </div>
            <div>
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="june"
                  checked={analytics.june}
                  onChange={handleAnalyticsChange}
                />
                June
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="posthog"
                  checked={analytics.posthog}
                  onChange={handleAnalyticsChange}
                />
                PostHog
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="amplitude"
                  checked={analytics.amplitude}
                  onChange={handleAnalyticsChange}
                />
                Amplitude
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="segment"
                  checked={analytics.segment}
                  onChange={handleAnalyticsChange}
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
                  name="notasoftenasweshould"
                  checked={frequency.notasoftenasweshould}
                  onChange={handleFrequencyChange}
                />
                Not as often as we should
              </label>
            </div>
            <div>
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="periodically"
                  checked={frequency.periodically}
                  onChange={handleFrequencyChange}
                />
                Periodically
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="continuously"
                  checked={frequency.continuously}
                  onChange={handleFrequencyChange}
                />
                Continuously
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="weekly"
                  checked={frequency.weekly}
                  onChange={handleFrequencyChange}
                />
                Weekly
              </label>
            </div>
            <div className="">
              <label className="block cursor-pointer font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="focus:border-brand text-brand-dark focus:ring-brand-dark mr-2 h-5 w-5 rounded-md border-gray-300"
                  name="daily"
                  checked={frequency.daily}
                  onChange={handleFrequencyChange}
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
