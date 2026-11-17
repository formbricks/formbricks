import { responses } from "@/app/lib/api/response";

export const extractAuthToken = (req: Request) => {
  const authHeader = req.headers.get("authorization");
  const parts = (authHeader || "").split(" ");
  if (parts.length > 1) return parts[1];

  // check for query param
  const params = new URL(req.url).searchParams;
  const accessToken = params.get("access_token");
  if (accessToken) return accessToken;

  // eslint-disable-next-line typescript/only-throw-error -- the route catches the thrown Response and returns it
  throw responses.unauthorizedResponse();
};
