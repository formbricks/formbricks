import { getToken } from "next-auth/jwt";
import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stringify } from "qs";
import { WEBAPP_URL } from "@formbricks/lib/constants";

function parseSetCookieHeader(setCookieHeader: string): ResponseCookie[] {
  // Lista dei possibili cookie presenti nella stringa
  const cookieAttributes = ["Path", "Expires", "Max-Age", "Domain", "Secure", "HttpOnly", "SameSite"];

  // Funzione per dividere la stringa unica dei cookies, in un'array di stringhe (1 per ogni cookie)
  function splitCookiesString(cookiesString): string[] {
    const arrayCookieStrings: any[] = [];
    let currentCookieString: string = "";
    let inQuotes = false;
    let inExpires = false;

    for (let i = 0; i < cookiesString.length; i++) {
      const char = cookiesString[i];

      // Gestione della virgola dentro il campo Expires
      if (cookiesString.slice(i, i + 8) === "Expires=") {
        inExpires = true;
      }

      if (inExpires && char === ",") {
        currentCookieString += char;
        continue;
      }

      // Se troviamo un punto e virgola, l'expires è finito
      if (inExpires && char === ";") {
        inExpires = false;
      }

      // Gestione delle virgolette per i valori che contengono la virgola
      if (char === '"') {
        inQuotes = !inQuotes;
      }

      // Se troviamo una virgola fuori dalle virgolette e non siamo nel campo Expires
      if (char === "," && !inQuotes && !inExpires) {
        arrayCookieStrings.push(currentCookieString.trim());
        currentCookieString = "";
      } else {
        currentCookieString += char;
      }
    }

    // Aggiungi l'ultimo cookie
    if (currentCookieString) {
      arrayCookieStrings.push(currentCookieString.trim());
    }

    return arrayCookieStrings;
  }

  function lowercaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  function parseExpiresDate(expiresString) {
    const date = new Date(expiresString);
    return isNaN(date.getTime()) ? null : date;
  }

  // Iniziamo con lo split dei singoli cookie dalla stringa
  const cookiesArray = splitCookiesString(setCookieHeader);

  const result: ResponseCookie[] = cookiesArray.map((cookieString) => {
    const parts = cookieString.split(";").map((part) => part.trim());

    // separo il cookie name=value dalle altre options
    const [nameValuePair, ...options] = parts;
    const [name, value] = nameValuePair.split("=");

    // rimappiamo le opzioni  del cookie
    const optionsObject: Omit<ResponseCookie, "name" | "value"> = {};
    options.forEach((option) => {
      const [key, val] = option.split("=");

      if (cookieAttributes.includes(key)) {
        const formattedKey = lowercaseFirstLetter(key); // Converte la prima lettera della chiave in minuscolo

        if (formattedKey === "expires") {
          const parsedDate = parseExpiresDate(val);
          if (parsedDate) {
            optionsObject[formattedKey] = parsedDate;
          }
        } else if (cookieAttributes.includes(key)) {
          optionsObject[formattedKey] = val === undefined ? true : val;
        }
      }
    });

    return {
      name: name,
      value: value,
      ...optionsObject,
    };
  });

  return result;
}

function stripUrlParameters(url: string, params: string[]) {
  const structuredUrl = new URL(url);

  const searchParams = structuredUrl.searchParams;

  params.forEach((p) => {
    if (searchParams.has(p)) {
      searchParams.delete(p);
    }
  });

  structuredUrl.search = searchParams.toString();

  return structuredUrl.toString();
}

export const adminIframeMiddleware = async (request: NextRequest) => {
  // issue with next auth types & Next 15; let's review when new fixes are available
  // @ts-expect-error
  const token = await getToken({ req: request });

  if (request.nextUrl.pathname.startsWith("/admin-iframe")) {
    const iframeAuthToken = request.nextUrl.searchParams.get("token");

    const currentUrl = WEBAPP_URL + request.nextUrl.pathname + request.nextUrl.search;
    const callbackUrl =
      request.nextUrl.searchParams.get("callbackUrl") ?? stripUrlParameters(currentUrl, ["token"]);

    if (token) {
      // todo: scoprire perche il redirect da problemi dentro l'iframe
      // console.log("### Admin-iframe already logged");
      // if (currentUrl !== callbackUrl && request.method !== 'POST'){
      //   console.log("redirect to callbackUrl");
      //   return NextResponse.redirect(callbackUrl)
      // }
      return;
    }

    if (!iframeAuthToken) {
      return NextResponse.json({ error: "Missing iframeAuth token" }, { status: 500 });
    }

    const csrfApiResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/csrf`);
    const csrfSetCookiesWithOptions = await csrfApiResponse.headers.getSetCookie();
    const setCookiesArray = [...csrfSetCookiesWithOptions];
    const setCookiesKeyValue = setCookiesArray
      .map((cookie) => cookie.split(";")[0]) // we only want the key value pair, not the options
      .join("; ");
    const csrfAuthToken: string = (await csrfApiResponse.json()).csrfToken;

    const credentialsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/callback/iframe-token`, {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: setCookiesKeyValue,
      },
      body: stringify({
        callbackUrl: callbackUrl,
        token: iframeAuthToken,
        redirect: "false",
        csrfToken: csrfAuthToken,
        json: true,
      }),
      method: "POST",
    });

    if (credentialsResponse.status !== 200) {
      return NextResponse.json(
        {
          error: "Failed to authenticate sign in attempt",
          responseStatus: credentialsResponse.status,
          text: await credentialsResponse.text(),
        },
        { status: 500 }
      );
    }

    const credentialsResponseCookieHeader = credentialsResponse.headers.getSetCookie().join(",");
    const credentialsResponseCookies: ResponseCookie[] = credentialsResponseCookieHeader
      ? parseSetCookieHeader(credentialsResponseCookieHeader)
      : [];

    const csrfResponseCookies = csrfSetCookiesWithOptions
      ? parseSetCookieHeader(csrfSetCookiesWithOptions.join(","))
      : [];

    let requiredCookies: ResponseCookie[] = [...csrfResponseCookies, ...credentialsResponseCookies];

    // il cookie "next-auth.callback-url" con la sessione attiva manda in errore. rimuovo
    requiredCookies = requiredCookies.filter((cookie) => cookie.name !== "next-auth.callback-url");

    // const response = NextResponse.redirect(callbackUrl);
    const response = NextResponse.next();

    requiredCookies.map((c) => {
      const { name, value, ...options } = c;
      if (response.cookies.has(name)) {
        response.cookies.delete(name);
      }
      response.cookies.set({
        name,
        value,
        // httpOnly:true,
        // ...options
        // secure:options.secure
        sameSite: "none",
        secure: true,
      });
    });

    return response;
  }
};
