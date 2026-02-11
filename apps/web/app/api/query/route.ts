import { NextRequest, NextResponse } from "next/server";

import { executeConfiguredQuery } from "../member-lookup/configurable-query-service";
import { listQueryConfigs } from "../member-lookup/query-config-loader";

/**
 * Configurable Query API Endpoint
 *
 * Executes queries based on configuration file
 * No code changes needed to add new queries!
 *
 * @example
 * GET /api/query/member-basic?recordNumber=12345
 * GET /api/query/employee?employeeId=EMP001
 * GET /api/query/customer-orders?customerId=CUST999
 *
 * Headers: X-API-Key: your-secret-key
 */

// Rate limiting (reuse from member-lookup)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

/**
 * GET /api/query/[queryId]
 *
 * Execute a configured query
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication
    const apiKey = request.headers.get("X-API-Key") || request.nextUrl.searchParams.get("api_key");

    if (!apiKey || apiKey !== process.env.MEMBER_LOOKUP_API_KEY) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate Limiting
    const clientIp = request.ip || "unknown";
    const rateLimit = checkRateLimit(clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // 3. Extract query ID from path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const queryId = pathParts[pathParts.length - 1];

    if (!queryId || queryId === "query") {
      // List available queries
      const queries = listQueryConfigs();
      return NextResponse.json({
        success: true,
        queries,
        message: "Specify a query ID in the path, e.g. /api/query/member-basic",
      });
    }

    // 4. Extract parameters from query string
    const parameters: Record<string, any> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== "api_key") {
        parameters[key] = value;
      }
    });

    // 5. Execute query
    console.log(`[Query API] Executing ${queryId} for IP ${clientIp}`);

    const result = await executeConfiguredQuery(queryId, parameters);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          message: "No record found matching the provided parameters",
        },
        { status: 404 }
      );
    }

    // 6. Success response
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: result,
        queryId,
      },
      {
        headers: {
          "X-Response-Time": `${duration}ms`,
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[Query API] Error:", error);

    const message = error instanceof Error ? error.message : "An error occurred";

    return NextResponse.json(
      {
        success: false,
        error: "Query execution failed",
        message,
      },
      {
        status: 500,
        headers: {
          "X-Response-Time": `${duration}ms`,
        },
      }
    );
  }
}

/**
 * POST /api/query
 *
 * List all available configured queries
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("X-API-Key");

    if (!apiKey || apiKey !== process.env.MEMBER_LOOKUP_API_KEY) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const queries = listQueryConfigs();

    return NextResponse.json({
      success: true,
      queries,
      count: queries.length,
    });
  } catch (error) {
    console.error("[Query API] List error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list queries",
      },
      { status: 500 }
    );
  }
}
