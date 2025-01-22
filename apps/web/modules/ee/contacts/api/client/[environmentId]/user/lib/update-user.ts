import { contactCache } from "@/lib/cache/contact";
import { updateAttributes } from "@/modules/ee/contacts/api/client/[environmentId]/contacts/[userId]/attributes/lib/attributes";
import { getUserState } from "./user-state";

export const updateUser = async (
  environmentId: string,
  userId: string,
  device: "phone" | "desktop",
  attributes?: Record<string, string>
) => {
  const userState = await getUserState({
    environmentId,
    userId,
    device,
    attributes,
  });

  if (userState.revalidateProps?.revalidate) {
    contactCache.revalidate({
      environmentId,
      userId,
      id: userState.revalidateProps.contactId,
    });
  }

  let messages: string[] = [];

  if (attributes && Object.keys(attributes).length > 0 && userState.attributesInfo.shouldUpdate) {
    const { messages: updateAttrMessages } = await updateAttributes(
      userState.attributesInfo.contactId,
      userId,
      environmentId,
      attributes
    );

    messages = updateAttrMessages ?? [];
  }

  return {
    personState: userState,
    messages,
  };
};
