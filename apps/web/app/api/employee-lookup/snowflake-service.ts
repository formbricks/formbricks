import snowflake from "snowflake-sdk";

// Reuse connection from member-lookup or create new one
import { executeQuery } from "../member-lookup/snowflake-service";

export async function querySnowflakeEmployee(employeeId: string) {
  try {
    // Employee-specific query
    const query = `
      SELECT
        employee_id,
        first_name,
        last_name,
        email,
        department,
        job_title,
        manager_name,
        hire_date,
        employment_status
      FROM employees
      WHERE employee_id = ?
        AND employment_status = 'ACTIVE'
      LIMIT 1
    `;

    const rows = await executeQuery(query, [employeeId]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return {
      employeeId: row.EMPLOYEE_ID,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      department: row.DEPARTMENT,
      jobTitle: row.JOB_TITLE,
      managerName: row.MANAGER_NAME,
      hireDate: row.HIRE_DATE,
      employmentStatus: row.EMPLOYMENT_STATUS,
    };
  } catch (error) {
    console.error("Employee query failed:", error);
    throw error;
  }
}

// Export executeQuery for reuse
export { executeQuery };
