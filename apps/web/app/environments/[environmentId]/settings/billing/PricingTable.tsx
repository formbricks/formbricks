"use client";
import { Button } from "@formbricks/ui";

export default function PricingTable() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 rounded-lg bg-white p-8">
        <div className="">
          <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-3xl font-bold text-slate-700">Free</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Limited to 25 responses per survey.
              </p>
              <p className="mt-8">
                <span className="text-slate-80 text-4xl font-light">free</span>

                <span className="text-base font-medium text-slate-400 ">/ month</span>
              </p>

              <Button
                variant="minimal"
                disabled
                className="mt-6 w-full justify-center py-4 text-lg shadow-sm">
                Your current plan
              </Button>
            </div>
          </div>
        </div>
        <div className="">
          <div className="float-right -mt-2 mr-6 animate-bounce rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-50">
            Limited Early Bird Deal
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-3xl font-bold text-slate-700">Pro</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Unlimited surveys and responses.
              </p>
              <p className="mt-8">
                <span className="text-4xl font-bold text-slate-800">
                  <span className="mr-2 font-light line-through">$249</span>49$
                </span>

                <span className="text-base font-medium text-slate-400">/ month</span>
              </p>

              <Button disabled={true} className="mt-6 w-full justify-center py-4 text-lg shadow-sm">
                Upgrade
              </Button>
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="rounded-lg border border-slate-100  shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-2xl font-bold text-slate-700">Open-source</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Self-host Formbricks with all perks: Data ownership, customizability, limitless use.
              </p>
              <Button
                variant="secondary"
                className="mt-6 justify-center py-4 text-lg shadow-sm"
                href="https://formbricks.com/github"
                target="_blank">
                Learn more on GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
