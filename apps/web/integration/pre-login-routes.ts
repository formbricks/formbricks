import { NextRequest } from "next/server";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";

type TRouteHandler = (req: NextRequest, props: never) => Promise<Response>;

/**
 * What a pre-login route answered: its status, the `data` of a success, and for a refusal the stable code
 * the page translates (`details.reason`), else the problem's `detail`.
 */
export type TPreLoginRouteResult = { status: number; data?: unknown; error?: string };

/**
 * POST `body` to a pre-login route (`auth: "none"`) through its real wrapper, as the page's same-origin
 * `fetch` does: the suites that drove the server actions these routes replaced drive the routes instead.
 */
export const postToPreLoginRoute = async (
  handler: TRouteHandler,
  path: string,
  body: unknown
): Promise<TPreLoginRouteResult> => {
  const response = await handler(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    }),
    {} as never
  );
  if (response.status === 204) return { status: response.status };

  const payload = (await response.json()) as {
    data?: unknown;
    detail?: string;
    details?: { reason?: unknown };
  };
  if (response.ok) return { status: response.status, data: payload.data };

  const reason = payload.details?.reason;
  return { status: response.status, error: typeof reason === "string" ? reason : payload.detail };
};

/**
 * A sign-up answer with its display token reduced to its presence: the token is encrypted with a fresh IV
 * on every call, so two answers are never byte-identical, but whether it is there must not vary either.
 */
export const withoutEmailToken = ({ status, data, error }: TPreLoginRouteResult) => {
  if (data === undefined) return { status, error };
  const { emailToken, ...rest } = data as { emailToken?: unknown };
  return { status, data: { ...rest, hasEmailToken: typeof emailToken === "string" }, error };
};
