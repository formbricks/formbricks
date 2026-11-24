import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { getSurvey } from "@/lib/survey/service";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { validateInputs } from "@/lib/utils/validate";
import {
  whereContactsOfWorkspace,
  withCreatingOrCallerWorkspace,
} from "@/modules/ee/contacts/lib/contact-directory";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import {
  SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE,
  SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
} from "@/modules/ee/contacts/lib/personal-link-errors";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { segmentFiltersReadHiddenSurvey } from "@/modules/ee/contacts/segments/lib/helper";
import { getSegment, isSegmentOfWorkspace } from "@/modules/ee/contacts/segments/lib/segments";
import { TContact } from "../types/contact";

export const getContactsInSegment = reactCache(async (segmentId: string, workspaceId: string) => {
  try {
    const segment = await getSegment(segmentId);

    // A segment is evaluated against the contacts of its own directory (decision 24).
    if (!segment?.directoryId) {
      return null;
    }

    const segmentFilterToPrismaQueryResult = await segmentFilterToPrismaQuery(
      segment.id,
      segment.filters,
      segment.directoryId,
      workspaceId
    );

    if (!segmentFilterToPrismaQueryResult.ok) {
      return null;
    }

    const { whereClause } = segmentFilterToPrismaQueryResult.data;

    const requiredAttributes = ["userId", "firstName", "lastName", "email"];

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: requiredAttributes,
              },
            },
          },
          select: {
            attributeKey: {
              select: {
                key: true,
              },
            },
            value: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const contactsWithAttributes = contacts.map((contact) => {
      const attributes = contact.attributes.reduce(
        (acc, attr) => {
          acc[attr.attributeKey.key] = attr.value;
          return acc;
        },
        {} as Record<string, string>
      );
      return {
        contactId: contact.id,
        attributes,
      };
    });

    return contactsWithAttributes;
  } catch (error) {
    logger.error(error, "Failed to get contacts in segment");
    return null;
  }
});

const selectContact = {
  id: true,
  createdAt: true,
  updatedAt: true,
  workspaceId: true,
  attributes: {
    select: {
      value: true,
      valueNumber: true,
      valueDate: true,
      attributeKey: {
        select: {
          key: true,
          name: true,
          dataType: true,
        },
      },
    },
  },
} satisfies Prisma.ContactSelect;

export const buildContactWhereClause = (workspaceId: string, search?: string): Prisma.ContactWhereInput => {
  const whereClause: Prisma.ContactWhereInput = { ...whereContactsOfWorkspace(workspaceId) };

  if (search) {
    whereClause.OR = [
      {
        attributes: {
          some: {
            value: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        id: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  return whereClause;
};

/**
 * The contact, when it is in the workspace's contact directory; null otherwise, so a caller holding an
 * authorized workspace id cannot read a contact of another directory.
 */
export const getContactInWorkspace = reactCache(
  async (contactId: string, workspaceId: string): Promise<TContact | null> => {
    validateInputs([contactId, ZId], [workspaceId, ZId]);

    try {
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          ...whereContactsOfWorkspace(workspaceId),
        },
        select: selectContact,
      });
      return contact ? withCreatingOrCallerWorkspace(contact, workspaceId) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

/** Shown by the APIs; the Contacts page translates {@link CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE} instead. */
export const CONTACT_IN_SHARED_DIRECTORY_MESSAGE =
  "This contact is in a contact directory that other workspaces use, so it can't be deleted.";

/** Deleting the contact would also delete its responses and displays in the other workspaces. */
export class ContactInSharedDirectoryError extends OperationNotAllowedError {
  constructor() {
    super(CONTACT_IN_SHARED_DIRECTORY_MESSAGE);
  }
}

/**
 * Deletes a contact of the workspace's contact directory (decision 9). Refused with
 * {@link ContactInSharedDirectoryError} when another workspace uses the directory too, and with
 * `ResourceNotFoundError` when the contact is not in the directory. The share check is part of the
 * delete itself, so a workspace joining the directory meanwhile cannot slip past it.
 */
export const deleteContactInWorkspace = async (contactId: string, workspaceId: string): Promise<TContact> => {
  validateInputs([contactId, ZId], [workspaceId, ZId]);

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ...whereContactsOfWorkspace(workspaceId) },
      select: selectContact,
    });
    if (!contact) {
      throw new ResourceNotFoundError("contact", contactId);
    }

    const { count } = await prisma.contact.deleteMany({
      where: {
        id: contactId,
        directory: { workspaces: { some: { id: workspaceId }, every: { id: workspaceId } } },
      },
    });
    if (count === 0) {
      throw new ContactInSharedDirectoryError();
    }

    return withCreatingOrCallerWorkspace(contact, workspaceId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * Personal links to `surveyId` for every contact in `segmentId`, as `actor` asks for them. The list
 * says who is in the segment, so `actor` must be allowed to evaluate its filters (ENG-6870).
 */
export const generatePersonalLinks = async (
  surveyId: string,
  segmentId: string,
  actor: TSurveyActorContext,
  expirationDays?: number
) => {
  const survey = await getSurvey(surveyId);

  if (!survey) {
    return null;
  }

  // Cross-tenant guard: the segment must belong to the directory of the workspace
  // of the survey the caller is authorized against (decision 24: every workspace
  // on a directory shares its segments). Without this, a caller with access to
  // `surveyId`'s workspace could pass a `segmentId` from another directory and
  // exfiltrate its contact PII. Mirrors the v2 management API
  // (contact-links/segments) which rejects the same mismatch. The message is a
  // stable error code the client maps to a localized string.
  const segment = await getSegment(segmentId);

  if (!segment) {
    return null;
  }

  if (!(await isSegmentOfWorkspace(segment, survey.workspaceId))) {
    throw new ValidationError(SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE);
  }

  // Survey-visibility guard (ENG-6870): the contacts a survey-interaction filter matches are the people
  // who saw, started or completed the surveys it reads, so the caller must see every one of them.
  if (await segmentFiltersReadHiddenSurvey(segment.filters, survey.workspaceId, actor, segment.id)) {
    throw new ValidationError(SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE);
  }

  const contactsResult = await getContactsInSegment(segmentId, survey.workspaceId);

  if (!contactsResult) {
    return null;
  }

  // Generate survey links for each contact
  const contactLinks = await Promise.all(
    contactsResult.map(async (contact) => {
      const { contactId, attributes } = contact;

      const surveyUrlResult = await getContactSurveyLink(contactId, surveyId, expirationDays);

      if (!surveyUrlResult.ok) {
        logger.error(
          { error: surveyUrlResult.error, contactId: contactId, surveyId: surveyId },
          "Failed to generate survey URL for contact"
        );
        return null;
      }

      return {
        contactId,
        attributes,
        surveyUrl: surveyUrlResult.data,
        expirationDays,
      };
    })
  );

  const filteredContactLinks = contactLinks.filter(Boolean);
  return filteredContactLinks;
};
