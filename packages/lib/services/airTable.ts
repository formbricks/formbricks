import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { TAirTableIntegration, TAirtable } from "@formbricks/types/v1/integrations";
import { cache } from "react";
import { DatabaseError } from "@formbricks/types/v1/errors";
import * as z from "zod";

export const connectAirtable = async (environmentId: string, key: string) => {
  const type: TAirTableIntegration["type"] = "airtable";

  const baseData: Pick<TAirTableIntegration, "type" | "config"> = {
    type,
    config: { data: [], key },
  };

  await prisma.integration.upsert({
    where: {
      type_environmentId: {
        environmentId,
        type,
      },
    },
    update: {
      ...baseData,
      environment: { connect: { id: environmentId } },
    },
    create: {
      ...baseData,
      environment: { connect: { id: environmentId } },
    },
  });
};

function isAirtableIntegration(integration: any): integration is TAirTableIntegration {
  const type: TAirTableIntegration["type"] = "airtable";
  return integration.type === type;
}

export const findAirtableIntegration = async (
  environmentId: string
): Promise<TAirTableIntegration | null> => {
  const type: TAirTableIntegration["type"] = "airtable";
  try {
    const result = await prisma.integration.findUnique({
      where: {
        type_environmentId: {
          environmentId,
          type,
        },
      },
    });
    // Type Guard
    if (result && isAirtableIntegration(result)) {
      return result as TAirTableIntegration; // Explicit casting
    }
    return null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};

export const getAirtableIntegration = cache(findAirtableIntegration);

const ZBases = z.object({
  bases: z.array(z.object({ id: z.string(), name: z.string() })),
});

const ZTables = z.object({
  tables: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type TAirtableTables = z.infer<typeof ZTables>;

export const getBases = async (key: string) => {
  const req = await fetch("https://api.airtable.com/v0/meta/bases", {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const res = await req.json();

  return ZBases.parse(res);
};

export const getTables = async (key: string, baseId: string) => {
  const req = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const res = await req.json();

  return ZTables.parse(res);
};

export const getAirtableTables = async (environmentId: string) => {
  let tables: TAirtable[] = [];
  try {
    const airTableIntegration = await getAirtableIntegration(environmentId);

    if (airTableIntegration && airTableIntegration.config?.key) {
      tables = (await getBases(airTableIntegration.config.key)).bases;
    }
    return tables;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};
