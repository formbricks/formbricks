import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import type { TV3SurveyDocument } from "./schemas";

export type TV3SurveyLanguageRequest = {
  code: string;
  default: boolean;
  enabled: boolean;
};

const languageSelect = {
  id: true,
  code: true,
  alias: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LanguageSelect;

export function deriveV3SurveyLanguageRequests(input: TV3SurveyDocument): TV3SurveyLanguageRequest[] {
  const requestedLanguages = new Map<string, TV3SurveyLanguageRequest>();
  const addLanguage = (code: string, enabled = true): void => {
    requestedLanguages.set(code, {
      code,
      default: code.toLowerCase() === input.defaultLanguage.toLowerCase(),
      enabled: code.toLowerCase() === input.defaultLanguage.toLowerCase() ? true : enabled,
    });
  };

  addLanguage(input.defaultLanguage);

  input.languages.forEach((language) => {
    addLanguage(language.code, language.enabled);
  });

  return Array.from(requestedLanguages.values()).sort((left, right) => {
    if (left.default) return -1;
    if (right.default) return 1;
    return left.code.localeCompare(right.code);
  });
}

export async function ensureV3WorkspaceLanguages(
  workspaceId: string,
  languageRequests: TV3SurveyLanguageRequest[],
  requestId?: string
): Promise<TSurveyLanguage[]> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const languages = await Promise.all(
      languageRequests.map((languageRequest) =>
        prisma.language.upsert({
          where: {
            workspaceId_code: {
              workspaceId,
              code: languageRequest.code,
            },
          },
          update: {},
          create: {
            workspaceId,
            code: languageRequest.code,
            alias: null,
          },
          select: languageSelect,
        })
      )
    );
    const languageByCode = new Map(languages.map((language) => [language.code.toLowerCase(), language]));

    return languageRequests.map((languageRequest) => {
      const language = languageByCode.get(languageRequest.code.toLowerCase());

      if (!language) {
        throw new DatabaseError(`Failed to resolve language '${languageRequest.code}'`);
      }

      return {
        language,
        default: languageRequest.default,
        enabled: languageRequest.enabled,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      log.error({ error }, "Error creating workspace languages for v3 survey write");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
}
