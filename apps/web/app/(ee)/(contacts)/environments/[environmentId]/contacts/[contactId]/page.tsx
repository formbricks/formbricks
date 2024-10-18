import { AttributesSection } from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/[contactId]/components/attributes-section";
import { DeleteContactButton } from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/[contactId]/components/delete-contact-button";
import {
  getContact,
  getContactAttributes,
} from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/lib/contacts";
import { getContactIdentifier } from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getContactAttributeKeys } from "@formbricks/lib/services/contact-attribute-keys";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { ResponseSection } from "./components/response-section";

const Page = async ({ params }: { params: { environmentId: string; contactId: string } }) => {
  const [environment, environmentTags, product, session, organization, contact, attributeKeys, attributes] =
    await Promise.all([
      getEnvironment(params.environmentId),
      getTagsByEnvironmentId(params.environmentId),
      getProductByEnvironmentId(params.environmentId),
      getServerSession(authOptions),
      getOrganizationByEnvironmentId(params.environmentId),
      getContact(params.contactId),
      getContactAttributeKeys(params.environmentId),
      getContactAttributes(params.contactId),
    ]);

  if (!product) {
    throw new Error("Product not found");
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!session) {
    throw new Error("Session not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!contact) {
    throw new Error("Contact not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  const getDeletePersonButton = () => {
    return (
      <DeleteContactButton environmentId={environment.id} contactId={params.contactId} isViewer={isViewer} />
    );
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={getContactIdentifier(attributes)} cta={getDeletePersonButton()} />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-4">
          <AttributesSection contactId={params.contactId} />
          <ResponseSection
            environment={environment}
            contactId={params.contactId}
            environmentTags={environmentTags}
            contactAttributeKeys={attributeKeys}
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};

export default Page;
