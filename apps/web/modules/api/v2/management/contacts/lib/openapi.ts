import { createContactEndpoint, getContactsEndpoint } from "@/modules/api/v2/lib/openapi";
import {
  deleteContactEndpoint,
  getContactEndpoint,
  updateContactEndpoint,
} from "@/modules/api/v2/management/contacts/[contactId]/lib/openapi";
import { ZodOpenApiPathsObject } from "zod-openapi";

export const contactPaths: ZodOpenApiPathsObject = {
  "/contacts": {
    get: getContactsEndpoint,
    post: createContactEndpoint,
  },
  "/contacts/{id}": {
    get: getContactEndpoint,
    put: updateContactEndpoint,
    delete: deleteContactEndpoint,
  },
};
