import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { TAirTableIntegration, TAirtable, TZAirTableConfigData } from "@formbricks/types/v1/integrations";
import { cache } from "react";
import { DatabaseError } from "@formbricks/types/v1/errors";
import * as z from "zod";

export const connectAirtable = async (environmentId: string, key: string, email: string) => {
  const type: TAirTableIntegration["type"] = "airtable";

  const baseData: Pick<TAirTableIntegration, "type" | "config"> = {
    type,
    config: { data: [], key, email },
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

const ZTablesWithFields = z.object({
  tables: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fields: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      ),
    })
  ),
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

const tableFetcher = async (key: string, baseId: string) => {
  const req = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const res = await req.json();

  return res;
};

export const getTables = async (key: string, baseId: string) => {
  const res = await tableFetcher(key, baseId);

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

const addRecords = async (key: string, baseId: string, tableId: string, data: Record<string, string>) => {
  const req = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      fields: data,
      typecast: true,
    }),
  });

  return await req.json();
};

const addField = async (key: string, baseId: string, tableId: string, data: Record<string, string>) => {
  const req = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return await req.json();
};

export const writeData = async (key: string, configData: TZAirTableConfigData, values: string[][]) => {
  try {
    const responses = values[0];
    const questions = values[1];

    const data: Record<string, string> = {};
    for (let i = 0; i < questions.length; i++) {
      data[questions[i]] = responses[i];
    }

    const req = await tableFetcher(key, configData.baseId);
    const tables = ZTablesWithFields.parse(req).tables;

    const currentTable = tables.find((table) => table.id === configData.tableId);
    if (currentTable) {
      const currentFields = new Set(currentTable.fields.map((field) => field.name));
      const fieldsToCreate = new Set<string>();
      for (const field of questions) {
        const hasField = currentFields.has(field);
        if (!hasField) {
          fieldsToCreate.add(field);
        }
      }

      if (fieldsToCreate.size > 0) {
        const createFieldPromise: Promise<any>[] = [];
        fieldsToCreate.forEach((fieldName) => {
          createFieldPromise.push(
            addField(key, configData.baseId, configData.tableId, {
              name: fieldName,
              type: "singleLineText",
            })
          );
        });

        await Promise.all(createFieldPromise);
      }
    }
    await addRecords(key, configData.baseId, configData.tableId, data);
  } catch (error) {
    console.error(error?.message);
  }
};
