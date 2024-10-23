import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const cards = [
  {
    title: "Manage members",
    description: "Add or remove members in your organization.",
    skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }, { classes: "h-8 w-80" }],
  },
  {
    title: "Organization Name",
    description: "Give your organization a descriptive name.",
    skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
  },
  {
    title: "Delete Organization",
    description:
      "Delete organization with all its products including all surveys, responses, people, actions and attributes",
    skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
  },
];

const Loading = () => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Organization Settings">
        <OrganizationSettingsNavbar isFormbricksCloud={IS_FORMBRICKS_CLOUD} activeId="general" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
