import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { DatabaseError, ResourceNotFoundError, UniqueConstraintError } from "@formbricks/types/errors";
import { TSurveyStatus } from "@formbricks/types/surveys/types";

export interface TSurveyBySlug {
  id: string;
  environmentId: string;
  status: string;
}

export interface TSurveyWithSlug {
  id: string;
  name: string;
  slug: string | null;
  status: TSurveyStatus;
  createdAt: Date;
  environment: {
    id: string;
    type: "production" | "development";
    project: {
      id: string;
      name: string;
    };
  };
}

// Find a survey by its slug
export const getSurveyBySlug = reactCache(
  async (slug: string): Promise<Result<TSurveyBySlug | null, DatabaseError>> => {
    try {
      const survey = await prisma.survey.findUnique({
        where: { slug },
        select: { id: true, environmentId: true, status: true },
      });
      return ok(survey);
    } catch (error) {
      return err(new DatabaseError(error.message));
    }
  }
);

// Check if a slug is available (for validation)
export const isSlugAvailable = async (
  slug: string,
  excludeSurveyId?: string
): Promise<Result<boolean, DatabaseError>> => {
  try {
    const existing = await prisma.survey.findUnique({
      where: { slug },
      select: { id: true },
    });
    return ok(!existing || existing.id === excludeSurveyId);
  } catch (error) {
    return err(new DatabaseError(error.message));
  }
};

// Update a survey's slug
export const updateSurveySlug = async (
  surveyId: string,
  slug: string | null
): Promise<
  Result<{ id: string; slug: string | null }, UniqueConstraintError | DatabaseError | ResourceNotFoundError>
> => {
  try {
    const result = await prisma.survey.update({
      where: { id: surveyId },
      data: { slug },
      select: { id: true, slug: true },
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return err(new UniqueConstraintError("Survey with this slug already exists"));
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return err(new ResourceNotFoundError("Survey", surveyId));
    }

    return err(new DatabaseError(error.message));
  }
};

// Get all surveys with slugs for an organization (for Domain settings page)
export const getSurveysWithSlugsByOrganization = reactCache(
  async (organizationId: string): Promise<Result<TSurveyWithSlug[], DatabaseError>> => {
    try {
      const surveys = (await prisma.survey.findMany({
        where: {
          slug: { not: null },
          environment: {
            project: { organizationId },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          environment: {
            select: {
              id: true,
              type: true,
              project: {
                select: { id: true, name: true },
              },
            },
          },
        },
      })) as TSurveyWithSlug[];
      return ok(surveys);
    } catch (error) {
      return err(new DatabaseError(error.message));
    }
  }
);
