import { contactCache } from "@/lib/cache/contact";
import { updateAttributes } from "@/modules/ee/contacts/api/client/[environmentId]/contacts/[userId]/attributes/lib/attributes";
import { getPersonState } from "./personState";

export const updateContact = async (
  environmentId: string,
  userId: string,
  device: "phone" | "desktop",
  attributes?: Record<string, string>
) => {
  const personState = await getPersonState({
    environmentId,
    userId,
    device,
    attributes,
  });

  if (personState.revalidateProps?.revalidate) {
    contactCache.revalidate({
      environmentId,
      userId,
      id: personState.revalidateProps.contactId,
    });
  }

  let details: Record<string, string> = {};

  if (attributes && Object.keys(attributes).length > 0 && personState.attributesInfo.shouldUpdate) {
    const { details: updateAttrDetails } = await updateAttributes(
      personState.attributesInfo.contactId,
      userId,
      environmentId,
      attributes
    );

    details = updateAttrDetails ?? {};
  }

  return {
    personState,
    details,
  };
};
