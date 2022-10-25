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
    <div className="justify-left flex flex-1 items-center sm:justify-center">
      <div className="w-full sm:hidden">
        <label htmlFor="steps" className="sr-only">
          Select a view
        </label>
        <select
          id="steps"
          name="steps"
          className="border-ui-gray-medium focus:ring-red focus:border-red block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm"
          defaultValue={steps.find((step) => step.id === currentStep).name}
          onChange={(e) => {
            const stepId = e.target.children[e.target.selectedIndex].id;
            router.push(steps.find((s) => s.id === stepId).href);
          }}>
          {steps.map((step) => (
            <option key={step.name} id={step.id}>
              {step.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <nav className="-mb-px flex space-x-8" aria-label="steps">
          {steps.map((step) => (
            (<Link
              key={step.name}
              href={step.href}
              className={classNames(
                step.id === currentStep
                  ? "border-red text-red"
                  : "text-ui-gray-dark hover:text-ui-gray-dark hover:border-ui-gray-medium border-transparent",
                "whitespace-nowrap border-b-2 py-5 px-1 text-sm font-medium"
              )}
              aria-current={step.id === currentStep ? "page" : undefined}>

              {step.name}

            </Link>)
          ))}
        </nav>
      </div>
    </div>
  );
}
