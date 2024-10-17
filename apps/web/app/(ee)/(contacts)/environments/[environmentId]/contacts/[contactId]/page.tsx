import { AttributesSection } from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/[contactId]/components/AttributesSection";
import { getContact } from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/lib/contacts";
import { getServerSession } from "next-auth";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getPerson } from "@formbricks/lib/person/service";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const [
    environment,
    environmentTags,
    product,
    session,
    organization,
    person,
    // attributes, attributeClasses
  ] = await Promise.all([
    getEnvironment(params.environmentId),
    getTagsByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
    getContact(params.contactId),
    // getAttributes(params.contactId),
    // getAttributeClasses(params.environmentId),
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

  if (!person) {
    throw new Error("Person not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  // const getDeletePersonButton = () => {
  //   return (
  //     <DeletePersonButton environmentId={environment.id} personId={params.contactId} isViewer={isViewer} />
  //   );
  // };

  return (
    <PageContentWrapper>
      {/* <PageHeader pageTitle={getPersonIdentifier(person, attributes)} cta={getDeletePersonButton()} /> */}
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-4">
          <AttributesSection contactId={params.contactId} />
          {/* <ResponseSection
            environment={environment}
            personId={params.contactId}
            environmentTags={environmentTags}
            attributeClasses={attributeClasses}
          /> */}
        </div>
      </section>
    </PageContentWrapper>
  );
};

export default Page;
