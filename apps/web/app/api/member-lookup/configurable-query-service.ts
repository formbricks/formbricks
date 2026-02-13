import snowflake from "snowflake-sdk";
import { getQueryConfig, validateQueryConfig } from "./query-config-loader";

/**
 * Configurable Query Service
 *
 * Executes Snowflake queries based on configuration file
 * Supports caching, parameter substitution, and field mapping
 */

// Connection management (reuse from snowflake-service.ts)
let connectionPool: snowflake.Connection | null = null;

function getConnection(): snowflake.Connection {
  if (!connectionPool) {
    connectionPool = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USERNAME!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: process.env.SNOWFLAKE_DATABASE!,
      schema: process.env.SNOWFLAKE_SCHEMA,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
      timeout: 10000,
      clientSessionKeepAlive: true,
      clientSessionKeepAliveHeartbeatFrequency: 3600,
    });
  }

  return connectionPool;
}

async function executeQuery<T = any>(sqlText: string, binds: any[] = []): Promise<T[]> {
  const connection = getConnection();

  await new Promise<void>((resolve, reject) => {
    if (connection.isUp()) {
      resolve();
    } else {
      connection.connect((err) => {
        if (err) {
          console.error("Failed to connect to Snowflake:", err);
          connectionPool = null;
          reject(err);
        } else {
          resolve();
        }
      });
    }
  });

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

// Simple in-memory cache (use Redis in production)
const queryCache = new Map<string, { data: any; expires: number }>();

/**
 * Execute a configured query by ID
 */
export async function executeConfiguredQuery(
  queryId: string,
  parameters: Record<string, any>
): Promise<any | null> {
  const startTime = Date.now();

  try {
    // Load query configuration
    const queryConfig = getQueryConfig(queryId);

    // Validate query configuration
    const validation = validateQueryConfig(queryConfig);
    if (!validation.valid) {
      throw new Error(`Invalid query configuration: ${validation.errors.join(", ")}`);
    }

    // Check cache
    if (queryConfig.cache?.enabled) {
      const cacheKey = `${queryId}:${JSON.stringify(parameters)}`;
      const cached = queryCache.get(cacheKey);

      if (cached && Date.now() < cached.expires) {
        console.log(`[Configurable Query] Cache hit for ${queryId} (${Date.now() - startTime}ms)`);
        return cached.data;
      }
    }

    // Validate required parameters
    const missingParams = queryConfig.parameters.filter((param) => !(param in parameters));
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(", ")}`);
    }

    // Convert named parameters (:paramName) to positional (?)
    const { sql, binds } = convertNamedParameters(queryConfig.sql, parameters);

    console.log(`[Configurable Query] Executing ${queryId} with params:`, parameters);

    // Execute query
    const rows = await executeQuery(sql, binds);

    if (rows.length === 0) {
      console.log(`[Configurable Query] No results for ${queryId} (${Date.now() - startTime}ms)`);
      return null;
    }

    // Map fields from SQL columns to output format
    const result = mapFields(rows[0], queryConfig.fields);

    // Cache result
    if (queryConfig.cache?.enabled) {
      const cacheKey = `${queryId}:${JSON.stringify(parameters)}`;
      const ttl = queryConfig.cache.ttl || 300;

      queryCache.set(cacheKey, {
        data: result,
        expires: Date.now() + ttl * 1000,
      });
    }

    console.log(`[Configurable Query] Success for ${queryId} (${Date.now() - startTime}ms)`);

    return result;
  } catch (error) {
    console.error(`[Configurable Query] Error executing ${queryId}:`, error);
    throw error;
  }
}

/**
 * Convert named parameters to positional
 * :paramName -> ?
 */
function convertNamedParameters(sql: string, parameters: Record<string, any>): { sql: string; binds: any[] } {
  const binds: any[] = [];
  const paramRegex = /:(\w+)/g;

  const convertedSql = sql.replace(paramRegex, (_match, paramName) => {
    if (!(paramName in parameters)) {
      throw new Error(`Parameter ${paramName} not provided`);
    }
    binds.push(parameters[paramName]);
    return "?";
  });

  return { sql: convertedSql, binds };
}

/**
 * Map SQL result columns to output field names
 */
function mapFields(row: any, fieldMapping: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};

  Object.entries(fieldMapping).forEach(([outputField, sqlColumn]) => {
    const upperColumn = sqlColumn.toUpperCase();

    if (upperColumn in row) {
      result[outputField] = row[upperColumn];
    } else {
      console.warn(`[Field Mapping] Column ${sqlColumn} not found in result`);
      result[outputField] = null;
    }
  });

  return result;
}

/**
 * Clear query cache
 */
export function clearQueryCache(): void {
  queryCache.clear();
  console.log("[Configurable Query] Cache cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: queryCache.size,
    keys: Array.from(queryCache.keys()),
  };
}

/**
 * Test a query configuration without executing
 */
export function testQueryConfig(
  queryId: string,
  parameters: Record<string, any>
): {
  valid: boolean;
  sql?: string;
  binds?: any[];
  errors?: string[];
} {
  try {
    const queryConfig = getQueryConfig(queryId);
    const validation = validateQueryConfig(queryConfig);

    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors,
      };
    }

    const { sql, binds } = convertNamedParameters(queryConfig.sql, parameters);

    return {
      valid: true,
      sql,
      binds,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
