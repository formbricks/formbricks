import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/SegmentTable";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getContactAttributeKeys } from "@formbricks/lib/services/contact-attribute-keys";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { CreateSegmentModal } from "./components/create-segment-modal";

export const SegmentsPage = async ({ params }: { params: { environmentId: string } }) => {
  const [environment, segments, contactAttributeKeys, organization] = await Promise.all([
    getEnvironment(params.environmentId),
    getSegments(params.environmentId),
    getContactAttributeKeys(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAdvancedTargetingAllowed = await getAdvancedTargetingPermission(organization);

  if (!isAdvancedTargetingAllowed) {
    throw new Error("Advanced targeting is not allowed");
  }

  if (!segments) {
    throw new Error("Failed to fetch segments");
  }

  const filteredSegments = segments.filter((segment) => !segment.isPrivate);

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle="Contacts"
        cta={
          <CreateSegmentModal
            environmentId={params.environmentId}
            contactAttributeKeys={contactAttributeKeys}
            segments={filteredSegments}
          />
        }>
        <ContactsSecondaryNavigation activeId="segments" environmentId={params.environmentId} />
      </PageHeader>
      <SegmentTable
        segments={filteredSegments}
        contactAttributeKeys={contactAttributeKeys}
        isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
      />
    </PageContentWrapper>
  );
};
