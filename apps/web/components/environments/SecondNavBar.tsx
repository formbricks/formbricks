import { cn } from "@formbricks/lib/cn";
import SurveyNavBarName from "@/components/shared/SurveyNavBarName";
import Link from "next/link";
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
      <div className="grid h-14 w-full grid-cols-3 items-center justify-items-stretch border-b bg-white px-4">
        <div className="justify-self-start">
          {survey && environmentId && (
            <SurveyNavBarName surveyName={survey.name} productName={product.name} />
          )}
        </div>{" "}
        <nav className="flex h-full items-center space-x-4 justify-self-center" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                tab.id === activeId
                  ? " border-brand-dark border-b-2 font-semibold text-slate-900"
                  : "text-slate-500 hover:text-slate-700",
                "flex h-full items-center px-3 text-sm font-medium"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.icon && <div className="mr-2 h-5 w-5">{tab.icon}</div>}
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="justify-self-end"></div>
      </div>
    </div>
  );
}
