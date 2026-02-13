import { NextRequest, NextResponse } from "next/server";
import {
  addQueryConfig,
  getFullQueryConfigs,
  validateQueryConfig,
} from "../../member-lookup/query-config-loader";

/**
 * Query Config Management API
 *
 * GET  /api/query/config — list all query configurations with full details
 * POST /api/query/config — create a new query configuration
 *
 * Auth: X-API-Key header must match MEMBER_LOOKUP_API_KEY
 */

function authenticate(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-API-Key") || request.nextUrl.searchParams.get("api_key");
  return !!apiKey && apiKey === process.env.MEMBER_LOOKUP_API_KEY;
}

export async function GET(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const queries = getFullQueryConfigs();

    return NextResponse.json({
      success: true,
      queries,
      count: queries.length,
    });
  } catch (error) {
    console.error("[Query Config API] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list query configurations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, sql, parameters, fields, cache } = body;

    if (!id || !name || !sql || !parameters || !fields) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: id, name, sql, parameters, fields",
        },
        { status: 400 }
      );
    }

    // Validate the slug format for id
    if (!/^[a-z0-9-]+$/.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Query ID must contain only lowercase letters, numbers, and hyphens",
        },
        { status: 400 }
      );
    }

    const queryConfig = {
      name,
      description,
      sql,
      parameters,
      fields,
      cache: cache || { enabled: true, ttl: 300 },
    };

    // Validate against security rules
    const validation = validateQueryConfig(queryConfig);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    addQueryConfig(id, queryConfig);

    return NextResponse.json(
      {
        success: true,
        message: `Query configuration '${id}' created successfully`,
        query: { id, ...queryConfig },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Query Config API] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to create query configuration";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
