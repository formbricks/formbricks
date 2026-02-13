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
