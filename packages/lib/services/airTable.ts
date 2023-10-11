import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import {
  TAirTableIntegration,
  TAirtable,
  TAirtableCredential,
  TAirtableIntegrationInput,
  TZAirTableConfigData,
  ZAirtableCredential,
  ZAirtableTokenSchema,
} from "@formbricks/types/v1/integrations";
import { DatabaseError } from "@formbricks/types/v1/errors";
import * as z from "zod";
import { AIR_TABLE_CLIENT_ID } from "../constants";
import { createOrUpdateIntegration, deleteIntegration } from "../integration/service";

interface ConnectAirtableOptions {
  environmentId: string;
  key: TAirtableCredential;
  email: string;
}

export const connectAirtable = async ({ email, environmentId, key }: ConnectAirtableOptions) => {
  const type: TAirtableIntegrationInput["type"] = "airtable";

  const baseData: TAirtableIntegrationInput = {
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

export const fetchAirtableAuthToken = async (formData: Record<string, any>) => {
  const formBody = Object.keys(formData)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(formData[key])}`)
    .join("&");

  const tokenReq = await fetch("https://airtable.com/oauth2/v1/token", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody,
    method: "POST",
  });

  const tokenRes = await tokenReq.json();

  const { access_token, expires_in, refresh_token } = ZAirtableTokenSchema.parse(tokenRes);

  const expiry_date = new Date();
  expiry_date.setSeconds(expiry_date.getSeconds() + expires_in);

  return {
    access_token,
    expiry_date: expiry_date.toISOString(),
    refresh_token,
  };
};

export const getAirtableToken = async (environmentId: string) => {
  try {
    const airTableIntegration = await findAirtableIntegration(environmentId);

    const { access_token, expiry_date, refresh_token } = ZAirtableCredential.parse(
      airTableIntegration?.config.key
    );

    const expiryDate = new Date(expiry_date);
    const currentDate = new Date();

    if (currentDate >= expiryDate) {
      const client_id = AIR_TABLE_CLIENT_ID;

      const newToken = await fetchAirtableAuthToken({
        grant_type: "refresh_token",
        refresh_token,
        client_id,
      });

      await createOrUpdateIntegration(environmentId, {
        type: "airtable",
        config: {
          data: airTableIntegration?.config?.data ?? [],
          email: airTableIntegration?.config?.email ?? "",
          key: newToken,
        },
      });

      return newToken.access_token;
    }

    return access_token;
  } catch (error) {
    await deleteIntegration(environmentId);

    throw new Error("invalid token");
  }
};

export const getAirtableTables = async (environmentId: string) => {
  let tables: TAirtable[] = [];
  try {
    const token = await getAirtableToken(environmentId);

    tables = (await getBases(token)).bases;

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
  } catch (error: any) {
    console.error(error?.message);
  }
};
