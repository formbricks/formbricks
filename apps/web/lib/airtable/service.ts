import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TIntegrationItem } from "@formbricks/types/integration";
import { delay } from "../utils/promises";
import {
  TIntegrationAirtable,
  TIntegrationAirtableConfigData,
  TIntegrationAirtableCredential,
  ZIntegrationAirtableBases,
  ZIntegrationAirtableCredential,
  ZIntegrationAirtableTables,
  ZIntegrationAirtableTablesWithFields,
  ZIntegrationAirtableTokenSchema,
} from "@formbricks/types/integration/airtable";
import { AIRTABLE_CLIENT_ID, AIRTABLE_MESSAGE_LIMIT } from "../constants";
import { createOrUpdateIntegration, getIntegrationByType } from "../integration/service";
import { truncateText } from "../utils/strings";

export const getBases = async (key: string) => {
  const req = await fetch("https://api.airtable.com/v0/meta/bases", {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const res = await req.json();
  return ZIntegrationAirtableBases.parse(res);
};

const tableFetcher = async (key: TIntegrationAirtableCredential, baseId: string) => {
  const req = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      Authorization: `Bearer ${key.access_token}`,
    },
  });

  const res = await req.json();

  return res;
};

export const getTables = async (key: TIntegrationAirtableCredential, baseId: string) => {
  const res = await tableFetcher(key, baseId);
  return ZIntegrationAirtableTables.parse(res);
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

  const tokenRes: unknown = await tokenReq.json();
  const parsedToken = ZIntegrationAirtableTokenSchema.safeParse(tokenRes);

  if (!parsedToken.success) {
    logger.error(parsedToken.error, "Error parsing airtable token");
    throw new Error(parsedToken.error.message);
  }
  const { access_token, refresh_token, expires_in } = parsedToken.data;
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
    )) as TIntegrationAirtable;

    const { access_token, expiry_date, refresh_token } = ZIntegrationAirtableCredential.parse(
      airtableIntegration?.config.key
    );

    const expiryDate = new Date(expiry_date);
    const currentDate = new Date();

    if (currentDate >= expiryDate) {
      const client_id = AIRTABLE_CLIENT_ID;

      const newToken = await fetchAirtableAuthToken({
        grant_type: "refresh_token",
        refresh_token,
        client_id,
      });

      if (!newToken) {
        throw new Error("Failed to create new token");
      }

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
    throw new Error("invalid token");
  }
};

export const getAirtableTables = async (environmentId: string) => {
  let tables: TIntegrationItem[] = [];
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
  key: TIntegrationAirtableCredential,
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
  const res = await req.json();

  return res;
};

const addField = async (
  key: TIntegrationAirtableCredential,
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

const getExistingFields = async (key: TIntegrationAirtableCredential, baseId: string, tableId: string) => {
  const req = await tableFetcher(key, baseId);
  const tables = ZIntegrationAirtableTablesWithFields.parse(req).tables;
  const currentTable = tables.find((t) => t.id === tableId);

  if (!currentTable) {
    throw new Error(`Table with ID ${tableId} not found`);
  }

  return new Set(currentTable.fields.map((f) => f.name));
};

export const writeData = async (
  key: TIntegrationAirtableCredential,
  configData: TIntegrationAirtableConfigData,
  values: string[][]
) => {
  const responses = values[0];
  const questions = values[1];

  // 1) Build the record payload
  const data: Record<string, string> = {};
  for (let i = 0; i < questions.length; i++) {
    data[questions[i]] =
      responses[i].length > AIRTABLE_MESSAGE_LIMIT
        ? truncateText(responses[i], AIRTABLE_MESSAGE_LIMIT)
        : responses[i];
  }

  // 2) Figure out which fields need creating
  const existingFields = await getExistingFields(key, configData.baseId, configData.tableId);
  const fieldsToCreate = questions.filter((q) => !existingFields.has(q));

  // 3) Create any missing fields with throttling to respect Airtable's 5 req/sec per base limit
  if (fieldsToCreate.length > 0) {
    // Sequential processing with delays 
    const DELAY_BETWEEN_REQUESTS = 250; // 250ms = 4 requests per second (staying under 5/sec limit)

    for (let i = 0; i < fieldsToCreate.length; i++) {
      const fieldName = fieldsToCreate[i];

      const createRes = await addField(key, configData.baseId, configData.tableId, {
        name: fieldName,
        type: "singleLineText",
      });

      if (createRes?.error) {
        throw new Error(`Failed to create field "${fieldName}": ${JSON.stringify(createRes)}`);
      }

      // Add delay between requests (except for the last one)
      if (i < fieldsToCreate.length - 1) {
        await delay(DELAY_BETWEEN_REQUESTS);
      }
    }

    // 4) Wait for the new fields to show up
    await waitForFieldsToExist(key, configData, fieldsToCreate);
  }

  // 5) Finally, add the records
  await addRecords(key, configData.baseId, configData.tableId, data);
};

async function waitForFieldsToExist(
  key: TIntegrationAirtableCredential,
  configData: TIntegrationAirtableConfigData,
  fieldNames: string[],
  maxRetries = 5,
  intervalMs = 2000
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const existingFields = await getExistingFields(key, configData.baseId, configData.tableId);
    const missingFields = fieldNames.filter((f) => !existingFields.has(f));

    if (missingFields.length === 0) {
      return;
    }

    logger.error(
      `Attempt ${attempt}/${maxRetries}: ${missingFields.length} field(s) still missing [${missingFields.join(
        ", "
      )}], retrying in ${intervalMs / 1000}s…`
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const existingFields = await getExistingFields(key, configData.baseId, configData.tableId);
  const missingFields = fieldNames.filter((f) => !existingFields.has(f));

  throw new Error(
    `Timed out waiting for ${missingFields.length} field(s) [${missingFields.join(
      ", "
    )}] to become available. Available fields: [${Array.from(existingFields).join(", ")}]`
  );
}