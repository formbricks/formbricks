import Link from "next/link";

import { cn } from "@formbricks/lib/cn";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurvey } from "@formbricks/lib/survey/service";

interface SecondNavbarProps {
  tabs: { id: string; label: string; href: string; icon?: React.ReactNode }[];
  activeId: string;
  surveyId?: string;
  environmentId: string;
}

export default async function SecondNavbar({
  tabs,
  activeId,
  surveyId,
  environmentId,
  ...props
}: SecondNavbarProps) {
  const product = await getProductByEnvironmentId(environmentId!);
  if (!product) {
    throw new Error("Product not found");
  }

  let survey;
  if (surveyId) {
    survey = await getSurvey(surveyId);
  }

  return (
    <div {...props}>
      <div className="border-b">
        <nav className="flex h-full items-center space-x-1 justify-self-center" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                tab.id === activeId
                  ? " border-brand-dark rounded-t-md bg-slate-100 font-semibold text-slate-900"
                  : "rounded-t-md border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                "flex h-full items-center border-b-2 px-3 py-2 text-sm font-medium"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.icon && <div className="mr-2 h-5 w-5">{tab.icon}</div>}
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
