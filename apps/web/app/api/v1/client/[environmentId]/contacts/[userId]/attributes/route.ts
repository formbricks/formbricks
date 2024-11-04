import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { getIsContactsEnabled } from "@formbricks/ee/lib/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsContactsUpdateAttributeInput } from "@formbricks/types/js";
import { updateAttributes } from "./lib/attributes";

export const OPTIONS = async () => {
  // cors headers
  return responses.successResponse({}, true);
};

export const PUT = async (
  req: NextRequest,
  context: { params: { environmentId: string; userId: string } }
) => {
  try {
    const environmentId = context.params.environmentId;
    if (!environmentId) {
      return responses.badRequestResponse("environmentId is required", { environmentId }, true);
    }

    const userId = context.params.userId;
    if (!userId) {
      return responses.badRequestResponse("userId is required", { userId }, true);
    }

    const jsonInput = await req.json();

    const parsedInput = ZJsContactsUpdateAttributeInput.safeParse(jsonInput);
    if (!parsedInput.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(parsedInput.error),
        true
      );
    }

    // check for ee license:
    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }

    const { userId: userIdAttr, ...updatedAttributes } = parsedInput.data.attributes;

    let contact = await prisma.contact.findFirst({
      where: {
        environmentId,
        attributes: { some: { attributeKey: { key: "userId", environmentId }, value: userId } },
      },
      select: { id: true, attributes: { select: { attributeKey: { select: { key: true } }, value: true } } },
    });

    if (!contact) {
      // return responses.notFoundResponse("PersonByUserId", userId, true);
      // HOTFIX: create person if not found to work around caching issue
      contact = await prisma.contact.create({
        data: {
          environmentId,
          attributes: {
            create: [
              {
                attributeKey: {
                  connect: {
                    key_environmentId: {
                      key: "userId",
                      environmentId,
                    },
                  },
                },
                value: userId,
              },
            ],
          },
        },
        select: {
          id: true,
          attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
        },
      });
    }

    const oldAttributes = contact.attributes.reduce(
      (acc, attr) => {
        acc[attr.attributeKey.key] = attr.value;
        return acc;
      },
      {} as Record<string, string>
    );

    let isUpToDate = true;
    for (const key in updatedAttributes) {
      if (updatedAttributes[key] !== oldAttributes[key]) {
        isUpToDate = false;
        break;
      }
    }

    if (isUpToDate) {
      return responses.successResponse(
        {
          changed: false,
          message: "No updates were necessary; the person is already up to date.",
        },
        true
      );
    }

    await updateAttributes(contact.id, userId, environmentId, updatedAttributes);

    return responses.successResponse(
      {
        changed: true,
        message: "The person was successfully updated.",
      },
      true
    );
  } catch (err) {
    console.error(err);
    if (err.statusCode === 403) {
      return responses.forbiddenResponse(err.message || "Forbidden", true, { ignore: true });
    }

    if (err instanceof ResourceNotFoundError) {
      return responses.notFoundResponse(err.resourceType, err.resourceId, true);
    }

    return responses.internalServerErrorResponse("Something went wrong", true);
  }
};
