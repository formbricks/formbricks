import Button from "../shared/Button";
import { SurveyElement } from "./engineTypes";
import { useRouter } from "next/router";

export default function ThankYouPlans({ element }: { element: SurveyElement }) {
  const router = useRouter();
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-lg p-6">
        <div className="flex justify-between text-xl sm:text-2xl">
          <h3 className="font-bold text-slate-500 dark:text-slate-100">Free Plan</h3>
          <p className="text-slate-700 dark:text-slate-100">$0</p>
        </div>
        <ul className="mt-4 list-inside list-disc text-xs text-slate-500 dark:text-slate-300">
          <li>100 submissions / month</li>
          <li>Community support</li>
          <li>Waitlist</li>
        </ul>
      </div>
      <div className="rounded-lg bg-slate-50 p-6 dark:bg-slate-700">
        <div className="flex justify-between text-xl sm:text-2xl">
          <h3 className="font-bold text-slate-500 dark:text-slate-100">Early Bird Plan</h3>
          <p className="text-slate-700 dark:text-slate-100">
            $49 <span className="line-through">$99</span>
          </p>
        </div>
        <p className="flex justify-end text-xs text-slate-500 dark:text-slate-300">/ Month</p>
        <ul className="mt-4 list-inside list-disc text-xs text-slate-500 dark:text-slate-300">
          <li>Unlimited submissions</li>
          <li>Founder onboarding</li>
          <li>Own support channel</li>
          <li className="font-bold">Skip waitlist</li>
        </ul>
        <div className="mt-5 flex flex-row justify-end">
          <Button
            type="button"
            target="_blank"
            onClick={() => router.push("https://buy.stripe.com/28o00R4GDf9qdfa5kp")}>
            Become Early Bird
          </Button>
        </div>
        <div className="mt-2 flex flex-row justify-end">
          <p className="text-xs text-slate-400 dark:text-slate-300">Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}
