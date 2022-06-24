import Link from "next/link";
import { useRouter } from "next/router";
import { classNames } from "../../lib/utils";

interface Step {
  id: string;
  name: string;
  href: string;
}

type MenuStepsProps = {
  steps: Step[];
  currentStep: string;
};

export default function MenuSteps({ steps, currentStep }: MenuStepsProps) {
  const router = useRouter();
  return (
    <div className="flex items-center flex-1 justify-left sm:justify-center">
      <div className="w-full sm:hidden">
        <label htmlFor="steps" className="sr-only">
          Select a view
        </label>
        <select
          id="steps"
          name="steps"
          className="block w-full py-2 pl-3 pr-10 text-base rounded-md border-ui-gray-medium focus:outline-none focus:ring-red focus:border-red sm:text-sm"
          defaultValue={steps.find((step) => step.id === currentStep).name}
          onChange={(e) => {
            const stepId = e.target.children[e.target.selectedIndex].id;
            router.push(steps.find((s) => s.id === stepId).href);
          }}
        >
          {steps.map((step) => (
            <option key={step.name} id={step.id}>
              {step.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <nav className="flex -mb-px space-x-8" aria-label="steps">
          {steps.map((step) => (
            <Link key={step.name} href={step.href}>
              <a
                className={classNames(
                  step.id === currentStep
                    ? "border-red text-red"
                    : "border-transparent text-ui-gray-dark hover:text-ui-gray-dark hover:border-ui-gray-medium",
                  "whitespace-nowrap py-5 px-1 border-b-2 font-medium text-sm"
                )}
                aria-current={step.id === currentStep ? "page" : undefined}
              >
                {step.name}
              </a>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
