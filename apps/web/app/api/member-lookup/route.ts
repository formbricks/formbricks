import { NextRequest, NextResponse } from "next/server";
import { querySnowflakeMember } from "./snowflake-service";

/**
 * Member Lookup API Endpoint
 *
 * Queries Snowflake database for member information based on record number.
 * Used by Formbricks surveys for dynamic data pre-population.
 *
 * @example
 * GET /api/member-lookup?recordNumber=12345
 * Headers: X-API-Key: your-secret-key
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "email": "john@example.com",
 *     ...
 *   }
 * }
 */

// Rate limiting map (in-memory, use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication
    const apiKey = request.headers.get("X-API-Key") || request.nextUrl.searchParams.get("api_key");

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Missing API key" }, { status: 401 });
    }

    if (apiKey !== process.env.MEMBER_LOOKUP_API_KEY) {
      const clientIp =
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      console.warn("Invalid API key attempt from IP:", clientIp);
      return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });
    }

    // 2. Rate Limiting
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateLimit = checkRateLimit(clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString(),
          },
        }
      );
    }

    // 3. Input Validation
    const recordNumber = request.nextUrl.searchParams.get("recordNumber");

    if (!recordNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter",
          message: "recordNumber is required",
        },
        { status: 400 }
      );
    }

    // Sanitize input - only allow alphanumeric and common separators
    if (!/^[a-zA-Z0-9\-_]+$/.test(recordNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid record number format",
          message: "Record number must contain only letters, numbers, hyphens, and underscores",
        },
        { status: 400 }
      );
    }

    // 4. Query Snowflake
    console.log(`[Member Lookup] Querying for record: ${recordNumber}`);

    const memberData = await querySnowflakeMember(recordNumber);

    if (!memberData) {
      console.log(`[Member Lookup] Record not found: ${recordNumber}`);
      return NextResponse.json(
        {
          success: false,
          error: "Record not found",
          message: `No member found with record number: ${recordNumber}`,
        },
        { status: 404 }
      );
    }

    // 5. Success Response
    const duration = Date.now() - startTime;
    console.log(`[Member Lookup] Success for ${recordNumber} (${duration}ms)`);

    return NextResponse.json(
      {
        success: true,
        data: memberData,
      },
      {
        headers: {
          "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-Response-Time": `${duration}ms`,
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[Member Lookup] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An error occurred while processing your request",
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

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
