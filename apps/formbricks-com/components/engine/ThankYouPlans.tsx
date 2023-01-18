import Button from "../shared/Button";
import { SurveyElement } from "./engineTypes";

export default function ThankYouPlans({ element }: { element: SurveyElement }) {
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4">
      <div className="rounded-lg p-6">
        <div className="flex justify-between">
          <h3 className="text-3xl font-bold text-gray-700 dark:text-gray-100">Free Plan</h3>
          <p className="text-2xl text-gray-700 dark:text-gray-100">$0</p>
        </div>
        <ul className="mt-4 list-inside list-disc text-xs text-gray-700 dark:text-gray-100">
          <li>100 submissions / month</li>
          <li>Community support</li>
          <li>Waitlist</li>
        </ul>
      </div>
      <div className="rounded-lg bg-slate-100 p-6 dark:bg-slate-700">
        <div className="flex justify-between">
          <h3 className="text-3xl font-bold text-gray-700 dark:text-gray-100">Free Plan</h3>
          <p className="text-2xl text-gray-700 dark:text-gray-100">
            $49 <span className="line-through">$99</span>
          </p>
        </div>
        <p className="flex justify-end text-xs text-gray-700 dark:text-gray-100">/ month</p>
        <ul className="mt-4 list-inside list-disc text-xs text-gray-700 dark:text-gray-100">
          <li>Unlimited submissions</li>
          <li>Founder onboarding</li>
          <li>Own support channel</li>
          <li className="font-bold">Skip waitlist</li>
        </ul>
        <div className="mt-5 flex flex-row justify-end">
          <Button>Become Early Bird</Button>
        </div>
        <div className="mt-2 flex flex-row justify-end">
          <p className="text-xs text-gray-700 dark:text-gray-100">Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}
