import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  const cards = [
    {
      title: "Personal information",
      description: "Update your personal information",
      skeletonLines: [
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
      ],
    },
    {
      title: "Avatar",
      description: "Assist your organization in identifying you on Formbricks.",
      skeletonLines: [{ classes: "h-10 w-10" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Security",
      description: "Manage your password and other security settings.",
      skeletonLines: [{ classes: "h-4 w-60" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Delete account",
      description: "Delete your account with all of your personal information and data.",
      skeletonLines: [{ classes: "h-4 w-60" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Account Settings">
        <AccountSettingsNavbar activeId="profile" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
