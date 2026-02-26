import "server-only";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TSurveyResultShareLink,
  TSurveyResultShareLinkExpiresIn,
} from "@formbricks/types/survey-result-share-link";
import { TSurveySummary } from "@formbricks/types/surveys/types";
import { createResultShareToken, verifyResultShareToken } from "@/lib/jwt";

const MAX_ACTIVE_LINKS_PER_SURVEY = 5;

const getExpirationDate = (expiresIn: TSurveyResultShareLinkExpiresIn): Date | null => {
  if (expiresIn === "never") return null;

  const now = new Date();
  const daysMap: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const days = daysMap[expiresIn];
  if (!days) return null;

  now.setDate(now.getDate() + days);
  return now;
};

export const createSurveyResultShareLink = async (
  surveyId: string,
  userId: string,
  expiresIn: TSurveyResultShareLinkExpiresIn = "never",
  label?: string
): Promise<TSurveyResultShareLink> => {
  // Check max active links limit
  const activeLinksCount = await prisma.surveyResultShareLink.count({
    where: {
      surveyId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (activeLinksCount >= MAX_ACTIVE_LINKS_PER_SURVEY) {
    throw new OperationNotAllowedError(
      `Maximum of ${MAX_ACTIVE_LINKS_PER_SURVEY} active share links per survey reached. Please revoke an existing link first.`
    );
  }

  const expiresAt = getExpirationDate(expiresIn);

  // Create the DB record first to get the ID
  const link = await prisma.surveyResultShareLink.create({
    data: {
      surveyId,
      token: "", // Placeholder — will be updated with signed token
      label: label || null,
      expiresAt,
      createdById: userId,
    },
  });

  // Generate signed JWT with the link ID
  const token = createResultShareToken(link.id, surveyId);

  // Update with actual token
  const updatedLink = await prisma.surveyResultShareLink.update({
    where: { id: link.id },
    data: { token },
  });

  return updatedLink;
};

export const getSurveyResultShareLinks = async (surveyId: string): Promise<TSurveyResultShareLink[]> => {
  const links = await prisma.surveyResultShareLink.findMany({
    where: { surveyId },
    orderBy: { createdAt: "desc" },
  });

  return links;
};

export const revokeSurveyResultShareLink = async (linkId: string): Promise<TSurveyResultShareLink> => {
  const link = await prisma.surveyResultShareLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new ResourceNotFoundError("SurveyResultShareLink", linkId);
  }

  if (link.revokedAt) {
    throw new OperationNotAllowedError("This share link has already been revoked.");
  }

  const updatedLink = await prisma.surveyResultShareLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  });

  return updatedLink;
};

export const validateShareLink = async (
  token: string
): Promise<{ linkId: string; surveyId: string } | null> => {
  // 1. Verify JWT signature
  const payload = verifyResultShareToken(token);
  if (!payload) {
    return null;
  }

  // 2. Check DB for revocation and expiration (no caching — must be real-time)
  const link = await prisma.surveyResultShareLink.findUnique({
    where: { id: payload.linkId, token },
  });

  if (!link) {
    return null;
  }

  // Check revocation
  if (link.revokedAt) {
    return null;
  }

  // Check expiration
  if (link.expiresAt && link.expiresAt < new Date()) {
    return null;
  }

  return { linkId: link.id, surveyId: link.surveyId };
};

export const stripPiiFromSummary = (summary: TSurveySummary): TSurveySummary => {
  const strippedSummary = summary.summary.map((elementSummary) => {
    // Strip contact data from samples/files in OpenText, Date, FileUpload, Address, ContactInfo, HiddenFields
    if ("samples" in elementSummary && Array.isArray(elementSummary.samples)) {
      return {
        ...elementSummary,
        samples: elementSummary.samples.map((sample: Record<string, unknown>) => ({
          ...sample,
          contact: null,
          contactAttributes: {},
        })),
      };
    }

    if ("files" in elementSummary && Array.isArray(elementSummary.files)) {
      return {
        ...elementSummary,
        files: elementSummary.files.map((file: Record<string, unknown>) => ({
          ...file,
          contact: null,
          contactAttributes: {},
        })),
      };
    }

    // Strip contact data from MultipleChoice "others"
    if ("choices" in elementSummary && Array.isArray(elementSummary.choices)) {
      return {
        ...elementSummary,
        choices: elementSummary.choices.map((choice: Record<string, unknown>) => {
          if ("others" in choice && Array.isArray(choice.others)) {
            return {
              ...choice,
              others: choice.others.map((other: Record<string, unknown>) => ({
                ...other,
                contact: null,
                contactAttributes: {},
              })),
            };
          }
          return choice;
        }),
      };
    }

    return elementSummary;
  });

  return {
    meta: summary.meta,
    dropOff: summary.dropOff,
    summary: strippedSummary as TSurveySummary["summary"],
    quotas: [], // Exclude quotas from public view
  };
};
