import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
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
export const getSurveyBySlug = reactCache(async (slug: string): Promise<TSurveyBySlug | null> => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { slug },
      select: { id: true, environmentId: true, status: true },
    });
    return survey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

// Update a survey's slug
export const updateSurveySlug = async (
  surveyId: string,
  slug: string | null
): Promise<{ id: string; slug: string | null }> => {
  try {
    const result = await prisma.survey.update({
      where: { id: surveyId },
      data: { slug },
      select: { id: true, slug: true },
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InvalidInputError("A survey with this slug already exists");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

// Get all surveys with slugs for an organization (for Domain settings page)
export const getSurveysWithSlugsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TSurveyWithSlug[]> => {
    try {
      const surveys = await prisma.survey.findMany({
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
      });
      return surveys;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
