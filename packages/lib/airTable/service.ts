import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import {
  TAirtable,
  TAirtableCredential,
  TAirtableIntegrationInput,
  TAirtableConfigData,
  ZAirtableCredential,
  ZAirtableTokenSchema,
  ZBases,
  ZTables,
  ZTablesWithFields,
  TAirtableIntegration,
} from "@formbricks/types/v1/integration";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { AIR_TABLE_CLIENT_ID } from "../constants";
import { createOrUpdateIntegration, deleteIntegration, getIntegrationByType } from "../integration/service";

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

export const getBases = async (key: string) => {
  const req = await fetch("https://api.airtable.com/v0/meta/bases", {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const res = await req.json();

  return ZBases.parse(res);
};

const tableFetcher = async (key: TAirtableCredential, baseId: string) => {
  const req = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${key.access_token}`,
    },
  });

  const res = await req.json();

  return res;
};

export const getTables = async (key: TAirtableCredential, baseId: string) => {
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
    const airtableIntegration = (await getIntegrationByType(
      environmentId,
      "airtable"
    )) as TAirtableIntegration;

    const { access_token, expiry_date, refresh_token } = ZAirtableCredential.parse(
      airtableIntegration?.config.key
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
          data: airtableIntegration?.config?.data ?? [],
          email: airtableIntegration?.config?.email ?? "",
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

const addRecords = async (
  key: TAirtableCredential,
  baseId: string,
  tableId: string,
  data: Record<string, string>
) => {
  const req = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.access_token}`,
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      fields: data,
      typecast: true,
    }),
  });

  return await req.json();
};

const addField = async (
  key: TAirtableCredential,
  baseId: string,
  tableId: string,
  data: Record<string, string>
) => {
  const req = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.access_token}`,
      "Content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return await req.json();
};

export const writeData = async (
  key: TAirtableCredential,
  configData: TAirtableConfigData,
  values: string[][]
) => {
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
