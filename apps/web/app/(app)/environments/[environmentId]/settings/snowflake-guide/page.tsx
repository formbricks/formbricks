import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export default function SnowflakeGuidePage() {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Snowflake Integration Guide" />

      <div className="mx-auto max-w-4xl space-y-8">
        {/* Prerequisites */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">1. Prerequisites</h2>
          <ul className="ml-6 list-disc space-y-1 text-sm text-slate-600">
            <li>A Snowflake account with an active warehouse</li>
            <li>A Snowflake user with read access to the target database/schema</li>
            <li>Network access from your Formbricks deployment to Snowflake (whitelist IPs if needed)</li>
            <li>Survey variables configured to receive the data from Snowflake</li>
          </ul>
        </section>

        {/* Environment Variables */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">2. Environment Variables</h2>
          <p className="text-sm text-slate-600">
            Set the following environment variables in your deployment (e.g.,{" "}
            <code className="rounded bg-slate-100 px-1">.env</code> file or Docker environment):
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Variable</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Description</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_ACCOUNT</td>
                  <td className="px-4 py-2 text-slate-600">Your Snowflake account identifier</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">xy12345.us-east-1</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_USERNAME</td>
                  <td className="px-4 py-2 text-slate-600">Snowflake login username</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">FORMBRICKS_SVC</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_PASSWORD</td>
                  <td className="px-4 py-2 text-slate-600">Snowflake login password</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">***</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_DATABASE</td>
                  <td className="px-4 py-2 text-slate-600">Default database name</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">PROD_DB</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_SCHEMA</td>
                  <td className="px-4 py-2 text-slate-600">Default schema name</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">PUBLIC</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_WAREHOUSE</td>
                  <td className="px-4 py-2 text-slate-600">Warehouse to use for queries</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">COMPUTE_WH</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">SNOWFLAKE_ROLE</td>
                  <td className="px-4 py-2 text-slate-600">Snowflake role (optional)</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">READONLY</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">MEMBER_LOOKUP_API_KEY</td>
                  <td className="px-4 py-2 text-slate-600">API key for authenticating query requests</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">sk-your-secret-key</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Query Configuration */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">3. Query Configuration</h2>
          <p className="text-sm text-slate-600">
            Queries are defined in <code className="rounded bg-slate-100 px-1">query-config.json</code> and
            can also be created from the survey editor UI. Each query specifies:
          </p>

          <ul className="ml-6 list-disc space-y-1 text-sm text-slate-600">
            <li>
              <strong>ID</strong> - A unique slug identifier (e.g.,{" "}
              <code className="rounded bg-slate-100 px-1">member-basic</code>)
            </li>
            <li>
              <strong>Name</strong> - A human-readable name
            </li>
            <li>
              <strong>SQL Template</strong> - The SELECT query with{" "}
              <code className="rounded bg-slate-100 px-1">:paramName</code> parameter syntax
            </li>
            <li>
              <strong>Parameters</strong> - List of parameter names extracted from the SQL
            </li>
            <li>
              <strong>Fields</strong> - Mapping of friendly field names to SQL column names
            </li>
          </ul>

          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Example query configuration:</p>
            <pre className="overflow-x-auto text-xs text-slate-700">
              {`{
  "member-basic": {
    "name": "Basic Member Info",
    "description": "Minimal member information",
    "sql": "SELECT record_number, first_name, last_name, email
            FROM members
            WHERE record_number = :recordNumber
            LIMIT 1",
    "parameters": ["recordNumber"],
    "fields": {
      "recordNumber": "record_number",
      "firstName": "first_name",
      "lastName": "last_name",
      "email": "email"
    },
    "cache": { "enabled": true, "ttl": 300 }
  }
}`}
            </pre>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>Security:</strong> Only <code className="rounded bg-amber-100 px-1">SELECT</code>{" "}
              statements are allowed. Keywords like DROP, DELETE, UPDATE, INSERT are blocked. Queries must
              include a <code className="rounded bg-amber-100 px-1">WHERE</code> clause and a{" "}
              <code className="rounded bg-amber-100 px-1">LIMIT</code> clause.
            </p>
          </div>
        </section>

        {/* Connecting a Survey */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">4. Connecting a Survey</h2>
          <p className="text-sm text-slate-600">Follow these steps to connect a survey to Snowflake data:</p>

          <ol className="ml-6 list-decimal space-y-3 text-sm text-slate-600">
            <li>
              <strong>Create survey variables</strong>
              <p className="mt-1 text-slate-500">
                In the survey editor, go to the Variables section and create variables to hold the data from
                Snowflake (e.g., <code className="rounded bg-slate-100 px-1">firstName</code>,{" "}
                <code className="rounded bg-slate-100 px-1">lastName</code>,{" "}
                <code className="rounded bg-slate-100 px-1">email</code>).
              </p>
            </li>
            <li>
              <strong>Add an External Data Source</strong>
              <p className="mt-1 text-slate-500">
                In the Settings tab, scroll to &quot;External Data Sources&quot; and click{" "}
                <strong>&quot;Add Snowflake Source&quot;</strong>.
              </p>
            </li>
            <li>
              <strong>Enter your API key</strong>
              <p className="mt-1 text-slate-500">
                Enter the same value you set for{" "}
                <code className="rounded bg-slate-100 px-1">MEMBER_LOOKUP_API_KEY</code>. The available
                queries will load automatically.
              </p>
            </li>
            <li>
              <strong>Select or create a query</strong>
              <p className="mt-1 text-slate-500">
                Choose an existing query from the dropdown, or click &quot;Create New Query&quot; to define
                one inline. The URL, authentication, and field mappings will be auto-configured.
              </p>
            </li>
            <li>
              <strong>Review field mappings</strong>
              <p className="mt-1 text-slate-500">
                The system auto-maps query output fields to survey variables by name matching. Review and
                adjust the mappings as needed, then click &quot;Save&quot;.
              </p>
            </li>
            <li>
              <strong>Add a logic action to trigger the API call</strong>
              <p className="mt-1 text-slate-500">
                In the question editor, add a logic action of type &quot;Fetch External Data&quot; to call the
                API at the appropriate point in the survey flow (e.g., after the respondent enters their ID).
              </p>
            </li>
          </ol>
        </section>

        {/* Testing */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">5. Testing</h2>
          <p className="text-sm text-slate-600">After configuring your data source:</p>

          <ol className="ml-6 list-decimal space-y-2 text-sm text-slate-600">
            <li>
              Click the <strong>&quot;Test Connection&quot;</strong> button in the data source editor. This
              sends a test request to verify the API is reachable and authenticated.
            </li>
            <li>
              Check that the response includes the expected fields. A successful test shows a green checkmark.
            </li>
            <li>
              Use the survey preview to walk through the full flow and verify that variables are populated
              correctly after the API call.
            </li>
            <li>
              You can also test the API directly:
              <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 font-mono text-xs">
                {`curl -H "X-API-Key: YOUR_KEY" \\
  "https://your-domain.com/api/query/member-basic?recordNumber=12345"`}
              </pre>
            </li>
          </ol>
        </section>

        {/* Troubleshooting */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">6. Troubleshooting</h2>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="font-medium text-slate-800">401 Unauthorized</p>
              <p className="mt-1 text-sm text-slate-600">
                The API key in the data source does not match{" "}
                <code className="rounded bg-slate-100 px-1">MEMBER_LOOKUP_API_KEY</code>. Double-check the
                value in both your environment and the data source configuration.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium text-slate-800">Connection timeout / Network error</p>
              <p className="mt-1 text-sm text-slate-600">
                Ensure your Formbricks deployment can reach Snowflake. If using Docker, verify the container
                has network access. Check that{" "}
                <code className="rounded bg-slate-100 px-1">SNOWFLAKE_ACCOUNT</code> is correct and the
                warehouse is running.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium text-slate-800">Query not found</p>
              <p className="mt-1 text-sm text-slate-600">
                The query ID in the URL does not match any entry in{" "}
                <code className="rounded bg-slate-100 px-1">query-config.json</code>. Verify the query was
                created successfully and the ID is spelled correctly.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium text-slate-800">No data returned (404)</p>
              <p className="mt-1 text-sm text-slate-600">
                The query executed successfully but found no matching records. Verify the parameter values are
                correct and that matching data exists in Snowflake.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium text-slate-800">Variables not populated in survey</p>
              <p className="mt-1 text-sm text-slate-600">
                Check that: (1) field mappings use the correct response field paths (e.g.,{" "}
                <code className="rounded bg-slate-100 px-1">data.firstName</code>), (2) variable IDs in
                mappings match the survey variables, and (3) the logic action to fetch data is placed before
                the questions that use those variables.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-medium text-slate-800">Rate limit exceeded (429)</p>
              <p className="mt-1 text-sm text-slate-600">
                The API allows 20 requests per minute per IP address. If you need higher limits, adjust the
                rate limiting configuration in the query route handler.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageContentWrapper>
  );
}
