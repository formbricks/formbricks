import { SurveyElement } from "./engineTypes";

export default function ThankYouHeading({ element }: { element: SurveyElement }) {
  return (
    <div className="text-center">
      <h2 className="mt-3 text-3xl font-bold text-gray-700 dark:text-gray-100">
        We’re onboarding new users <span className="text-brand">regularly!</span>
      </h2>
      <p className="mt-4 text-gray-700 dark:text-gray-100">
        Thank you for signing up. We will be in touch shortly.
      </p>
    </div>
  );
}
