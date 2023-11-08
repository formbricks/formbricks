// import { getUpdatedState } from "@/app/api/v1/js/lib/sync";
// import { responses } from "@/app/lib/api/response";
// import { transformErrorToDetails } from "@/app/lib/api/validator";
// import { ZJsSyncInput } from "@formbricks/types/js";
// import { NextResponse } from "next/server";

// export async function OPTIONS(): Promise<NextResponse> {
//   return responses.successResponse({}, true);
// }

// export async function POST(req: Request): Promise<NextResponse> {
//   try {
//     const jsonInput = await req.json();

//     // validate using zod
//     const inputValidation = ZJsSyncInput.safeParse(jsonInput);

//     if (!inputValidation.success) {
//       return responses.badRequestResponse(
//         "Fields are missing or incorrectly formatted",
//         transformErrorToDetails(inputValidation.error),
//         true
//       );
//     }

//     const { environmentId, personId, jsVersion } = inputValidation.data;

//     if(!personId) {

//     }

//     const state = await getUpdatedState(environmentId, personId, jsVersion);

//     return responses.successResponse({ ...state }, true);
//   } catch (error) {
//     console.error(error);
//     return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
//   }
// }

import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getPublicUpdatedState, getUpdatedState } from "@formbricks/lib/sync/service";
import { ZJsSyncInput } from "@formbricks/types/js";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsSyncInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, personId } = inputValidation.data;

    if (!personId) {
      // pass the personId as "anonymous"
      // const state = await getUpdatedState(environmentId, "anonymous", inputValidation.data.jsVersion);
      const state = await getPublicUpdatedState(environmentId);
      // @ts-expect-error
      state.person = {
        id: "anonymous",
      };

      // @ts-expect-error
      state.session = {};
      return responses.successResponse({ ...state }, true);
    }

    const state = await getUpdatedState(environmentId, personId, inputValidation.data.jsVersion);

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
