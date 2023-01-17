import { SurveyElement } from "./engineTypes";

export default function ThankYouHeading({ element }: { element: SurveyElement }) {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-gray-700 dark:text-gray-100">
        Thank you! We’re onboarding new users regularly!
      </h2>
    </div>
  );
}
