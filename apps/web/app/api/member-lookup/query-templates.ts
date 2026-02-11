/**
 * Query Templates for Different Survey Types
 *
 * Define different Snowflake queries for different use cases
 * Select via queryType parameter in API call
 */

export type QueryType = "basic" | "detailed" | "premium" | "employee" | "customer";

export interface QueryTemplate {
  sql: string;
  description: string;
  requiredFields: string[];
}

export const QUERY_TEMPLATES: Record<QueryType, QueryTemplate> = {
  basic: {
    description: "Basic member information only",
    sql: `
      SELECT
        record_number,
        first_name,
        last_name,
        email
      FROM members
      WHERE record_number = ?
      LIMIT 1
    `,
    requiredFields: ["record_number", "first_name", "last_name", "email"],
  },

  detailed: {
    description: "All member information including address and history",
    sql: `
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
      LIMIT 1
    `,
    requiredFields: ["record_number"],
  },

  premium: {
    description: "Premium members only with additional benefits info",
    sql: `
      SELECT
        m.record_number,
        m.first_name,
        m.last_name,
        m.email,
        m.membership_level,
        m.join_date,
        b.benefit_name,
        b.benefit_status
      FROM members m
      LEFT JOIN member_benefits b ON m.record_number = b.record_number
      WHERE m.record_number = ?
        AND m.membership_level IN ('Premium', 'VIP')
        AND m.membership_status = 'ACTIVE'
      LIMIT 1
    `,
    requiredFields: ["record_number"],
  },

  employee: {
    description: "Employee data from employees table",
    sql: `
      SELECT
        employee_id as record_number,
        first_name,
        last_name,
        email,
        department,
        job_title,
        manager_name,
        hire_date
      FROM employees
      WHERE employee_id = ?
        AND employment_status = 'ACTIVE'
      LIMIT 1
    `,
    requiredFields: ["employee_id"],
  },

  customer: {
    description: "Customer data with purchase history",
    sql: `
      SELECT
        c.customer_id as record_number,
        c.first_name,
        c.last_name,
        c.email,
        c.customer_since,
        COUNT(o.order_id) as total_orders,
        SUM(o.order_total) as lifetime_value
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
      WHERE c.customer_id = ?
      GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.customer_since
      LIMIT 1
    `,
    requiredFields: ["customer_id"],
  },
};

/**
 * Get query template by type
 */
export function getQueryTemplate(queryType: string): QueryTemplate {
  const template = QUERY_TEMPLATES[queryType as QueryType];

  if (!template) {
    throw new Error(
      `Invalid query type: ${queryType}. Valid types: ${Object.keys(QUERY_TEMPLATES).join(", ")}`
    );
  }

  return template;
}

/**
 * Validate that required fields are present in result
 */
export function validateQueryResult(result: any, template: QueryTemplate): boolean {
  return template.requiredFields.every((field) => field.toUpperCase() in result);
}
