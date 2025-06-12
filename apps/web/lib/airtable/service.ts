import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TIntegrationItem } from "@formbricks/types/integration";
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
import { createOrUpdateIntegration, deleteIntegration, getIntegrationByType } from "../integration/service";
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
    await deleteIntegration(environmentId);

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
  console.log(res);

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

  // 2) Fetch the current table schema
  const req = await tableFetcher(key, configData.baseId);
  const tables = ZIntegrationAirtableTablesWithFields.parse(req).tables;
  const currentTable = tables.find((t) => t.id === configData.tableId);

  if (!currentTable) {
    throw new Error(`Table with ID ${configData.tableId} not found`);
  }

  // 3) Figure out which fields need creating
  const existingFields = new Set(currentTable.fields.map((f) => f.name));
  const fieldsToCreate = questions.filter((q) => !existingFields.has(q));

  // 4) Create any missing fields
  if (fieldsToCreate.length > 0) {
    console.log(`Creating fields: ${fieldsToCreate.join(", ")}`);
    await Promise.all(
      fieldsToCreate.map((fieldName) =>
        addField(key, configData.baseId, configData.tableId, {
          name: fieldName,
          type: "singleLineText",
        })
      )
    );

    // 5) Wait for the new fields to show up
    await waitForFieldsToExist(key, configData, fieldsToCreate);
  }

  // 6) Finally, add the records
  console.log("Adding records now that fields are in place");
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
    const schema = await tableFetcher(key, configData.baseId);
    const table = ZIntegrationAirtableTablesWithFields.parse(schema)
      .tables.find((t) => t.id === configData.tableId)!;
    const existing = new Set(table.fields.map((f) => f.name));

    if (fieldNames.every((f) => existing.has(f))) {
      console.log("All fields are now live in Airtable");
      return;
    }

    console.log(
      `Attempt ${attempt}/${maxRetries}: fields not live yet, retrying in ${intervalMs / 1000
      }s…`
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timed out waiting for fields [${fieldNames.join(
      ", "
    )}] to become available.`
  );
}