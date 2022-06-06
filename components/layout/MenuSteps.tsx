import Link from "next/link";
import { useRouter } from "next/router";
import { useForm } from "../../lib/forms";
import { Form } from "../../lib/types";
import { classNames } from "../../lib/utils";

type MenuStepsProps = {
  formId: string;
  currentStep: "build" | "share" | "results";
};

export default function MenuSteps({ formId, currentStep }: MenuStepsProps) {
  const { form, isLoadingForm, mutateForm } = useForm(formId);
  const router = useRouter();
  const tabs = [
    {
      name: "Results",
      id: "results",
      href: `/forms/${form.id}/results`,
    },
  ];

  if (isLoadingForm) {
    return <div />;
  }
  return (
    <div className="flex items-center flex-1 justify-left sm:justify-center">
      <div className="w-full sm:hidden">
        <label htmlFor="tabs" className="sr-only">
          Select a view
        </label>
        <select
          id="tabs"
          name="tabs"
          className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
          defaultValue={tabs.find((tab) => tab.id === currentStep).name}
          onChange={(e) => {
            const stepId = e.target.children[e.target.selectedIndex].id;
            router.push(`/forms/${form.id}/${stepId}`);
          }}
        >
          {tabs.map((tab) => (
            <option key={tab.name} id={tab.id}>
              {tab.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <nav className="flex -mb-px space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link key={tab.name} href={tab.href}>
              <a
                className={classNames(
                  tab.id === currentStep
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                  "whitespace-nowrap py-5 px-1 border-b-2 font-medium text-sm"
                )}
                aria-current={tab.id === currentStep ? "page" : undefined}
              >
                {tab.name}
              </a>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
