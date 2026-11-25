/**
 * Rewrite a successful v3 JSON response's body for an MCP projection (concise payloads, field
 * projections), keeping its status and headers.
 *
 * An error response, a `map` that returns `undefined`, or a body that does not parse is handed back
 * unchanged. These projections run after a write has committed, inside `runMcpMutation`'s callback, so a
 * throw here would audit an already-committed write as failed; the unprojected response is the safe
 * answer.
 */
export async function mapJsonResponseBody<TBody>(
  response: Response,
  map: (body: TBody) => unknown
): Promise<Response> {
  if (!response.ok) {
    return response;
  }

  try {
    const mapped = map((await response.clone().json()) as TBody);
    if (mapped === undefined) {
      return response;
    }
    return Response.json(mapped, { status: response.status, headers: response.headers });
  } catch {
    return response;
  }
}
