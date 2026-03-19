import snowflake from "snowflake-sdk";
import { TMemberData } from "./types";

/**
 * Snowflake connection configuration
 * Ensure these environment variables are set:
 * - SNOWFLAKE_ACCOUNT
 * - SNOWFLAKE_USERNAME
 * - SNOWFLAKE_PASSWORD
 * - SNOWFLAKE_DATABASE
 * - SNOWFLAKE_SCHEMA
 * - SNOWFLAKE_WAREHOUSE
 */

let connectionPool: snowflake.Connection | null = null;

/**
 * Get or create Snowflake connection
 * In production, consider using a proper connection pool
 */
function getConnection(): snowflake.Connection {
  if (!connectionPool) {
    connectionPool = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USERNAME!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: process.env.SNOWFLAKE_DATABASE!,
      schema: process.env.SNOWFLAKE_SCHEMA,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
      // Optional: Add timeout and connection options
      timeout: 10000, // 10 seconds
      clientSessionKeepAlive: true,
      clientSessionKeepAliveHeartbeatFrequency: 3600, // 1 hour
    });
  }

  return connectionPool;
}

/**
 * Execute Snowflake query with connection management
 */
async function executeQuery<T = any>(sqlText: string, binds: any[] = []): Promise<T[]> {
  const connection = getConnection();

  // Ensure connection is established
  await new Promise<void>((resolve, reject) => {
    if (connection.isUp()) {
      resolve();
    } else {
      connection.connect((err) => {
        if (err) {
          console.error("Failed to connect to Snowflake:", err);
          connectionPool = null; // Reset pool on connection failure
          reject(err);
        } else {
          resolve();
        }
      });
    }
  });

  // Execute query
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          console.error("Snowflake query error:", err);
          reject(err);
        } else {
          resolve((rows || []) as T[]);
        }
      },
    });
  });
}

/**
 * Query member data from Snowflake
 *
 * @param recordNumber - The member's record number
 * @returns Member data or null if not found
 */
