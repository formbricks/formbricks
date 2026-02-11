import { NextRequest, NextResponse } from "next/server";
import { querySnowflakeEmployee } from "./snowflake-service";

/**
 * Employee Lookup API Endpoint
 *
 * Similar to member-lookup but queries employee table
 * with employee-specific fields
 */

export async function GET(request: NextRequest) {
  // Similar authentication/validation as member-lookup
  const apiKey = request.headers.get("X-API-Key");

  if (apiKey !== process.env.EMPLOYEE_LOOKUP_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }

  try {
    const employeeData = await querySnowflakeEmployee(employeeId);

    if (!employeeData) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: employeeData });
  } catch (error) {
    console.error("Employee lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
