import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@formbricks/lib/cn";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const LoadingCard = ({ title, description, skeletonLines }) => {
  return (
    <SettingsCard title={title} description={description}>
      <div className="w-full space-y-4">
        {skeletonLines.map((line, index) => (
          <div key={index}>
            <div className={cn("animate-pulse rounded-full bg-slate-200", line.classes)}></div>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
};

const Loading = () => {
  const cards = [
    {
      title: "Email alerts (Surveys)",
      description: "Set up an alert to get an email on new responses.",
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-10 w-128" }, { classes: "h-10 w-128" }],
    },
    {
      title: "Weekly summary (Products)",
      description: "Stay up-to-date with a Weekly every Monday.",
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-10 w-128" }, { classes: "h-10 w-128" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Account Settings">
        <AccountSettingsNavbar activeId="notifications" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