export async function querySnowflakeMember(recordNumber: string): Promise<TMemberData | null> {
  try {
    // Customize this query based on your Snowflake schema
    const query = `
      SELECT
        record_number,
        first_name,
        last_name,
        email,
        phone,
        organization,
        department,
        membership_level,
        membership_status,
        join_date,
        renewal_date,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country
      FROM members
      WHERE record_number = ?
        AND membership_status = 'ACTIVE'
      LIMIT 1
    `;

    const rows = await executeQuery(query, [recordNumber]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Map Snowflake column names to camelCase
    const memberData: TMemberData = {
      recordNumber: row.RECORD_NUMBER,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      phone: row.PHONE || undefined,
      organization: row.ORGANIZATION || undefined,
      department: row.DEPARTMENT || undefined,
      membershipLevel: row.MEMBERSHIP_LEVEL,
      membershipStatus: row.MEMBERSHIP_STATUS,
      joinDate: row.JOIN_DATE,
      renewalDate: row.RENEWAL_DATE || undefined,
      addressLine1: row.ADDRESS_LINE1 || undefined,
      addressLine2: row.ADDRESS_LINE2 || undefined,
      city: row.CITY || undefined,
      state: row.STATE || undefined,
      postalCode: row.POSTAL_CODE || undefined,
      country: row.COUNTRY || undefined,
    };

    return memberData;
  } catch (error) {
    console.error("[Snowflake Service] Query failed:", error);
    throw error;
  }
}

/**
 * Insert survey response rows into the SURVEYS.SURVEY_RESPONSES table.
 * Failures are logged but never thrown — survey submission must not be blocked.
 */
export async function insertSurveyResponses(
  rows: {
    RESPONSE_ID: string;
    SURVEY_ID: string;
    SURVEY_NAME: string;
    RECORD_NUMBER: string | null;
    CREATED_AT: string;
    FINISHED: boolean;
    QUESTION_ID: string;
    QUESTION_TEXT: string;
    QUESTION_TYPE: string;
    ANSWER: string;
    LANGUAGE: string | null;
    SOURCE_URL: string | null;
  }[]
): Promise<void> {
  if (rows.length === 0) return;

  const columns = [
    "RESPONSE_ID",
    "SURVEY_ID",
    "SURVEY_NAME",
    "RECORD_NUMBER",
    "CREATED_AT",
    "FINISHED",
    "QUESTION_ID",
    "QUESTION_TEXT",
    "QUESTION_TYPE",
    "ANSWER",
    "LANGUAGE",
    "SOURCE_URL",
  ];

  const placeholderRow = `(${columns.map(() => "?").join(", ")})`;
  const placeholders = rows.map(() => placeholderRow).join(",\n");

  const binds: any[] = [];
  for (const row of rows) {
    binds.push(
      row.RESPONSE_ID,
      row.SURVEY_ID,
      row.SURVEY_NAME,
      row.RECORD_NUMBER,
      row.CREATED_AT,
      row.FINISHED,
      row.QUESTION_ID,
      row.QUESTION_TEXT,
      row.QUESTION_TYPE,
      row.ANSWER,
      row.LANGUAGE,
      row.SOURCE_URL
    );
  }

  const sql = `INSERT INTO SURVEY_RESPONSES (${columns.join(", ")})
VALUES ${placeholders}`;

  try {
    await executeQuery(sql, binds);
  } catch (error) {
    console.error("[Snowflake Service] Failed to insert survey responses:", error);
    // Swallow error — never block the survey pipeline
  }
}

/**
 * Check whether Snowflake credentials are configured.
 * Avoids attempting a connection when env vars are missing.
 */
export function isSnowflakeConfigured(): boolean {
  return !!(
    process.env.SNOWFLAKE_ACCOUNT &&
    process.env.SNOWFLAKE_USERNAME &&
    process.env.SNOWFLAKE_PASSWORD &&
    process.env.SNOWFLAKE_DATABASE &&
    process.env.SNOWFLAKE_WAREHOUSE
  );
}

/**
 * Delete all survey response rows for a given survey from Snowflake.
 * Used when a survey is reset (all responses cleared).
 *
 * This is awaited by the caller so failures propagate — the caller
 * decides whether to proceed with the local delete.
 */
export async function deleteSurveyResponsesBySurveyId(surveyId: string): Promise<void> {
  if (!isSnowflakeConfigured()) return;

  const sql = `DELETE FROM SURVEY_RESPONSES WHERE SURVEY_ID = ?`;
  await executeQuery(sql, [surveyId]);
}

/**
 * Delete all Snowflake rows for a single response.
 * Intended to be called fire-and-forget; errors are caught internally.
 */
export async function deleteSurveyResponseByResponseId(responseId: string): Promise<void> {
  if (!isSnowflakeConfigured()) return;

  const sql = `DELETE FROM SURVEY_RESPONSES WHERE RESPONSE_ID = ?`;

  try {
    await executeQuery(sql, [responseId]);
  } catch (error) {
    // Logged but swallowed — single-response cleanup is best-effort
    console.error("[Snowflake] Failed to delete response", responseId, error);
  }
}

/**
 * Test Snowflake connection
 * Use this for health checks or debugging
 */
export async function testSnowflakeConnection(): Promise<boolean> {
  try {
    const result = await executeQuery("SELECT CURRENT_VERSION() as version");
    console.log("Snowflake connection test successful:", result[0]);
    return true;
  } catch (error) {
    console.error("Snowflake connection test failed:", error);
    return false;
  }
}

/**
 * Close Snowflake connection
 * Call this when shutting down the application
 */
export function closeConnection() {
  if (connectionPool) {
    connectionPool.destroy((err) => {
      if (err) {
        console.error("Error closing Snowflake connection:", err);
      } else {
        console.log("Snowflake connection closed");
      }
      connectionPool = null;
    });
  }
}
